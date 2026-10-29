# May Flower — Agent roles

This repo uses **two focused agents**. Start a **new Cursor chat** per role and attach the listed context.

## 1. Public storefront agent (mostly done)

- **Scope:** `frontend/`, public UX, `next-intl`, SEO, Concierge UI.
- **API consumer only:** calls `NEXT_PUBLIC_API_URL` (`/v1/*`). Do not put business rules in React.
- **Docs:** `UI_UX_GUIDELINES.md`, `PRODUCT_VISION.md`, `ACCEPTANCE_CRITERIA.md` (website section).

## 2. Backend & operations agent (build this next)

- **Scope:** `backend/`, `packages/shared`, `openapi/`, Prisma schema, jobs, admin APIs, AI tool layer.
- **Goal:** One Node backend that serves **public storefront**, **staff/management API**, and **AI copilot tools** on shared PostgreSQL.
- **Start here:** Read [docs/prompts/BACKEND_AGENT_START.md](docs/prompts/BACKEND_AGENT_START.md) and follow [BACKEND_IMPLEMENTATION_ROADMAP.md](BACKEND_IMPLEMENTATION_ROADMAP.md).
- **Skill:** Project skill `.cursor/skills/may-flower-backend/SKILL.md` (auto when editing `backend/**`).
- **Do not break:** Existing public `/v1` contracts used by `frontend/`; extend via new routes or versioned admin prefix.

## Shared rules (all agents)

- Vietnam launch: VND integers as strings in JSON, `vi` copy on public site.
- Money: Prisma `Decimal`, never float in application logic.
- Business logic in `backend/src/services/*`, not in route handlers or LLM prompts.
- Vertical slices: schema → service → route → test → update OpenAPI.
- Run tests before claiming done; do not edit `AI_Flower_Shop_Product_Blueprint_EN.docx` or user plan files unless asked.

## Commands

```bash
pnpm install
pnpm db:up          # or local Postgres
pnpm db:migrate
pnpm db:seed
pnpm dev            # web :3100, API :3101
pnpm --filter @may-flower/api test
```
