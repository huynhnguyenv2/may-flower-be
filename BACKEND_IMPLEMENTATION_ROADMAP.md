# Backend implementation roadmap

Extend **`backend/`** into the single source of truth for May Flower (Vietnam). Public web stays a client.

## Phase B0 — Foundation (week 1)

| Task | Deliverable |
|------|-------------|
| Full Prisma schema | Flowers, materials, suppliers, batches, stock_movements, reservations, waste, bouquet_recipes, recipe_items, staff User + Role, audit_events |
| Auth | `POST /v1/admin/auth/login`, JWT access + refresh, password hash (argon2) |
| RBAC middleware | Roles: `owner`, `manager`, `florist`, `delivery`; deny by default |
| OpenAPI | `openapi/admin-v1.yaml` + error shape same as public |
| Health & config | `.env.example`: `JWT_SECRET`, `DATABASE_URL`, `API_PORT=3101` |

**Exit:** Staff can log in; unauthorized admin routes return 401/403.

## Phase B1 — Catalog & ATP (week 1–2)

| Task | Deliverable |
|------|-------------|
| Admin product CRUD | Products, variants, collections, emotional tags, images URL |
| Recipe model | Bouquet recipe + items; computed cost/margin service |
| Availability service | ATP = physical − reserved; sync `ProductVariant.availableQuantity` from ledger or computed view |
| Public API | Ensure `/v1/products` reflects ATP after stock changes |

**Exit:** Changing stock in admin updates storefront availability.

## Phase B2 — Inventory & purchasing (week 2)

| Task | Deliverable |
|------|-------------|
| Suppliers, POs | Create/receive PO; link to batches |
| Batches & movements | IN, OUT, WASTE, ADJUST; never silent overwrite |
| Reservations | Tie to order lines on confirm; release on cancel |

**Exit:** Trace any variant ATP to movements and orders.

## Phase B3 — Orders & production (week 2–3)

| Task | Deliverable |
|------|-------------|
| Order inbox | Filters: status, date, channel (`web`, `manual`) |
| State machine | Enforce transitions; production_tasks, florist_assignments, quality_checks |
| Manual orders | Staff-created orders same schema as web |
| Delivery | Assign delivery status; slot capacity already on public create |

**Exit:** Web order appears in admin; staff can progress to `delivered`.

## Phase B4 — Payments & notifications (week 3)

| Task | Deliverable |
|------|-------------|
| VNPay / MoMo / ZaloPay | One provider first; webhook idempotency table (extend existing) |
| Email/SMS stub | Order confirmed template; config-driven |

**Exit:** Real payment path replaces `PAYMENT_MODE=dev_skip` in staging.

## Phase B5 — CRM & finance (week 4)

| Task | Deliverable |
|------|-------------|
| Customers | Merge guest customers; recipients, occasions, consents |
| Reports | Revenue, margin by product (estimated from recipes), low-stock list |

**Exit:** Owner can answer “top margin bouquets this month” from API data.

## Phase B6 — AI copilot tools (week 4–5)

| Task | Deliverable |
|------|-------------|
| Tool registry | Typed functions: `get_sales_summary`, `get_available_inventory`, `draft_purchase_order`, etc. |
| Permission tiers | read / draft / execute with audit |
| LLM adapter | OpenAI-compatible tool calling; **no** raw SQL from model |

**Exit:** Copilot answers from verified data; drafts require staff approval.

## Phase B7 — Management UI (optional separate agent)

Rails or Next admin app consuming `/v1/admin/*` — out of scope for backend agent unless requested.

## Testing checklist

- [ ] Public order + idempotency replay
- [ ] Stock reserve/release on confirm/cancel
- [ ] RBAC on every admin route
- [ ] Recipe cost matches manual calculation fixture
- [ ] Webhook duplicate event does not double-charge or double-reserve

## File layout (target)

```
backend/src/
  routes/
    v1.ts              # public (existing)
    admin/             # staff routes
  middleware/
    auth.ts
    rbac.ts
  services/
    catalog.ts         # extend
    inventory/
    orders/
    production/
    finance/
    ai-tools/
  jobs/                # optional: BullMQ later
```
