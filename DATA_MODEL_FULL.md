# Data model — full platform (backend target)

Superset of [DATA_MODEL.md](./DATA_MODEL.md). Backend agent implements this in Prisma incrementally.

## Staff & security

| Entity | Notes |
|--------|--------|
| `User` | email, passwordHash, name, active |
| `Role` | owner, manager, florist, delivery |
| `UserRole` | M2M |
| `AuditEvent` | actorId, action, entityType, entityId, payload, ip |

## Catalog (extend existing)

| Entity | Notes |
|--------|--------|
| `Flower` | variety, unit, default shelf life |
| `Material` | wrapping, ribbon, card, greenery |
| `BouquetRecipe` | productId, version, active |
| `RecipeItem` | flower/material id, quantity |

## Inventory

| Entity | Notes |
|--------|--------|
| `Supplier` | contact, terms |
| `PurchaseOrder` / `PurchaseOrderLine` | status, received qty |
| `InventoryBatch` | flower/material, lot, expiry, unit cost |
| `StockMovement` | type IN/OUT/RESERVE/RELEASE/WASTE/ADJUST, batchId, ref |
| `StockReservation` | orderItemId, quantity, status |
| `WasteRecord` | reason, batch, qty |

## Production

| Entity | Notes |
|--------|--------|
| `ProductionTask` | orderId, scheduledAt, status |
| `FloristAssignment` | taskId, userId |
| `QualityCheck` | taskId, passed, notes, photoUrl |

## CRM

| Entity | Notes |
|--------|--------|
| `Recipient` | normalized table (migrate from order JSON over time) |
| `Occasion` | date, type, recipientId |
| `Consent` | marketing, channel |

## Finance (MVP)

| Entity | Notes |
|--------|--------|
| `Expense` | category, amount, date |
| `SupplierPayment` | optional phase B5 |

## AI & audit

| Entity | Notes |
|--------|--------|
| `AiToolRun` | toolName, input, output, userId |
| `AiRecommendation` | session, product refs |

Existing public entities (`Order`, `Product`, `Collection`, etc.) remain; add relations rather than duplicate.
