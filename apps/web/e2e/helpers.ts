import { addDays, todayInBangkok, type AvailabilityDto, type BookingDto, type IsoDate, type SearchResultDto } from '@hongwang/shared';
import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { join } from 'node:path';

/** Seeded accounts (apps/api/src/database/seed.ts); E2E_PASSWORD overrides the dev password. */
export const GUEST = 'daniel@hongwang.local';
export const HOST = 'ploy@hongwang.local';
const PASSWORD = process.env.E2E_PASSWORD ?? 'hongwang-dev-2026';

/** Ploy's seeded listings in Ari: one instant book, one request to book. */
export const INSTANT_LISTING = 'Sunny studio near BTS Ari';
export const REQUEST_LISTING = 'Quiet 1-bed with balcony';

/** Saved sessions from auth.setup.ts: each account signs in once per run (login is rate limited). */
export const SESSION = {
  guest: join(__dirname, '.auth', 'guest.json'),
  host: join(__dirname, '.auth', 'host.json'),
};

export async function signIn(page: Page, email: string) {
  await page.goto('/login');
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.locator('button[type="submit"]', { hasText: 'Sign in' }).click();
  await expect(page)
    .not.toHaveURL(/\/login/)
    .catch(async (err: unknown) => {
      if (await page.getByText('Too many attempts').isVisible()) {
        throw new Error('Sign-in is rate limited (10 a minute per IP). Wait a minute and run again.');
      }
      throw err;
    });
}

/** The API through the web origin's /api rewrite, with the page's session cookies. */
async function api<T>(request: APIRequestContext, path: string): Promise<T> {
  const res = await request.get(`/api${path}`);
  expect(res.ok(), `GET ${path} -> ${res.status()}`).toBe(true);
  return (await res.json()) as T;
}

export async function findListing(request: APIRequestContext, title: string): Promise<{ id: string; title: string }> {
  const result = await api<SearchResultDto>(request, '/search?place=ari&limit=50');
  const listing = result.items.find((i) => i.title === title);
  if (!listing) throw new Error(`Seeded listing "${title}" not found: run pnpm db:seed`);
  return listing;
}

/**
 * `nights` free nights in a row, starting at a random day 4 to 10 months out, so repeated runs
 * (and leftovers from a failed one) don't collide. With `sameMonth`, the stay doesn't cross a month
 * (the host calendar shows one month).
 */
export async function freeStay(
  request: APIRequestContext,
  listingId: string,
  nights: number,
  opts: { sameMonth?: boolean } = {},
): Promise<{ checkIn: IsoDate; checkOut: IsoDate; nights: IsoDate[] }> {
  const from = addDays(todayInBangkok(), 120 + Math.floor(Math.random() * 180));
  const to = addDays(from, 60);
  const { unavailable } = await api<AvailabilityDto>(request, `/listings/${listingId}/availability?from=${from}&to=${to}`);
  const taken = new Set(unavailable);
  for (let start = from; start < addDays(to, -nights); start = addDays(start, 1)) {
    const run = Array.from({ length: nights }, (_, i) => addDays(start, i));
    const checkOut = addDays(start, nights);
    if (opts.sameMonth && checkOut.slice(0, 7) !== start.slice(0, 7)) continue;
    if (run.every((d) => !taken.has(d))) return { checkIn: start, checkOut, nights: run };
  }
  throw new Error(`No ${nights} free nights between ${from} and ${to}`);
}

/** The guest's live booking for a stay (to find the id the UI just created). */
export async function myBooking(request: APIRequestContext, listingId: string, checkIn: IsoDate): Promise<BookingDto> {
  const mine = await api<BookingDto[]>(request, '/bookings/mine?tab=upcoming');
  const b = mine.find((x) => x.listing.id === listingId && x.checkIn === checkIn);
  if (!b) throw new Error(`No booking found for ${listingId} on ${checkIn}`);
  return b;
}

/** Cleanup: the guest cancels, so the nights are free for the next run. */
export async function cancelAsGuest(request: APIRequestContext, bookingId: string) {
  const res = await request.post(`/api/bookings/${bookingId}/cancel`, { data: { reason: 'E2E test cleanup' } });
  expect(res.ok(), `cancel -> ${res.status()}`).toBe(true);
}
