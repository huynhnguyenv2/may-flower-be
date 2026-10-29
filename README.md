# May Flower — Backend

Fastify API + Prisma + MongoDB. Public `/v1` and admin `/v1/admin`. Shared DTOs in `packages/shared/`.

Companion storefront repo: [may-flower-fe](https://github.com/huynhnguyenv2/may-flower-fe).

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

## Docs

- [openapi/public-v1.yaml](./openapi/public-v1.yaml)
- [docs/prompts/BACKEND_AGENT_START.md](./docs/prompts/BACKEND_AGENT_START.md)
