# MongoDB + Prisma

This project uses **MongoDB** (not PostgreSQL). Schema changes:

```bash
pnpm db:push   # from repo root
pnpm db:seed
```

SQL migrations under `migrations/` are legacy from the Postgres prototype; MongoDB uses `prisma db push` only.
