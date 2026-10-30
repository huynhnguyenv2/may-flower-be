# May Flower — Backend

Fastify API + Prisma + MongoDB. Public `/v1` and admin `/v1/admin`. Shared DTOs in `packages/shared/`.

Storefront: sibling [`../may-flower-fe/`](../may-flower-fe/) · GitHub [may-flower-fe](https://github.com/huynhnguyenv2/may-flower-fe). Planning docs: [`../`](../) (workspace root).

## Prerequisites

- Node.js 20+
- pnpm 9+
- Docker (MongoDB) or MongoDB Atlas

## Setup

```bash
pnpm install
pnpm db:up
cp .env.example backend/.env
pnpm --filter @may-flower/shared build
pnpm db:push
pnpm db:seed
```

## Development

```bash
pnpm dev
```

- API: http://localhost:3101/v1
- Health: http://localhost:3101/health
- Admin login: `POST /v1/admin/auth/login` (seed: `owner@mayflower.vn` — see `ADMIN_SEED_PASSWORD` in `.env.example`)

## Tests

```bash
pnpm test
```

## Deploy on Render

**Use a Web Service — not a Static Site.** Static Site expects a `build/` publish folder; this API is Node (Fastify).

| Setting | Value |
|--------|--------|
| **Root Directory** | `.` (repo root) |
| **Build Command** | `pnpm install --frozen-lockfile && pnpm build` |
| **Start Command** | `pnpm start` |
| **Publish Directory** | *(leave empty — not used)* |

**Environment variables:** `DATABASE_URL` (MongoDB Atlas `mongodb+srv://...`), `JWT_SECRET`, `PAYMENT_MODE=dev_skip`, `ADMIN_SEED_*`.

After first deploy, from your machine (with Atlas reachable):

```bash
DATABASE_URL="mongodb+srv://..." pnpm db:push
DATABASE_URL="mongodb+srv://..." pnpm db:seed
```

Health check: `https://<service>.onrender.com/health` → `{"ok":true}`.  
Public API base: `https://<service>.onrender.com/v1` → set as `NEXT_PUBLIC_API_URL` on Vercel.

Optional: import repo via **`render.yaml`** (Blueprint) in this repo.

## Docs

- [openapi/public-v1.yaml](./openapi/public-v1.yaml)
- [docs/prompts/BACKEND_AGENT_START.md](./docs/prompts/BACKEND_AGENT_START.md)
