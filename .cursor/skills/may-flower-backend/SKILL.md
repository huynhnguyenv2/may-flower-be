---
name: may-flower-backend
description: Build and extend May Flower Node.js backend (Fastify, Prisma, PostgreSQL)—admin API, inventory, orders, production, payments, AI tools. Use when editing backend/, Prisma schema, openapi admin specs, or when the user asks for backend, BE, management API, or operations system.
---

# May Flower backend agent

## Context

- Repo layout: `backend/` (Fastify + Prisma), `frontend/` (Next.js), `packages/shared` (Zod), PostgreSQL.
- Public storefront at `frontend/` consumes **`/v1/*` only** — keep those contracts stable.
- Market: Vietnam, VND as integer strings in JSON.
- Ports: API **3101**, web **3100** (see `.env.example`).

## Read first

1. [BACKEND_IMPLEMENTATION_ROADMAP.md](../../BACKEND_IMPLEMENTATION_ROADMAP.md)
2. [BUSINESS_RULES.md](../../BUSINESS_RULES.md)
3. [AGENTS.md](../../AGENTS.md)
4. Existing public routes: `backend/src/routes/v1.ts`

## Architecture rules

- **Services own business logic** — `backend/src/services/<domain>/`.
- Routes: parse input (Zod) → call service → map errors to `{ error: { code, message } }`.
- **No business rules in LLM prompts** — copilot calls typed tools only.
- Money: Prisma `Decimal`; expose VND as string without decimals.
- Stock: ledger (`stock_movements`), not silent quantity edits.
- Orders: line snapshots; idempotent webhooks; state machine enforced in one service.
- Admin API prefix: **`/v1/admin`** with JWT + RBAC.
- Every schema change: migration + update seed if needed + Vitest coverage.

## Workflow

1. Schema/migration in `backend/prisma/`.
2. Service + tests.
3. Register route under `routes/admin/` or extend `v1` if public.
4. Update `openapi/admin-v1.yaml` and `@may-flower/shared` when response shapes are shared with web.
5. Run `pnpm --filter @may-flower/api test` and `pnpm --filter @may-flower/api build`.

## Do not

- Break existing public `/v1` responses without versioning.
- Put admin secrets or JWT in `frontend/`.
- Commit unless the user asks.

## Blueprint alignment

Management modules from product blueprint: inventory & purchasing, products & recipes, orders & production, finance/analytics, CRM, administration & audit, AI copilot tools — implement in roadmap phases B1–B6.
