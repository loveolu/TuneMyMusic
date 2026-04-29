# TuneMyMusic

Multi-platform music playlist transfer SaaS. Connect your streaming accounts and move playlists between Spotify, Apple Music, YouTube Music, Tidal, and 7+ others. Freemium with Pro / Unlimited tiers.

---

## Stack

- **Monorepo:** [pnpm](https://pnpm.io/) workspaces + [Turborepo](https://turbo.build/)
- **Web** (`apps/web`): Next.js 14 App Router, React 18, Tailwind, TanStack Query, Zustand, Framer Motion
- **Mobile** (`apps/mobile`): Expo SDK 51, Expo Router 3, NativeWind 4, React Native 0.74
- **Server** (`server/`): Fastify 5, Prisma 6 + PostgreSQL, BullMQ + ioredis, Stripe, Resend
- **Shared packages:**
  - `packages/types` — Zod schemas (auth, playlist, transfer, user, platform)
  - `packages/core` — 11 platform adapters + matching pipeline (ISRC > exact > fuzzy)

---

## Dev quickstart

Requires Node 20+, pnpm 10+, and Docker.

```bash
# 1. Install workspace deps
pnpm install

# 2. Configure environment
cp .env.example .env          # then fill in OAuth keys for the platforms you want to test
                              # (a Spotify dev app is enough to exercise the basic flow)

# 3. Start Postgres + Redis
docker compose up -d

# 4. Push the Prisma schema
pnpm db:push

# 5. Start everything in parallel
pnpm dev                      # turbo runs `dev` in every workspace
```

The web app runs at [http://localhost:3000](http://localhost:3000), the API at [http://localhost:3001](http://localhost:3001), Postgres on `5433`, Redis on `6379`.

To run a single workspace:

```bash
pnpm --filter web dev
pnpm --filter server dev
pnpm --filter mobile dev
```

---

## Testing

| Workspace            | Command                       | Requires                                    |
| -------------------- | ----------------------------- | ------------------------------------------- |
| `packages/core`      | `pnpm --filter @tunemymusic/core test` | Nothing (pure logic)                  |
| `apps/web`           | `pnpm --filter web test`      | Nothing (vitest + jsdom)                    |
| `server`             | `pnpm --filter server test`   | Postgres + Redis (see below)                |

### Server tests (Postgres + Redis required)

The server suite imports `buildApp()` and connects to a real Postgres + Redis at boot. Easiest way to make that work locally:

```bash
docker compose -f docker-compose.test.yml up -d   # ephemeral test DB on :5434, Redis on :6380
pnpm --filter server prisma db push                # apply schema to the test DB
DATABASE_URL=postgresql://tunemymusic:tunemymusic@localhost:5434/tunemymusic_test \
REDIS_URL=redis://localhost:6380 \
  pnpm --filter server test
docker compose -f docker-compose.test.yml down -v
```

For CI / parallel runs, prefer [`testcontainers-node`](https://node.testcontainers.org/) — it spins up per-suite ephemeral containers and avoids shared-state flakiness. Add it to `server/devDependencies` and adapt `server/tests/setup.ts` to spawn the containers in `beforeAll`. There's a sketch in `docker-compose.test.yml`.

---

## Deploy

This is **not** Vercel-friendly end-to-end: BullMQ workers need long-running processes (no serverless). A reasonable shape:

| Component            | Where                         | Why                                            |
| -------------------- | ----------------------------- | ---------------------------------------------- |
| `apps/web`           | Vercel                        | Standard Next.js host, $0 hobby tier           |
| `server` + workers   | Fly.io / Railway / Render     | Persistent process, ~$10–25/mo                 |
| Postgres             | Managed (Supabase / Neon / RDS) | Daily backups, point-in-time recovery        |
| Redis                | Managed (Upstash / Railway)   | Required for BullMQ; persistence not critical |
| Mobile (`apps/mobile`)| EAS Build → App Store / Play | Expo's hosted build pipeline                   |

### Health checks

The server exposes two probes:

- `GET /api/health` — cheap liveness, no DB / Redis touch. Use for k8s liveness.
- `GET /healthz` — readiness; pings Postgres + Redis with 2s timeouts. Returns 503 with a per-component breakdown when degraded. Point your uptime monitor here.

### Graceful shutdown

`server/src/index.ts` handles SIGTERM/SIGINT by:

1. Closing the HTTP listener (in-flight requests finish).
2. Draining BullMQ workers (`worker.close(false)` — active jobs run to completion).
3. Disconnecting Postgres + the Redis health probe.

Hard ceiling defaults to 30s (override with `SHUTDOWN_TIMEOUT_MS`). Set this longer than your platform's SIGKILL timeout if a transfer might legitimately need more time.

### Environment variables

See `.env.example` for the full list. The minimum to run locally is:

- `DATABASE_URL`, `REDIS_URL`
- `JWT_SECRET` (any random string ≥32 chars)
- `ENCRYPTION_KEY` (exactly 64 hex chars; `openssl rand -hex 32`)
- At least one platform's OAuth credentials

For production also set:

- `CORS_ORIGIN` (comma-free, single origin) — defaults to `http://localhost:3000`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`
- `RESEND_API_KEY`
- `LOG_LEVEL` — defaults to `info`; set `debug` for troubleshooting
- `YOUTUBE_DAILY_QUOTA` (default 10 000), `YOUTUBE_QUOTA_SOFT_CAP` (default 9 000)

---

## Repository map

```
apps/
  web/          Next.js 14 marketing + dashboard
  mobile/       Expo Router app (tabs: home, playlists, transfer, stats, settings)
server/
  src/
    routes/     Fastify route modules (auth, transfers, connections, billing, ...)
    services/   Domain logic (transfer-service, billing-service, oauth-state-store, ...)
    workers/    BullMQ workers (transfer, sync, email)
    plugins/    Cross-cutting (rate-limit, auth)
    middleware/ requireAuth, plan-limits
  prisma/       schema.prisma + migrations
  tests/        vitest suite (needs Postgres + Redis)
packages/
  types/        Zod schemas, exported as runtime values + types
  core/         Platform adapters + matching pipeline
docs/
  superpowers/  Design specs and phase plans
```

---

## License

MIT — see [LICENSE](./LICENSE)
