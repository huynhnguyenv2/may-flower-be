# Risks & Open Questions

## Open questions

1. **Payment provider:** VNPay vs MoMo vs ZaloPay vs hybrid—needed for production webhook shape.
2. **Delivery geography:** HCMC only vs Hanoi vs nationwide; affects zones and fees in seed data.
3. **Bilingual:** Vietnamese-only MVP vs `vi` + `en` from launch (scaffold supports both).
4. **Auth for accounts:** Email magic link vs phone OTP (Vietnam).

## Risks

| Risk | Mitigation |
|------|------------|
| Catalog edited only via seeds until admin exists | Document seed/Prisma Studio workflow; thin API for staff later |
| Concierge without LLM feels simplistic | Rule-based v1 still grounded in catalog; upgrade path to tool-calling LLM |
| Double orders on payment retry | Idempotency keys + webhook event dedup table (stub ready) |
| Frontend encodes business rules | All pricing/availability from API; Zod validation on responses |

## Assumptions (logged)

- Node.js (Fastify) + PostgreSQL + Next.js as in implementation plan.
- VND integer display; no multi-currency in MVP.
