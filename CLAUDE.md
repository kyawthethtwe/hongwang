# Hongwang

Room-rental platform for Bangkok (portfolio project). Read `docs/architecture.md` first, then
`docs/modules.md` for who owns what. UI designs are in `docs/design/*.dc.html` (one file per screen;
`docs/design/canvas.json` maps each board to its route).

What to build next, in order, with the definition of done for every module:
`docs/implementation-plan.md`. Tick its boxes as tasks land.

## Stack

- pnpm workspaces + Turborepo. Node 22. TypeScript 5.9 (pinned, don't upgrade to 7).
- `packages/shared`: the API contract. Zod 4 request schemas, response DTO interfaces, enums,
  pricing, cancellation, booking state machine, queue payloads. Built with tsup; run
  `pnpm --filter @hongwang/shared build` after changing it. The root entry ends up in every web
  page, so heavy helpers get their own entry: `@hongwang/shared/phone` (libphonenumber-js) is the
  example (tsup `entry`, `exports` and `typesVersions` in its package.json).
- `apps/api`: NestJS 11 (pinned to 11: nestjs-zod needs it), Drizzle ORM + node-postgres,
  PostgreSQL with PostGIS + btree_gist, BullMQ 5 on Redis, CASL, Stripe, nestjs-zod, nestjs-pino.
- `apps/web`: Next.js 16 App Router (Turbopack; `src/proxy.ts` replaces middleware; `params` and
  `searchParams` are Promises), React 19, Tailwind CSS 4, Radix primitives via `radix-ui`,
  TanStack Query 5, react-hook-form + zod, nuqs for URL state, MapLibre via react-map-gl,
  lucide-react icons, sonner toasts, Stripe Elements.

## Commands

```bash
pnpm install
pnpm infra:up                      # docker compose: postgis, redis, mailpit
pnpm db:migrate && pnpm db:seed    # seeded password is printed by the seed
pnpm dev                           # web :3000, api :4000 (+ `pnpm --filter @hongwang/api dev:worker`)
pnpm typecheck                     # all packages
pnpm lint                          # ESLint, all packages (type-aware rules in eslint.base.mjs); CI runs it too
pnpm --filter @hongwang/api test   # unit tests (jest + swc)
pnpm --filter @hongwang/api test:e2e  # needs DATABASE_URL_TEST (Postgres with PostGIS)
```

## Conventions

### Branches
- `dev` is where development happens. Each piece of work gets a short-lived branch off `dev`
  (e.g. `feat/inbox`, `fix/listing-area`, `docs/...`, `chore/...`) that merges back into `dev`;
  don't commit to `dev` directly.
- `main` is production. It only changes by merging `dev` into it; never commit to `main` directly.
- Staging deploys from `dev`, production from `main` (implementation plan, M0 5.6).

### Commits
- Conventional Commits: `type(scope): summary`, imperative, starting lower case, no trailing period,
  e.g. `feat(web): add the inbox thread list`, `fix(api): keep a host-typed listing area`.
  Types: `feat`, `fix`, `docs`, `refactor`, `test`, `perf`, `build`, `ci`, `chore`, `style`, `revert`.
  The scope is optional: an area (`api`, `web`, `shared`, `infra`, `ci`, `deps`) or a module (`bookings`).
- commitlint (`commitlint.config.mjs`, `@commitlint/config-conventional`) checks every commit through
  the husky `commit-msg` hook, which `pnpm install` sets up, and in CI on pull requests into `dev`.

### Contract first
- Every endpoint's request schema and response type lives in `packages/shared/src/schemas/*.ts`,
  with the route list in that file's header comment. Web and API both import from `@hongwang/shared`.
- API DTO classes: `class CreateBookingDto extends createZodDto(createBookingInputSchema) {}`
  (nestjs-zod). The global `ZodValidationPipe` validates bodies, queries and params.

### API
- Global prefix `/api`. Every route requires a session unless decorated `@Public()` or
  `@OptionalAuth()` (`src/common/auth.ts`). Get the caller with `@CurrentUser() user: AuthUser`.
- Authorization is CASL ownership: `const ability = this.abilities.for(user); assertCan(ability, 'update', 'Listing', row)`
  (`src/authz/ability.ts`). Never check `role === 'admin'` by hand outside it.
- DB: `constructor(@InjectDb() private readonly db: Database)`; transactions with
  `this.db.transaction(async (tx) => ...)`. Schema in `src/database/schema/*`. Add tables there, then
  `pnpm db:generate --name=<what>`; hand-written SQL (constraints, extensions) goes in a
  `drizzle-kit generate --custom` migration.
- Errors: throw `AppException(status, ERROR_CODES.x, message)` or helpers `notFound()`, `forbidden()`,
  `conflict()` from `src/common/errors.ts`. Postgres exclusion violations become 409 `DATES_UNAVAILABLE`
  automatically.
- Env: `@Inject(ENV) private readonly env: Env` (`src/config/env.ts`). Add new vars to the schema and
  to `.env.example`.
- Photo storage: `STORAGE_DRIVER=local` (disk) in development, `s3` (Cloudflare R2) in staging and
  production; `loadEnv` refuses `local` when `NODE_ENV=production`. docker-compose has no object storage.
- Queues: produce with `@InjectQueue(QUEUES.x)`. `@Processor` classes go in the module's
  `*.worker.module.ts`, imported only by `src/worker.module.ts`.
- Email: `NotificationsService.sendEmail({ template, to, data })`. Never send mail inline.
- Money in satang (integers). Dates as `YYYY-MM-DD` strings. Never floats for money.
- Tests: `*.spec.ts` next to the code (jest + @swc/jest). DB-backed tests go in `apps/api/test/`.

### Web
- Talk to the API with `apiFetch` (client, `src/lib/api/client.ts`) or `serverFetch`
  (server components, `src/lib/api/server.ts`). Paths are relative to `/api`, e.g. `apiFetch('/bookings')`.
  Both run on axios and throw `ApiError`; `serverFetch` goes through axios's `fetch` adapter, so pass
  Next.js caching as its `revalidate` option. PUT files to storage with `uploadFile`
  (`src/lib/api/upload.ts`), which reports progress. Don't call `fetch` or `axios` directly.
- Data fetching with TanStack Query; keep query keys in the module's `queries.ts`
  (e.g. `src/lib/queries/bookings.ts`).
- Use the design tokens in `src/app/globals.css` (`bg-brand`, `text-ink`, `text-muted`, `border-line`,
  `rounded-card`, `bg-canvas`, `bg-warn-bg` ...). Don't hard-code hex values in components.
- UI kit in `src/components/ui/`: `Button`, `Input`, `Textarea`, `Select`, `Field`, `Checkbox`,
  `Radio`, `RadioCard`, `Badge`, `Banner`, `Skeleton`, `EmptyState`, `Card`, `Stat`, `PageTitle`,
  `Avatar`, `Chip`, `PhotoPlaceholder`, `Dialog`, `Tabs`, `DropdownMenu*`. Extend it instead of
  restyling ad hoc.
- Headings use `font-display` (Bricolage Grotesque); body is Inter.
- Accessibility as in the design: real `<button>`/`<a>`/`<label>`, 44px touch targets,
  `aria-label` on icon-only buttons, `aria-pressed` on toggles, `role="status"`/`"alert"` on banners.
- Pages must work at phone width (stack columns, wrap toolbars, scroll wide tables in a box).

### Dependencies
- **Library first.** Before writing custom code, look for a maintained, widely used, permissively
  licensed library that fits the stack, and use it. Write custom code only for Hongwang-specific
  logic, or when the library costs more than it saves. The criteria and the review of existing code
  are in `docs/implementation-plan.md` (section 4, P0); note the choice in the PR.
- Add packages one at a time with `pnpm --filter <app> add <pkg>`, and never while other agents are
  working in the repo (lockfile races).
