# Admin API quickstart

Base: `http://localhost:3101/v1/admin`

## Login

```bash
curl -s -X POST http://localhost:3101/v1/admin/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"owner@mayflower.vn","password":"MayFlower2026!"}'
```

Use `accessToken` as `Authorization: Bearer <token>`.

## Endpoints (Phase B0–B1)

| Method | Path | Roles |
|--------|------|-------|
| POST | `/auth/login` | public |
| POST | `/auth/refresh` | public |
| GET | `/me` | any staff |
| GET | `/orders` | owner, manager, florist, delivery |
| PATCH | `/orders/:id/status` | owner, manager, florist |
| GET | `/products` | owner, manager |

## Example

```bash
TOKEN=$(curl -s -X POST http://localhost:3101/v1/admin/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"owner@mayflower.vn","password":"MayFlower2026!"}' | jq -r '.data.accessToken')

curl -s http://localhost:3101/v1/admin/orders -H "Authorization: Bearer $TOKEN"
```

Restart API after `.env` changes: `pnpm dev:api`.
