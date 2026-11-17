# Hongwang architecture

Source of truth: the system design whiteboard (https://claude.ai/artifact/EEDC2o3hTRTPfWTqfm4wuq)
and the UI design canvas (https://claude.ai/code/artifact/6e7f1a95-c9c0-4241-93c6-5c11222c096c, copied to `docs/design/`).

> One monolith, one constraint, zero double bookings.

## System

```
 Next.js app (apps/web) ──/api rewrite──▶ NestJS API (apps/api, src/main.ts) ──▶ PostgreSQL (PostGIS + btree_gist)
        │                                     │            │
        │ photos, presigned PUT               │            └──▶ Stripe (test mode): PaymentIntents, webhooks, Connect payouts
        ▼                                     ▼
 Object storage (R2 / MinIO / local)      Redis (cache + BullMQ) ──▶ Workers (apps/api, src/worker.ts)
                                                                     holds, request timeouts, emails, payouts
```

- **Next.js app**: SSR for listings and search, client components with TanStack Query for dashboards.
  The browser only talks to the Next origin; `/api/*` is rewritten to the API so the httpOnly
  session cookies are first-party.
- **NestJS API**: a modular monolith. Each module under `apps/api/src/modules` is a bounded context
  (auth, users, listings, search, saved, bookings, payments, host, notifications). One deploy.
- **Workers**: the same codebase, separate entrypoint (`src/worker.ts` + `WorkerModule`), consuming
  BullMQ queues. HTTP code only produces jobs.
- **PostgreSQL**: PostGIS for map search, an exclusion constraint for availability, Drizzle ORM.
- **Stripe** in test mode. Without keys, a simulated payment path runs the same confirmation code.

## Booking lifecycle

```
requested ──host approves──▶ payment_hold ──webhook: paid──▶ confirmed ──after check-out──▶ completed
 (host has 24h)               (15-min TTL)                    (dates locked)                (payout, then reviews)
   │                             │                               │
   └─reject / 24h─▶ rejected     └─15 min─▶ expired              └─cancel─▶ cancelled (refund per policy)
       or expired (no charge)                (no charge)
Instant book: create directly in payment_hold.
```

`payment_hold`, `confirmed` and `completed` hold the dates. The database enforces it:

```sql
EXCLUDE USING gist (listing_id WITH =, stay WITH &&)
  WHERE (status IN ('payment_hold','confirmed','completed'))
```

The transition table is `packages/shared/src/booking-state.ts`. Timeouts are delayed BullMQ jobs
plus a once-a-minute sweep as a safety net.

## Who does what (CASL, `apps/api/src/authz/ability.ts`)

| Action | Guest (signed out) | Tenant | Landlord | Admin |
|---|---|---|---|---|
| Search, view listings | ✓ | ✓ | ✓ | ✓ |
| Request or instant-book | — | ✓ not own room | — | — |
| Pay or cancel pending booking | — | own | — | — |
| Create, edit, price, block dates | — | — | own | moderate any |
| Approve or reject requests | — | — | own listings | — |
| Cancel confirmed booking | — | own, policy refund | own, full refund | any |
| Message | — | own threads | own threads | read in disputes |
| Review after stay | — | rates landlord | rates tenant | can hide |
| Earnings and payouts | — | — | own | all |
| Verify KYC, suspend | — | — | — | ✓ |
| Disputes, forced refunds | — | can open | can open | decides |

One account type: tenant and landlord are relationships (`bookings.guest_id`, `listings.host_id`),
not roles. `users.role` is only `user` or `admin`.

## Key decisions

- **Constraint, not Redis lock**: the EXCLUDE constraint is checked at commit, so no code path can forget to lock.
- **Modular monolith**: one deploy, NestJS modules as bounded contexts. Split later only if needed.
- **Postgres, not Elasticsearch**: PostGIS for map search, NOT EXISTS for availability. No dual-write drift.
- **Ownership, not roles**: CASL checks hostId and guestId; admin is the only global role.

## Scope

- **MVP**: auth, listings with photos, map and date search, request-to-book + Stripe checkout,
  state machine with no double bookings, email notifications, landlord dashboard,
  test: 50 parallel bookings, exactly 1 wins.
- **Phase 2**: chat with contact masking, double-blind reviews, cancellation policies,
  admin KYC and moderation queue, Stripe Connect payouts.
- **Differentiator, monthly stays**: same daterange model with longer ranges, recurring invoices via
  BullMQ repeatable jobs, electricity and water billed per meter unit.

## Money and dates

- Money is integer **satang** everywhere (`packages/shared/src/money.ts`). Format with `formatTHB`.
- Stay dates are `YYYY-MM-DD` in Asia/Bangkok; a stay is `[checkIn, checkOut)`.
- Pricing (`quoteStay`): guest service fee 10% of nights + cleaning, host fee 5% of nights,
  weekly discount from 7 nights. Cancellation refunds: `guestRefund` / `hostCancellationRefund`.
