# Modules: ownership and status

Each module is a vertical slice: its NestJS module, its web routes and components, and its part of
the shared contract in `packages/shared/src/schemas/<module>.ts`.

| Module | API (`apps/api/src/modules`) | Web routes (`apps/web/src/app`) | Design boards | Status |
|---|---|---|---|---|
| **Auth & Accounts** | `auth/`, `users/` | `(auth)/login`, `(auth)/reset-password`, `(auth)/verify-email`, `(guest)/account`, `src/proxy.ts` | A4, B6 | MVP: built, unit-tested; not yet run against a database |
| **Listings & Search** | `listings/`, `search/`, `saved/` | `(guest)/page.tsx` (= search), `(guest)/search`, `(guest)/rooms/[id]`, `(guest)/saved` | A1, A2, B5 | MVP: built, unit-tested; not yet run against a database |
| **Bookings & Payments** | `bookings/`, `payments/` | `(checkout)/checkout/[bookingId]`, `(guest)/trips`, `(guest)/trips/[bookingId]`, `components/booking/*` | A3, B1, B2 (+ A2 reserve card) | MVP: built, unit-tested; not yet run against a database |
| **Host Dashboard** | `host/` | `host/(main)/*`, `host/(focused)/*` | C1–C6 | MVP: built, unit-tested; not yet run against a database |
| **Notifications & Workers** | `notifications/`, worker wiring | `components/account/notification-preferences.tsx` | B6 (notifications table) | MVP: built, unit-tested; not yet run against a database |
| Inbox / chat with contact masking | `messages/` | `(guest)/inbox/[threadId]` | B3 | Phase 2 |
| Double-blind reviews | `reviews/` | `(guest)/trips/[bookingId]/review` | B4 | Phase 2 |
| Earnings and payouts (Connect) | `payouts/` | `host/(main)/earnings` | C7 | Phase 2 |
| Admin console (KYC, moderation, disputes, users, audit) | `admin/` | `admin/*` | D1 | Phase 2 |
| Monthly stays | `bookings/` + `billing/` | — | — | Differentiator |

## Cross-module seams (keep these stable)

- `BookingReadService.findDtos / findDto` (bookings) is used by the host module.
- `NotificationsService.sendEmail(EmailJob)` (notifications) is used by auth and bookings.
- `<ReserveCard listing initialCheckIn initialCheckOut initialGuests />`
  (`apps/web/src/components/booking/reserve-card.tsx`, bookings) is rendered on the listing page (listings).
- `<NotificationPreferences />` (`apps/web/src/components/account/notification-preferences.tsx`,
  notifications) is rendered on the account page (auth).
- `useSession()` (`apps/web/src/lib/auth/session.ts`) is used by every header.
- Queue names and job payloads: `packages/shared/src/queues.ts`.
