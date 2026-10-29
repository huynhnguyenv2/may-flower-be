# Backend agent — copy into a new Cursor chat

Paste everything below the line into a **new Agent chat** (separate from the storefront chat).

---

You are the **May Flower backend agent**. Build and extend the Node.js backend so it handles **all business operations** for a premium flower studio in Vietnam, while keeping the existing public storefront working.

## Repository

`/Users/neilpham/Documents/Learning/Rubify/may-flower` — pnpm monorepo:

- `backend/` — Fastify + TypeScript + Prisma + PostgreSQL (port **3101**, prefix `/v1` public today)
- `frontend/` — Next.js public site (port **3100**); **do not** move business logic here
- `packages/shared` — Zod schemas shared with web
- Planning: root `*.md`, blueprint `AI_Flower_Shop_Product_Blueprint_EN.docx`

## What already exists (public MVP)

Public routes in `backend/src/routes/v1.ts`: collections, products, concierge (rule-based), delivery zones/slots, guest orders + idempotency, payment webhook stub.

Prisma models: Collection, Product, ProductVariant, orders, customers, delivery, ConciergeSession, PaymentWebhookEvent.

**Gap:** No auth, no inventory ledger, no recipes, no production, no admin API, no real payments, no AI tool layer.

## Your mission

Implement the **full backend** per [BACKEND_IMPLEMENTATION_ROADMAP.md](../../BACKEND_IMPLEMENTATION_ROADMAP.md) and blueprint management modules (inventory, recipes, orders/production, finance basics, CRM, admin/RBAC, audit).

**Stack (fixed):** Extend `backend/` — do not introduce Rails or a second backend unless explicitly requested.

**API layout (target):**

- `GET/POST /v1/*` — public storefront (keep backward compatible)
- `GET/POST/PATCH /v1/admin/*` — staff/management (JWT + RBAC)
- `POST /v1/internal/ai/tools/*` or in-process tool registry for copilot (phase 3)

## Non-negotiables

1. Read `BUSINESS_RULES.md`, `DATA_MODEL.md`, and roadmap before large schema changes.
2. Stock: auditable **stock_movements** ledger; ATP for website; reserve on confirmed order; release on cancel.
3. Orders: explicit status machine; order line **snapshots**; idempotent payment webhooks.
4. All admin mutations **audited** (who, what, when).
5. Update `openapi/` and `@may-flower/shared` schemas when contracts change.
6. Tests: Vitest + Fastify inject for each new critical path.

## First sprint (do this first)

1. Expand `DATA_MODEL.md` → full ERD in Prisma (inventory, recipes, staff users, roles, audit).
2. Migrations + seed extensions (sample flowers, materials, one recipe, staff user).
3. Auth: login, refresh, role middleware (`owner`, `manager`, `florist`, `delivery`).
4. Admin CRUD: products/variants, collections, zones/slots config.
5. Order inbox: list/filter website orders; transition status (staff).
6. Document new endpoints in `openapi/admin-v1.yaml`.

Report: assumptions, files changed, migrations, tests run, risks.

Do not commit unless I ask. Match existing code style in `backend/src/services/`.
