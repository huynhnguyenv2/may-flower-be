import type { ConciergeAnswers } from "@may-flower/shared";
import { prisma } from "../lib/prisma.js";
import { mapProductSummary } from "./catalog.js";
import { vndToString } from "@may-flower/shared";

const TIER_LABELS: Record<string, string> = {
  safe: "Lựa chọn an toàn",
  signature: "Chữ ký của studio",
  unexpected: "Bất ngờ tinh tế",
};

export async function createSession() {
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  return prisma.conciergeSession.create({
    data: { expiresAt },
  });
}

export async function recommend(sessionId: string, answers: ConciergeAnswers) {
  const session = await prisma.conciergeSession.findUnique({ where: { id: sessionId } });
  if (!session || session.expiresAt < new Date()) {
    return null;
  }

  await prisma.conciergeSession.update({
    where: { id: sessionId },
    data: { answers },
  });

  const budgetNum = Number(answers.budgetVnd);
  const products = await prisma.product.findMany({
    where: {
      active: true,
      variants: {
        some: {
          active: true,
          availableQuantity: { gt: 0 },
          priceVnd: { lte: budgetNum },
        },
      },
      ...(answers.feeling
        ? { tags: { some: { tag: { slug: answers.feeling } } } }
        : {}),
    },
    include: { variants: true, tags: { include: { tag: true } } },
  });

  const candidates = products
    .map((p) => {
      const variants = p.variants.filter(
        (v) => v.active && v.availableQuantity > 0 && Number(v.priceVnd) <= budgetNum,
      );
      if (variants.length === 0) return null;
      const variant = variants.sort(
        (a, b) => Number(a.priceVnd) - Number(b.priceVnd),
      )[0]!;
      return { product: p, variant };
    })
    .filter(Boolean) as { product: (typeof products)[0]; variant: (typeof products)[0]["variants"][0] }[];

  if (candidates.length === 0) {
    return { recommendations: [] as never[] };
  }

  const sorted = [...candidates].sort(
    (a, b) => Number(a.variant.priceVnd) - Number(b.variant.priceVnd),
  );
  const featured = candidates.find((c) => c.product.featured) ?? sorted[Math.floor(sorted.length / 2)]!;
  const safe = sorted[0]!;
  const unexpected = sorted[sorted.length - 1]!;

  const picks = [
    { tier: "safe" as const, item: safe },
    { tier: "signature" as const, item: featured },
    { tier: "unexpected" as const, item: unexpected },
  ];

  const seen = new Set<string>();
  const recommendations = picks
    .filter(({ item }) => {
      if (seen.has(item.product.id)) return false;
      seen.add(item.product.id);
      return true;
    })
    .map(({ tier, item }) => ({
      tier,
      tierLabel: TIER_LABELS[tier],
      product: mapProductSummary(item.product),
      variantId: item.variant.id,
      priceVnd: vndToString(item.variant.priceVnd),
    }));

  return { recommendations };
}
