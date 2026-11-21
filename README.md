# Hongwang

Room rental platform for Bangkok: search rooms near BTS/MRT on a map, request or instant-book,
pay with Stripe (test mode), and run a landlord dashboard. Portfolio project.

- Architecture: [docs/architecture.md](docs/architecture.md) (from the system design whiteboard)
- Modules and ownership: [docs/modules.md](docs/modules.md)
- Roadmap and what to build next: [docs/implementation-plan.md](docs/implementation-plan.md)
- UI designs: [docs/design/](docs/design/) (one `.dc.html` per screen)
- Conventions for contributors and agents: [CLAUDE.md](CLAUDE.md)

## Quick start

Requirements: Node 22, pnpm 11, and either Docker (for `pnpm infra:up`) or Postgres with PostGIS
and Redis installed locally ([Homebrew steps below](#without-docker-homebrew-on-macos)).

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
pnpm infra:up          # Postgres+PostGIS :5433, Redis :6379, Mailpit :8025, MinIO :9000
pnpm db:migrate
pnpm db:seed           # prints the demo accounts and their password
pnpm dev               # web http://localhost:3000, API http://localhost:4000/api (docs at /api/docs)
pnpm --filter @hongwang/api dev:worker   # BullMQ workers: holds, timeouts, emails
```

### Without Docker: Homebrew on macOS

Postgres 18 with PostGIS and Redis run as Homebrew services on their usual ports (Postgres on
:5432, not Docker's :5433, so both setups can coexist). Uploads use the local driver, so no MinIO.

```bash
brew install postgresql@18 postgis redis
brew services start postgresql@18
brew services start redis
createdb hongwang      # as your macOS user, which is a superuser in Homebrew's Postgres
```

Copy `apps/api/.env.example` to `apps/api/.env` and point both database URLs at Homebrew's
Postgres; no password is needed for your own user. The example JWT secrets work for local use.

```bash
DATABASE_URL=postgres://<your-mac-username>@localhost:5432/hongwang
DATABASE_URL_TEST=postgres://<your-mac-username>@localhost:5432/hongwang_test
```

Then the same steps as above, minus `pnpm infra:up`: `pnpm install`, `pnpm db:migrate` (creates the
PostGIS, btree_gist, citext and pg_trgm extensions), `pnpm db:seed`, `pnpm dev`, and the worker. Copying
`apps/web/.env.example` is optional; its values are the defaults. The first
`pnpm --filter @hongwang/api test:e2e` creates `hongwang_test` and migrates it.

Good to know:
- **No mail catcher** in this setup, so the worker's email jobs fail and retry (harmless). Emails
  can still be previewed at http://localhost:4000/api/notifications/dev/preview.
- **`extension "postgis" is not available`**: PostGIS isn't installed for the Postgres version
  that's running. Check `brew services list` and `psql -d hongwang -c 'select version()'`.
- **`brew install postgis` fails to link `thrift`**: another formula owns those files (`fbthrift`
  did on one machine). Run `brew unlink fbthrift`, install, then `brew unlink thrift && brew link fbthrift`.
- **Running `tsc` or `jest` directly inside a package** needs `pnpm --filter @hongwang/shared build`
  first. The root scripts (`pnpm dev`, `typecheck`, `lint`, `test`) build it for you.

## Layout

```
apps/web        Next.js 16 app (guest, host and admin UI)
apps/api        NestJS 11 modular monolith: src/main.ts (HTTP) and src/worker.ts (BullMQ workers)
packages/shared API contract: zod schemas, DTO types, pricing, booking state machine, queues
docs/           architecture, module map, design files
```
