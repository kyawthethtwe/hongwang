import { expect, test } from '@playwright/test';
import { cancelAsGuest, findListing, freeStay, INSTANT_LISTING, myBooking, REQUEST_LISTING, SESSION } from './helpers';

/**
 * The golden paths (implementation plan, M0 5.4) with simulated payments (the API runs without
 * Stripe keys). Sessions come from auth.setup.ts. Each path undoes what it created, even when it fails.
 */

test.describe('as the guest', () => {
  test.use({ storageState: SESSION.guest });

  test('search, reserve, pay, see the trip', async ({ page }) => {
    const listing = await findListing(page.request, INSTANT_LISTING);
    const stay = await freeStay(page.request, listing.id, 2);
    let bookingId: string | null = null;
    try {
      await page.goto(`/search?place=ari&checkIn=${stay.checkIn}&checkOut=${stay.checkOut}&guests=1`);
      await page.locator('article').filter({ hasText: INSTANT_LISTING }).getByRole('link').first().click();
      await expect(page).toHaveURL(new RegExp(`/rooms/${listing.id}.*checkIn=${stay.checkIn}`));

      await page.getByRole('button', { name: 'Reserve', exact: true }).click();
      await expect(page).toHaveURL(/\/checkout\//);
      bookingId = new URL(page.url()).pathname.split('/').pop()!;
      await page.getByRole('button', { name: /^Pay ฿/ }).click();
      await expect(page.getByText('Payment received. Your stay is confirmed.')).toBeVisible();

      await page.getByRole('link', { name: 'View your trip' }).first().click();
      await expect(page).toHaveURL(`/trips/${bookingId}`);
      await expect(page.getByRole('heading', { name: INSTANT_LISTING })).toBeVisible();
      await expect(page.getByText('Confirmed', { exact: true }).first()).toBeVisible();
      expect((await myBooking(page.request, listing.id, stay.checkIn)).status).toBe('confirmed');
    } finally {
      if (bookingId) await cancelAsGuest(page.request, bookingId);
    }
  });

  test('request to book: the host approves, then the guest pays', async ({ page, browser }) => {
    const listing = await findListing(page.request, REQUEST_LISTING);
    const stay = await freeStay(page.request, listing.id, 3);
    let bookingId: string | null = null;
    try {
      await page.goto(`/rooms/${listing.id}?checkIn=${stay.checkIn}&checkOut=${stay.checkOut}&guests=1`);
      await page.getByLabel(/^Message to /).first().fill('Hi! Quiet guest, here for work. (E2E test)');
      await page.getByRole('button', { name: 'Request to book', exact: true }).click();
      await expect(page.getByText('Request sent').first()).toBeVisible();
      const request = await myBooking(page.request, listing.id, stay.checkIn);
      bookingId = request.id;
      expect(request.status).toBe('requested');

      // The host, in their own browser session.
      const hostContext = await browser.newContext({ storageState: SESSION.host });
      try {
        const host = await hostContext.newPage();
        await host.goto(`/host/reservations/${request.id}`);
        await host.getByRole('button', { name: 'Approve', exact: true }).click();
        await expect(host.getByText(/Approved\. .+ has 15 minutes to pay\./)).toBeVisible();
      } finally {
        await hostContext.close();
      }

      await page.goto(`/checkout/${request.id}`);
      await page.getByRole('button', { name: /^Pay ฿/ }).click();
      await expect(page.getByText('Payment received. Your stay is confirmed.')).toBeVisible();
      expect((await myBooking(page.request, listing.id, stay.checkIn)).status).toBe('confirmed');
    } finally {
      if (bookingId) await cancelAsGuest(page.request, bookingId);
    }
  });
});

test.describe('as the host', () => {
  test.use({ storageState: SESSION.host });

  test('block nights in the calendar, and guests see them taken', async ({ page }) => {
    const listing = await findListing(page.request, INSTANT_LISTING);
    const stay = await freeStay(page.request, listing.id, 2, { sameMonth: true });
    const day = (d: string) => page.locator(`button[data-date="${d}"]`);
    const unavailable = async () => {
      const res = await page.request.get(`/api/listings/${listing.id}/availability?from=${stay.checkIn}&to=${stay.checkOut}`);
      return ((await res.json()) as { unavailable: string[] }).unavailable;
    };

    try {
      await page.goto(`/host/calendar?listingId=${listing.id}&month=${stay.checkIn.slice(0, 7)}`);
      for (const d of stay.nights) await day(d).click();
      await page.getByLabel('Blocked', { exact: true }).check();
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      for (const d of stay.nights) await expect(day(d)).toHaveAttribute('aria-label', /, blocked$/);
      expect(await unavailable()).toEqual(stay.nights);

      // Open them again (the other half of the path).
      for (const d of stay.nights) await day(d).click();
      await page.getByLabel('Open for booking', { exact: true }).check();
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      for (const d of stay.nights) await expect(day(d)).toHaveAttribute('aria-label', /, open at /);
      expect(await unavailable()).toEqual([]);
    } finally {
      // Whatever happened above, leave the nights open.
      await page.request.put(`/api/host/calendar/${listing.id}/blocks`, { data: { dates: stay.nights, blocked: false } });
    }
  });
});
