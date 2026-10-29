# Business Rules — Public Commerce Appendix

Full operational rules live with the management system; these apply to the public API and website.

## Availability

- A variant is **purchasable** when `active` and `availableQuantity >= requested quantity`.
- Display **limited** when `0 < availableQuantity <= 3`.
- Checkout re-validates availability server-side; stale cart quantities return `409` with refreshed availability.

## Pricing

- Prices are in **VND**, tax-inclusive for display unless configured otherwise later.
- Delivery fee from `DeliveryZone.feeVnd` added at checkout.

## Orders

- Guest checkout creates `Customer` (by email or phone), embeds `recipient` snapshot on the order.
- Initial status: `pending_payment` when payment required; MVP dev mode may use `confirmed` with `PAYMENT_MODE=dev_skip`.
- **Idempotency:** `POST /v1/orders` accepts `Idempotency-Key` header; duplicate key returns same order response.

## Stock reservation

- On **confirmed** payment (or dev skip), decrement `availableQuantity` per line; release on cancel.
- Webhook handlers must be **idempotent** on provider event id.

## Concierge recommendations

- Only recommend **active** products with at least one variant `availableQuantity > 0` within budget.
- Return exactly three tiers when possible: Safe (mid budget, popular), Signature (brand hero), Unexpected (distinct mood/color match).

## AI imagery

- Do not use generated images as PDP hero without `illustrative: true` metadata in API.
