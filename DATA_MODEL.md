# Data Model — Public MVP

**MongoDB** via Prisma. Money stored as **Int** (VND); API exposes amounts as **string integers in VND** (no fractional dong).

## Catalog

| Entity | Key fields |
|--------|------------|
| `Collection` | `slug`, `title`, `story`, `mood`, `palette`, `kind` (emotional \| signature \| seasonal), `sortOrder`, `active` |
| `Product` | `slug`, `name`, `story`, `description`, `active`, hero image URLs |
| `ProductVariant` | `productId`, `sku`, `sizeLabel`, `priceVnd`, `availableQuantity`, `active` |
| `ProductCollection` | M2M `productId`, `collectionId` |
| `EmotionalTag` | `slug`, `label` — linked to products for Concierge filters |

## Delivery

| Entity | Key fields |
|--------|------------|
| `DeliveryZone` | `slug`, `name`, `feeVnd`, `active` |
| `DeliverySlotTemplate` | `zoneId`, `dayOfWeek`, `startTime`, `endTime`, `capacity` |
| `DeliverySlot` | `zoneId`, `date`, `startTime`, `endTime`, `capacity`, `bookedCount` |

## Sales (guest checkout)

| Entity | Key fields |
|--------|------------|
| `Customer` | `email`, `phone`, `name` (optional account link later) |
| `Recipient` | `name`, `phone`, `addressLine1`, `district`, `city`, `note` |
| `Order` | `orderNumber`, `status`, `customerId`, `recipientSnapshot` (JSON), `deliveryZoneId`, `deliverySlotId`, `deliveryFeeVnd`, `subtotalVnd`, `totalVnd`, `messageCard`, `idempotencyKey` |
| `OrderItem` | `orderId`, `productVariantId`, snapshots: `productName`, `variantLabel`, `unitPriceVnd`, `quantity` |

## Order status (MVP)

`pending_payment` → `confirmed` → `in_production` → `out_for_delivery` → `delivered` | `cancelled`

Payment webhook transitions `pending_payment` → `confirmed` and triggers stock reservation (see business rules).

## Concierge

| Entity | Key fields |
|--------|------------|
| `ConciergeSession` | `id`, `answers` (JSON), `expiresAt` |

## Rules

- **ATP:** `availableQuantity` on variant is available-to-promise for the website (management will sync later).
- **Snapshots:** Order lines store name/price at purchase time.
- **Idempotency:** `Order.idempotencyKey` unique; payment webhooks use provider event id.
