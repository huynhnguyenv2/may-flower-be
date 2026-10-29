# API Specification — Public v1

Base URL: `http://localhost:3101/v1` (development)

## Error shape

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable message",
    "details": []
  }
}
```

## Endpoints

See [openapi/public-v1.yaml](./openapi/public-v1.yaml) for OpenAPI 3.1 source of truth.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/collections` | List active collections |
| GET | `/collections/:slug` | Collection detail + product summaries |
| GET | `/products` | Filter: `collection`, `feeling`, `minPrice`, `maxPrice` |
| GET | `/products/:slug` | Product detail + variants |
| POST | `/concierge/sessions` | Create concierge session |
| POST | `/concierge/sessions/:id/recommend` | Get three-tier recommendations |
| GET | `/delivery/zones` | Delivery zones and fees |
| GET | `/delivery/slots` | Query: `zone`, `date` (YYYY-MM-DD) |
| POST | `/orders` | Create order; header `Idempotency-Key` |
| GET | `/orders/:orderNumber` | Public order status (confirmation page) |
| POST | `/webhooks/payments/:provider` | Idempotent payment webhook stub |

## Pagination

List endpoints: `?page=1&pageSize=20` → `{ data, meta: { page, pageSize, total } }`.

## Money

All monetary fields are **strings** of integer VND, e.g. `"850000"`.
