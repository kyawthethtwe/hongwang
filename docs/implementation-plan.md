# Hongwang implementation plan

The roadmap from the finished foundation to launch and beyond. Work through the milestones in
order unless a milestone says it can run in parallel. Tick boxes (`- [x]`) as tasks land, and
update the status column in `docs/modules.md` when a module ships.

Sources of truth:
- System design whiteboard: https://claude.ai/artifact/EEDC2o3hTRTPfWTqfm4wuq (summarised in `docs/architecture.md`)
- UI designs: `docs/design/*.dc.html` (board → route map in `docs/design/canvas.json`)
- Conventions: `CLAUDE.md`. Module ownership: `docs/modules.md`

**Library first.** Before writing custom code, look for a maintained library that already does the
job, and use it. Write custom code only for what is specific to Hongwang (the booking rules,
pricing, the screens), or when the review in P0 shows the library costs more than it saves.

---

## 1. Where we are

The foundation and the five MVP modules are built and were verified on 2026-11-17 against a real
Postgres 18 + PostGIS 3.7 and Redis 8.

| Area | State |
|---|---|
| Monorepo, shared contract, DB schema + migrations, seed | Done |
| Auth & Accounts (A4, B6) | Done: email, phone code, reset, sessions, account page |
| Listings & Search (A1, A2, B5) | Done: PostGIS map search, listing page, saved, listing + photo API |
| Bookings & Payments (A3, B1, B2) | Done: state machine, reserve card, simulated + Stripe checkout, trips, cancellation refunds |
| Host Dashboard (C1–C6, basic C7) | Done: Today, listings, 8-step editor, calendar, reservation, onboarding (ID and payouts stubbed) |
| Notifications & Workers | Done: 13 email templates, email worker, preferences, booking timeouts + sweep |
| Tests | 452 API unit tests, 6 shared tests, 7 DB e2e tests including "50 parallel bookings, exactly 1 wins" |
| Not built | Inbox (B3), Reviews (B4), Earnings/payouts (C7), Admin console (D1), monthly stays |

Placeholders shown as "coming soon" in the UI: Message host/guest, Ask to change dates, Send special
offer, Report a problem, Download receipt (PDF), Request data download, ID document upload,
Stripe payouts setup.

---

## 2. Definition of done (every module)

A module or feature is done when all of these hold:

- [ ] **Library first**: before custom code, checked for a maintained library (section 4 criteria); the choice is noted in the PR.
- [ ] **Contract**: request schemas and response DTOs in `packages/shared/src/schemas/<module>.ts`, route list in the header comment.
- [ ] **Data**: tables in `apps/api/src/database/schema/`, generated migration (`pnpm db:generate --name=<what>`), hand-written SQL (constraints, triggers) in a `--custom` migration, seed data for the demo.
- [ ] **Authorization**: CASL rules in `src/authz/ability.ts` that match the whiteboard role matrix; no hand-rolled role checks.
- [ ] **API**: NestJS module with DTOs via `createZodDto`, `AppException` error codes, unit tests for the rules (`*.spec.ts`).
- [ ] **DB tests**: e2e tests in `apps/api/test/` for every constraint, race or SQL query that unit tests can't prove.
- [ ] **Jobs**: producers enqueue on `QUEUES.*`; consumers live in the module's `*.worker.module.ts`; every handler is idempotent.
- [ ] **Email**: new templates added to `EMAIL_TEMPLATES` + `EmailTemplateData` and rendered in the notifications module.
- [ ] **Web**: pages match their design board, work at phone width, meet the accessibility rules in `CLAUDE.md`, and have loading, empty and error states.
- [ ] **Verified**: `pnpm typecheck`, unit tests and e2e tests are green, both apps build, and the main flow has been clicked through against the local database.
- [ ] **Docs**: `docs/modules.md` status updated; new env vars added to `.env.example`.

---

## 3. Roadmap

| # | Milestone | Design boards | Depends on | Size | Can run in parallel with |
|---|---|---|---|---|---|
| **P0** | **Library-first review of the current code (do this first)** | — | — | S–M | — |
| M0 | Harden the MVP and ship to staging | — | P0 | M | — |
| M1 | Inbox with contact masking | B3 | M0 | L | M2 |
| M2 | Double-blind reviews | B4 | M0 | M | M1 |
| M3 | Admin console: identity checks, listing moderation, users, audit log | D1, C1 step 2 | M0 | L | M1, M2 |
| M4 | Payouts with Stripe Connect, and disputes | C7, C1 step 3, D1 disputes | M3 | L | — |
| M5 | Monthly stays (differentiator) | needs new designs | M4 | L | — |
| M6 | Product polish backlog | B2, B5, B6, C6 | M1 | M each | anything |
| — | Platform track (CI, observability, security, performance, i18n) | — | — | ongoing | everything |

Production launch gate: **M0 + M3 + M4**. Listing moderation and real KYC must replace
`AUTO_APPROVE_LISTINGS`, and hosts must actually get paid, before real money moves. M1 and M2 are
strongly recommended for launch, since the UI already points at messaging and reviews.

Sizes: S ≈ a day or two, M ≈ about a week, L ≈ two weeks or more, for one developer with agents.

---

## 4. P0 — Library-first review of the current code (do this first)

**Goal:** before building more, check the hand-written code from the foundation against existing
libraries. Replace it where a library saves real time or risk; keep it where the current code is
small, tested and simpler. When every item below has a decision, move on to M0.

### 4.1 How to decide

Use a library when it is:
- **maintained**: a release in the last 6–12 months, issues answered;
- **widely used and trusted**, especially for security-sensitive code (auth, crypto, payments, HTML escaping);
- **permissively licensed** (MIT, Apache-2.0, BSD, ISC);
- **a fit for the stack**: TypeScript types, works with NestJS 11 / Next.js 16 / Drizzle, no lock-in we can't undo;
- **a net saving**: it removes meaningful custom code or risk, without forcing a rewrite bigger than the benefit.

**Keep the custom code** when it is short, covered by tests, and the library would add more
weight, setup or migration than it removes. "Keep" is a fine outcome: the point is a deliberate choice.

For each item: read the current code, try the library in a spike branch if needed, write the
decision (Keep / Replace / Later) and one line of reason in the table, then do the replacements
with the existing tests still green.

### 4.2 Current custom code to review

| # | Area | Current custom code | Library to evaluate | What it would save | Initial lean | Decision |
|---|---|---|---|---|---|---|
| 1 | Auth and sessions | `apps/api/src/modules/auth/*`, `users/sessions.service.ts`, `common/auth.ts` (~650 lines: JWT, refresh rotation, cookies, Google OAuth, guard) | **Better Auth** with its Drizzle adapter (email/password, sessions with revocation, Google, phone-number plugin, rate limits) | Most auth code; also fixes the 15-minute revoked-session gap (M0) | Evaluate: biggest saving, biggest change (its own tables, NestJS integration, `MeDto` mapping) | **Keep**: it fits technically, but requires an email on every user (we're phone-first) and exposes routes we'd have to fence off; the revocation gap is a small guard change. Spike in 4.4 |
| 2 | Phone sign-in codes | `auth/otp.ts`, `auth/sms.service.ts` (log driver only) | **Twilio Verify** (codes, expiry, retries, fraud protection, real SMS), or Better Auth's phone plugin with an SMS sender | OTP storage and rate rules; gives real SMS (M6 item) | Replace when SMS goes live | **Later**: decide with the M6 SMS provider. Our codes are already HMAC'd, rate-limited and have a resend cooldown; Verify adds real SMS and SMS-pumping protection behind `SmsService` |
| 3 | Phone number parsing | regex in `packages/shared/src/schemas/auth.ts`, `apps/web/src/lib/auth/phone.ts` | **libphonenumber-js** | Correct validation and formatting per country; M1 contact masking needs it anyway | Replace | **Replaced** (2026-11-22): `@hongwang/shared/phone`, a separate entry so its ~130 KB metadata loads only on /login and /account. Mobile-only validation (landlines refused), local formats accepted, the API's phone DTOs check real mobiles |
| 4 | Email templates | `notifications/templates/layout.ts`, `parts.ts` and 13 templates (~600 lines incl. HTML escaping), dev preview controller | **React Email** (`@react-email/components` + `render`) | Hand-built table HTML and escaping; comes with a preview server; M1–M5 add about 10 more emails | Evaluate | **Keep**: templates are already typed content blocks (16–50 lines, never HTML), with one escaping point, a plain-text version from the same source, a dev preview route and tests. React Email would add React and JSX to the API and a rewrite for no new capability. Revisit if emails outgrow the blocks (M5 invoices) |
| 5 | Code input | `apps/web/src/components/auth/otp-input.tsx` (106 lines) | **input-otp** | Paste, SMS autofill, focus and accessibility handling | Replace | **Replaced** (2026-11-22): one labelled input drawn as six boxes; pasting the whole SMS keeps just the code |
| 6 | Stay date helpers | `packages/shared/src/dates.ts` (57 lines) | **date-fns** + **@date-fns/tz** (date-fns is already in the web app) | One date library everywhere | Evaluate (small and tested; keep if the swap adds churn) | **Keep**: string and UTC arithmetic on `YYYY-MM-DD`, so no server-timezone bugs (date-fns works on local-time `Date`s and would add two packages to the shared bundle). Direct tests added; they pass under Bangkok and Los Angeles time. date-fns stays for display formatting in the web app |
| 7 | Worker shutdown | `notifications/worker-lifecycle.ts` (64 lines) | `@nestjs/bullmq`'s own shutdown handling | Delete it if the module already closes workers gracefully on SIGTERM | Evaluate | **Keep**: `@nestjs/bullmq` closes workers in `onApplicationShutdown`, the same phase that closes the pg pool and SMTP, with no order between modules, so a running job could lose its connections. Ours drains a phase earlier with a 25 s cap |
| 8 | Date-range click logic | `apps/web/src/components/search/range.ts` | **react-day-picker** `mode="range"` (already used for the calendar) | Duplicate selection logic | Evaluate | **Keep**: react-day-picker already draws it; only the 23-line click rule is ours. Range mode treats a day as selectable or disabled, but a booked night must stay clickable as a check-out day without letting anyone sleep over it |
| 9 | Booking refs | `bookings/booking-ref.ts` | **nanoid** `customAlphabet` | A few lines | Replace (trivial) | **Keep**: 10 tested lines on `crypto.randomInt`; nanoid 6 is ESM-only, so it would need a Jest workaround to save four lines |
| 10 | Web API client | `apps/web/src/lib/api/client.ts` (99 lines: fetch, refresh once, errors) | **ky** (hooks, retry), or **openapi-fetch** + **openapi-typescript** generated from the API's OpenAPI doc | Fetch boilerplate; generated types | Keep (the contract is already shared through zod) | **Replaced with axios** (2026-11-22, owner's call over a Keep recommendation): `apiFetch`/`serverFetch` keep their signatures. The 401 refresh-and-retry is an interceptor, `serverFetch` uses axios's `fetch` adapter so Next.js caching still applies, and storage uploads (`uploadFile`) now report progress. Costs about 60 KB of raw client JS |
| 11 | PostGIS point reading | `database/schema/types.ts` (WKB + GeoJSON parsing) | **wkx**, or select `ST_AsGeoJSON` in queries | A small parser | Keep (small, tested against real PostGIS) | **Keep**: about 40 lines with tests, and it reads both shapes Postgres returns (WKB and relational-query GeoJSON) |
| 12 | Local upload driver | `infra/storage` local HMAC upload controller | MinIO locally, so only the S3 driver remains | One code path less | Keep while there's no Docker locally | **Keep**: local development runs on Homebrew without Docker or MinIO; revisit when staging uses R2 |
| 13 | Google OAuth exchange | `auth/google-oauth.service.ts` (authorize URL, code exchange, ID token) | **arctic** (MIT, OAuth 2.0 clients incl. Google and LINE, PKCE) | Hand-rolled token exchange; LINE Login later without a new client | Evaluate (added after the row 1 spike; likely ESM-only, see 4.4) | **Later**: adopt together with LINE Login, when a second provider makes a shared client pay off. Today it's one provider in about 40 lines, and arctic is ESM-only (Jest workaround). PKCE, which arctic would bring, goes into M0 now (5.2) |

Already on libraries, no action: CASL, `@node-rs/argon2`, `ua-parser-js`, nestjs-zod, `@nestjs/throttler`,
BullMQ, the Stripe and AWS SDKs, nodemailer, react-day-picker, dnd-kit, react-map-gl/MapLibre,
TanStack Query, react-hook-form, nuqs, Radix, sonner.

### 4.3 Libraries to use in upcoming milestones

Start from these instead of writing custom code (each still goes through the 4.1 check):

| Milestone | Need | Library |
|---|---|---|
| M0 | Lint, unit tests, browser tests | typescript-eslint, Vitest + Testing Library, Playwright |
| M0 | Security headers | helmet |
| M1 | Find phone numbers, emails, links in messages | libphonenumber-js (`findPhoneNumbersInText`), linkifyjs |
| M1 | Real-time messages | NestJS `@Sse()` with Redis pub/sub (built in), or socket.io with its Redis adapter |
| M3 | ID document and selfie checks | **Stripe Identity**, instead of building document review (verify Thai ID support first) |
| M3 | Queue dashboard | Bull Board (`@bull-board/nestjs`) |
| M4 | Payouts | Stripe Connect (existing `stripe` SDK) |
| M4 / M6 | CSV export, PDF receipts and tax statements | csv-stringify, `@react-pdf/renderer` |
| M5 | Monthly invoice schedule | BullMQ job schedulers (already installed) |
| M6 | Thai language | next-intl |
| M6 | LINE messages, web push, SMS | `@line/bot-sdk`, web-push, Twilio SDK |
| M6 | Data export zip | archiver |
| Platform | Error tracking | `@sentry/nestjs`, `@sentry/nextjs` |

### 4.4 Row 1 spike: Better Auth (2026-11-22) — decision: Keep

Branch `spike/better-auth` (reference only, not for merge): `better-auth@1.7.27` on our own tables,
a drop-in guard and 8 e2e tests against real Postgres, all green.

**It fits technically.**
- Runs in our CommonJS NestJS build on Node 22, because Node can `require()` ES modules. Jest
  can't until Node 24.9; the branch's `apps/api/jest.esm.js` compiles those packages with swc.
- No community Nest adapter is needed. Mounted on Express at `/api/auth/{*any}` ahead of Nest's
  router, it leaves Nest's JSON body parser and the Stripe webhook's raw body alone.
- It maps onto `users` and `sessions` (plus new `auth_accounts` and `auth_verifications` tables),
  keeps uuid ids, and verifies our existing argon2 hashes.
- It covers today's flows, including the phone sign-up name step and suspension checks, and
  revokes sessions immediately.

**Why we keep the custom code anyway (Hongwang's rules)**
- **Phone-first accounts.** Better Auth requires an email on every user, so phone-only Thai users
  would get placeholder addresses. Every reader of `users.email` would then have to know about
  them: booking emails, Stripe customers, admin search (M3), contact reveal (M1) and data export.
  Placeholders can also be squatted: signing up by email with someone's placeholder address
  blocks that phone number from signing up.
- **Route surface.** It serves about 30 core routes plus plugin routes. For example,
  `/update-user` accepts `image` (our `avatar_url`), which would let any user set an arbitrary
  avatar URL and skip our upload check. Each one has to be found and switched off
  (`disabledPaths`), and checked again on every upgrade (releases come every few days).
- **Our code is stricter where it matters.** We hash refresh tokens and phone codes (Better Auth
  stores both in plain text), detect refresh-token reuse, enforce a 45-second resend cooldown (SMS
  cost and pumping) and keep login timing equal.
- **Copy and language.** The API returns the design's wording. Better Auth's English messages would
  have to be mapped on the web before Thai (M6).
- **The main gain is small without it.** The revocation gap closes with one session lookup in our
  guard (M0, 5.2). CSRF needs an origin check, which is also small.

**Revisit** if the roadmap adds several of LINE Login, passkeys, 2FA or a native app. Until then,
use libraries for the risky parts only: arctic for OAuth (row 13), Twilio Verify for SMS codes
(row 2), libphonenumber-js (row 3) and input-otp (row 5).

**Done when:** every row in 4.2 has a decision, the "Replace" items are merged with tests, typecheck
and builds green, and `CLAUDE.md` reflects any library that changes how modules are written (for
example a new auth library or React Email).

**Status (2026-11-22):** all 13 rows decided: 3 replaced (libphonenumber-js, input-otp, axios), 8 kept,
2 later (Twilio Verify with the M6 SMS provider, arctic with LINE Login). Tests, typecheck and builds
are green, and `CLAUDE.md` notes the separate `@hongwang/shared/phone` entry. P0 is done once branch
`p0/session-revocation` is merged.

---

## 5. M0 — Harden the MVP and ship to staging

**Goal:** the MVP is committed, tested in CI, safe enough to expose, and running on a staging URL
with Stripe test mode.

### 5.1 Repository and tooling
- [x] Initial commit of the foundation; feature branches and PRs from here on.
- [x] Branches (2026-11-22): work goes on short-lived branches off `dev` and merges back into `dev`; `main` is production and only takes merges from `dev` (`CLAUDE.md`, "Branches").
- [x] ESLint (flat config) for `apps/api`, `apps/web` and `packages/shared`, run by `pnpm lint`; fix or suppress the existing findings. Done 2026-11-22: ESLint 9 (eslint-config-next's plugins don't support 10 yet) with typescript-eslint's type-aware rules, shared in `eslint.base.mjs`, plus Next's presets for the web. All 104 findings fixed, or settled with a commented rule choice; `--max-warnings=0`.
- [x] GitHub Actions CI on pushes and pull requests to `dev` and `main`: install, typecheck, lint, unit tests, DB e2e tests (service container `postgis/postgis`), and both production builds. `.github/workflows/ci.yml`; first green runs 2026-11-22 on PR #1 and on `dev` (checks about 1.5 min, DB tests 46 s). No Redis service until a test needs one (today's tests mock the queues). In CI the DB tests fail instead of skipping when the database is missing.
- [x] Local dev doc for Homebrew (Postgres + PostGIS on :5432, Redis) next to the Docker path in `README.md`. Done 2026-11-22 ("Without Docker: Homebrew on macOS"); its steps were run against a scratch database.
- [ ] Optional local mail catcher (Mailpit) so emails can be seen end to end.

### 5.2 Correctness and security
- [x] **Revoked sessions end immediately.** `JwtAuthGuard` currently trusts the access token for its full 15 minutes after sign-out-elsewhere, password change or account deletion. P0 kept the custom auth (4.4), so the guard looks up the token's session on every request (`SessionsService.findActive`: one primary-key read joined to `users`). A revoked or expired session, or a suspended or deleted user, counts as signed out, and the role comes from the database. Chosen over a Redis revocation set: the database is already on every request's path, and there's no Redis-outage case to decide. Add a short Redis cache only if profiling asks for it.
- [ ] **Idempotent booking creation.** `POST /bookings` commits before it reads the DTO; if the read fails, the guest sees an error while the dates are held. Accept an `Idempotency-Key` header on `POST /bookings` and `POST /payments/intent`, and have the reserve card retry safely.
- [ ] **Security headers**: `helmet` on the API; CSP, `frame-ancestors`, `Referrer-Policy` and `Permissions-Policy` on the web app.
- [ ] **CSRF review**: cookies are `SameSite=Lax` and mutations are JSON-only. Confirm the API rejects non-JSON `Content-Type` on mutations, or add a double-submit token.
- [ ] **PKCE for Google sign-in** (found in P0 row 13): add an S256 `code_verifier` to the OAuth state cookie and send `code_challenge` / `code_verifier` in `GoogleOAuthService`, as RFC 9700 recommends even for server-side clients. Test with real Google test credentials.
- [ ] **Rate limits behind the proxy**: confirm `X-Forwarded-For` reaches the API through the Next rewrite in staging so throttling is per visitor; add per-user limits on booking creation.
- [ ] **Deleted accounts**: migrate the `users_email_or_phone` check to allow deleted users with neither email nor phone, and stop writing `deleted+<id>@hongwang.invalid`. Move the "pause listings on account deletion" write into `ListingsService`.
- [ ] **Listing area**: moving the map pin currently overwrites a host-typed `area`; only auto-fill when the host hasn't set one.

### 5.3 Payments
- [ ] Run checkout with real Stripe **test** keys: card (4242…), 3-D Secure test card, and PromptPay; forward webhooks with `stripe listen`.
- [ ] Decide what "Mobile banking" maps to in Thailand (currently treated as card) or hide it.
- [ ] Add a `booking-payment-refunded-late` email for money that arrives after the hold expired (today it is only logged).
- [ ] Webhook replay test: the same event twice changes nothing (`stripe_events`).

### 5.4 Tests
- [ ] DB e2e tests for search (bbox, dates, filters, sort), availability, saved, host calendar blocks (409 path) and special prices.
- [ ] Auth e2e: register, login, refresh rotation, refresh-token reuse, logout, password reset.
- [ ] Web unit tests (Vitest + Testing Library) for pure UI logic: the range calendar click logic (`components/search/range.ts`), search URL params, money formatting.
- [ ] Playwright golden paths against seeded data: guest search → reserve → simulated pay → trip; host approve request → guest pays; host block dates.

### 5.5 Data
- [ ] Seed real sample photos (5+ per listing) so listing pages, cards and the editor's photo step look like the design.
- [ ] Add a few listings outside Ari so search across Bangkok places looks populated.

### 5.6 Staging deployment
- [ ] Environments: `staging` now (deployed from `dev`), `production` at launch (deployed from `main`). Separate Stripe test/live keys, buckets and databases.
- [ ] Deploy web, API and worker (see section 12), run `pnpm db:migrate` as a release step, never on boot.
- [ ] Stripe webhook endpoint, R2 bucket with a public CDN domain, transactional email provider (SMTP), secrets in the host's secret store.
- [ ] Smoke test on staging: the four Playwright golden paths.

**Done when:** CI is green on `main`, staging runs all golden paths with Stripe test mode, and the
security items above are closed.

---

## 6. M1 — Inbox with contact masking (B3)

**Goal:** guests and hosts talk through Hongwang. Phone numbers, emails, LINE IDs and links are
hidden until a booking is confirmed (design B3: "Contact details hidden until the booking is
confirmed"). This unblocks every "Message host/guest" button.

**Data**
- `message_threads`: listing_id, guest_id, host_id, booking_id (nullable), last_message_at, guest_last_read_at, host_last_read_at; unique (listing_id, guest_id).
- `messages`: thread_id, sender_id, body (original), body_masked, has_masked_contact, created_at, reported_at.

**Contact masking**
- A pure `maskContacts(text)` in `packages/shared`: Thai and international phone numbers, emails, LINE IDs ("line: xxx", "@xxx", line.me links), other URLs. Unit-test it heavily, with Thai text.
- The recipient sees `body_masked` until the thread's booking is `confirmed`; the sender sees a hint when something was masked. Admins see the original only inside a dispute.
- Reuse the same detector for listing moderation flags (M3).

**API**: `GET /threads`, `POST /threads` (from a listing or booking), `GET /threads/:id/messages` (cursor), `POST /threads/:id/messages`, `POST /threads/:id/read`, `POST /threads/:id/report`. CASL: thread participants only; admin read in disputes.

**Real time**: start with polling (TanStack Query `refetchInterval`, 5–10 s while the thread is open), then move to Server-Sent Events from the API with Redis pub/sub so it works across API instances.

**Notifications**: a `new-message` email, debounced with a delayed job (one email per thread per 10 minutes) and respecting the `messages` preference. Unread count in the header nav ("Inbox 3" in the design).

**Web**: `/inbox` and `/inbox/[threadId]` (B3): thread list with search, conversation, composer with mask hint, booking context card with its call to action. Wire "Message host/guest" on checkout, trip detail, host dashboard and reservation pages.

**Done when:** a guest can message before booking, can't leak a phone number before confirmation, sees it after, and the host gets an email.

---

## 7. M2 — Double-blind reviews (B4)

**Goal:** after a completed stay, guest and host review each other. Neither sees the other's
review until both have submitted or the window closes (design B4).

**Data**: `reviews`: booking_id, author_id, subject_id, author_role (guest|host), rating (1–5), category ratings jsonb (cleanliness, accuracy, communication, location, check-in, value), public_text, private_note, submitted_at, published_at, hidden_at, hidden_by. Unique (booking_id, author_role).

**Rules**
- The window opens when the booking becomes `completed` and closes 14 days after check-out.
- Publish both when the second is submitted, or at window close (delayed BullMQ job at close). After publish, no edits.
- On publish, recompute `listings.rating_avg` / `review_count` in the same transaction, and keep guest ratings for hosts to see on requests ("★ 4.9 from 3 hosts").
- Admins can hide a review (audit-logged).

**API**: `GET /bookings/:id/review` (my draft and status), `PUT /bookings/:id/review`, `POST /bookings/:id/review/submit`, `GET /listings/:id/reviews` (cursor), admin hide.

**Emails**: review reminder when the window opens and 3 days before it closes; "your review is live".

**Web**: `/trips/[bookingId]/review` (B4) for guests; the host equivalent from the reservation page; real reviews on the listing page (A2) replacing the summary-only section; "Write a review" actions in Trips.

**Done when:** both sides can review, nothing leaks early, ratings on cards update, and the window job publishes on time.

---

## 8. M3 — Admin console (D1): identity checks, listing moderation, users, audit log

**Goal:** a trust and safety team can verify hosts, review listings and manage users, and every
admin action is recorded. Turn `AUTO_APPROVE_LISTINGS` off in production after this.

**Identity checks (KYC)**
- Library first: try **Stripe Identity** (hosted document + selfie capture and checks) before building the review below. If it supports Thai ID cards and passports for this account, store only its verification session id and result, and the admin tab shows its outcome instead of raw documents. Otherwise build:
- `kyc_submissions`: user_id, document_type, front_key, back_key, selfie_key, status (pending|approved|rejected), reject_reasons[], note, reviewer_id, timestamps.
- Files go to a **private** bucket prefix and are only readable through short-lived presigned GET URLs issued to admins; delete them 90 days after approval (repeatable job), as the onboarding copy promises.
- Host onboarding step 2 (C1) uploads real files instead of the current stub.
- Approve → `users.kyc_status = verified`; reject with reasons → host is asked to retake just that photo (email).

**Listing moderation**
- Queue of `in_review` listings with the description diff since the last approval and flags from `maskContacts` (phone numbers, LINE IDs, links) and photo checks.
- Publish (requires host KYC verified) or request changes with a message (stored in `review_note`, emailed to the host).

**Users**: search by name, email or booking ref; suspend/unsuspend (sets `suspended_at`, revokes sessions immediately via the M0 revocation set); view a user's bookings and listings.

**Audit log**: `admin_audit_log` (admin_id, action, target_type, target_id, before/after jsonb, created_at), append-only: a DB trigger rejects UPDATE and DELETE. Every admin endpoint writes one row in the same transaction.

**Web**: `/admin` with tabs Identity checks, Listing reviews, Users, Audit log (D1); admin-only via CASL `manage` and the proxy.

**Ops**: a BullMQ dashboard (Bull Board) mounted under the admin area.

**Done when:** a new host goes through real ID upload → admin approval → listing submitted → admin publishes, with every step in the audit log, and auto-approve is off on staging.

---

## 9. M4 — Payouts with Stripe Connect, and disputes (C7, D1)

**Goal:** hosts get paid 24 hours after check-in, minus Hongwang's 5% fee and any penalties;
guests can report a problem, which holds the payout until support decides.

**Open decision first:** confirm Stripe Connect supports Thai connected accounts receiving THB to
Thai bank accounts for this platform setup. If not, the fallback is a payout provider with Thai
coverage (for example Omise/Opn) behind the same `PayoutsService` interface.

**Payouts**
- Connect Express onboarding from C1 step 3 and the Earnings page ("Manage on Stripe"); `account.updated` webhook keeps `payouts_enabled` in sync.
- `payouts`: host_id, booking_id, amount, status (scheduled|on_hold|released|paid|failed|reversed), release_at (check-in + 24 h), stripe_transfer_id, paid_at.
- `host_ledger_entries`: payout credits, host fees, cancellation penalties (deducted from the next payout, design C6), adjustments. The balance is the sum, never a mutable column.
- Create the payout when a booking is confirmed; a delayed job at `release_at` creates the transfer (separate charges and transfers, `transfer_group` = booking ref), skipped while a dispute is open; cancellation reverses or cancels it.

**Disputes**
- `disputes`: booking_id, opened_by, reason, description, evidence keys, status (open|decided), decision (none|partial|full refund), refund_amount, note to both parties, decided_by.
- Guest "Report a problem" within 24 h of check-in (B2) opens a dispute and puts the payout on hold; the admin Disputes tab (D1) shows the message thread (M1) and evidence and decides; the decision runs a forced refund through `PaymentsService` and releases the remaining payout. Audit-logged.

**Web**: Earnings (C7): summary tiles, Upcoming/Paid tabs, payout account card, CSV export; the 2026 tax statement PDF can follow in M6.

**Done when:** in Stripe test mode a confirmed stay produces a transfer to a test connected account 24 h after check-in (time-travel in tests), and a dispute holds it until an admin decides.

---

## 10. M5 — Monthly stays (differentiator)

**Goal:** "How Bangkok rentals actually work": stays by the month on the same `daterange` model,
with recurring rent invoices and utilities billed per meter unit.

**Design first:** there are no boards for this yet. Design the listing editor's monthly section,
the monthly search toggle and card price, the guest's invoices page and the host's meter-reading
form before building.

**Data**
- Listing: monthly_enabled, monthly_price, deposit_amount, min_months, notice_days, electricity_rate (satang per kWh), water_rate (satang per m³).
- Bookings: `stay_type` (nightly|monthly). Monthly bookings use the same exclusion constraint, so nightly and monthly guests can never overlap.
- `invoices`: booking_id, period_start, period_end, rent, electricity_units, water_units, utilities_amount, total, due_at, status (draft|issued|paid|overdue|void), payment_intent_id.
- `meter_readings`: booking_id, kind (electricity|water), reading, read_at, photo_key.

**Flows**
- Checkout charges the first month and the deposit.
- A BullMQ repeatable job per booking issues each month's invoice: rent at the start of the period, utilities once the host enters meter readings (units = this reading − last reading).
- The guest pays an invoice by card or PromptPay; reminders at due date, and overdue status after a grace period.
- Move-out: notice period, final meter reading, deposit refund minus agreed deductions.

**Done when:** a 3-month stay generates three rent invoices and two utility invoices from meter readings, all payable in Stripe test mode.

---

## 11. M6 — Product polish backlog

Pick these up any time after M1; each is independent.

- [ ] **Change dates** (B2 "Ask to change dates"): alteration requests the host approves, re-pricing and charging or refunding the difference; must re-check the exclusion constraint.
- [ ] **Special offers** (C6 "Send special offer"): host proposes a price for a requested stay.
- [ ] **Receipts PDF** (B2): rendered by the worker, stored privately, emailed and downloadable.
- [ ] **Data export** (B6 "Request download"): worker zips bookings, messages and reviews and emails a link within 48 h.
- [ ] **Price-drop alerts** for saved rooms (B5): daily job comparing prices for the saved dates; respects the `price_drops` preference.
- [ ] **Thai language**: i18n with locale routing; `users.locale` already exists; Thai copy for emails.
- [ ] **Currency estimates** in USD/SGD (display only; payment stays in THB).
- [ ] **LINE notifications** via the LINE Messaging API (preference channel already stored) and **web push**.
- [ ] **SMS provider** for phone codes (Twilio or a Thai provider) behind the existing `SmsService`.
- [ ] **Google sign-in** tested with real credentials.
- [ ] **Compact search pill** in the header on the listing page (A2).
- [ ] **Host response rate** ("Usually replies within an hour") once messaging exists.

---

## 12. Platform track (ongoing)

**Deployment target (recommendation, decide in M0)**
- Web: Vercel. API and worker: one container image, two processes, on Fly.io, Railway or Render.
- Postgres: a managed provider with PostGIS and btree_gist (Neon, Supabase, Crunchy Bridge or RDS).
- Redis: a regular Redis instance (BullMQ polls heavily, so per-command-billed serverless Redis gets expensive).
- Object storage: Cloudflare R2 (whiteboard), public CDN domain for listing photos, private bucket for KYC.
- Email: a transactional provider over SMTP (Postmark, Resend or SES).
- Keep web and API on one site (the `/api` rewrite) so session cookies stay first-party.

**Observability**
- [ ] Error tracking (for example Sentry) in web, API and worker.
- [ ] Health checks for DB and Redis; alert on failed jobs, webhook failures and email bounces.
- [ ] Request ids from pino through to the web app's error pages.

**Performance**
- [ ] `EXPLAIN ANALYZE` the search query with 10k+ listings; tune GIST and partial indexes.
- [ ] Cache popular searches and places in Redis (whiteboard: "Redis: cache + BullMQ").
- [ ] Image pipeline: resized variants and a CDN in front of R2.

**Security and compliance**
- [ ] Dependency audit in CI; secrets rotation plan.
- [ ] Thailand PDPA: consent records, data export (M6) and deletion flows, a retention policy for KYC files and receipts (7 years for tax, per B6 copy).
- [ ] Backups and a tested restore for Postgres.

---

## 13. Known issues from the foundation build

| Issue | Impact | Fix | Milestone |
|---|---|---|---|
| Access token valid up to 15 min after its session is revoked | Signed-out devices keep working briefly | Guard checks the session row on every request (5.2) | M0 |
| `POST /bookings` can commit then fail on the read | Guest sees an error while dates are held | Idempotency key + safe retry | M0 |
| Deleted users keep a placeholder email | Constraint workaround | Relax the check constraint for deleted users | M0 |
| No email for a payment refunded because it arrived late | Guest isn't told | New template | M0 |
| Emails skipped by preferences aren't logged | Harder to debug | Add `skipped` to `email_status` | M0 |
| `email_log.job_id` has no index | Slow lookups at scale | Add index | M0 |
| Moving the map pin overwrites a typed `area` | Host's text lost | Only auto-fill when empty | M0 |
| Calendar drag-select works with a mouse only | Touch users select one night at a time | Pointer events | M6 |
| Web app has no test runner | UI logic untested | Vitest + Playwright | M0 |
| Seed listings have no photos | Pages look empty; can't resubmit seeded listings | Seed sample photos | M0 |

---

## 14. Open decisions

- Payout provider for Thailand (Stripe Connect vs. a local provider) — before M4.
- Hosting providers — during M0.
- Real-time transport for chat: polling → SSE (recommended) or WebSockets — during M1.
- Review window length (14 days assumed) and the deadline copy in B4 — during M2.
- Monthly stays: deposit rules, notice period, utility rates, invoice timing — before M5, with designs.
