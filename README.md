# Hongwang

Room rental platform for Bangkok: search rooms near BTS/MRT on a map, request or instant-book,
pay with Stripe (test mode), and run a landlord dashboard. Portfolio project.

- Architecture: [docs/architecture.md](docs/architecture.md) (from the system design whiteboard)
- Modules and ownership: [docs/modules.md](docs/modules.md)
- Roadmap and what to build next: [docs/implementation-plan.md](docs/implementation-plan.md)
- UI designs: [docs/design/](docs/design/) (one `.dc.html` per screen)
- Conventions for contributors and agents: [CLAUDE.md](CLAUDE.md)

## Quick start

Requirements: Node 22, pnpm 11, and either Docker (for `pnpm infra:up`) or local PostgreSQL with
PostGIS, Redis and an SMTP catcher.

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

## Layout

```
apps/web        Next.js 16 app (guest, host and admin UI)
apps/api        NestJS 11 modular monolith: src/main.ts (HTTP) and src/worker.ts (BullMQ workers)
packages/shared API contract: zod schemas, DTO types, pricing, booking state machine, queues
docs/           architecture, module map, design files
```
