import type { ConciergeAnswers } from "@may-flower/shared";
import { prisma } from "../lib/prisma.js";
import { mapProductSummary } from "./catalog.js";
import { vndToString } from "@may-flower/shared";
import {
  pickConciergeWithOpenAi,
  type ConciergeCandidate,
} from "./llm/openai-concierge.js";

const TIER_LABELS: Record<string, string> = {
  safe: "Lựa chọn an toàn",
  signature: "Chữ ký của studio",
  unexpected: "Bất ngờ tinh tế",
};

type ProductWithVariants = Awaited<ReturnType<typeof loadCandidateProducts>>[number];
type VariantRow = ProductWithVariants["variants"][number];

export async function createSession() {
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  return prisma.conciergeSession.create({
    data: { expiresAt },
  });
}

async function loadCandidateProducts(answers: ConciergeAnswers, budgetNum: number) {
  const baseWhere = {
    active: true,
    variants: {
      some: {
        active: true,
        availableQuantity: { gt: 0 },
        priceVnd: { lte: budgetNum },
      },
    },
  };

  let products = await prisma.product.findMany({
    where: {
      ...baseWhere,
      ...(answers.feeling
        ? { tags: { some: { tag: { slug: answers.feeling } } } }
        : {}),
    },
    include: { variants: true, tags: { include: { tag: true } } },
    take: 40,
  });

  if (products.length === 0 && answers.feeling) {
    products = await prisma.product.findMany({
      where: baseWhere,
      include: { variants: true, tags: { include: { tag: true } } },
      take: 40,
    });
  }

  return products;
}

function buildCandidates(products: ProductWithVariants[], budgetNum: number) {
  return products
    .map((p) => {
      const variants = p.variants.filter(
        (v) => v.active && v.availableQuantity > 0 && Number(v.priceVnd) <= budgetNum,
      );
      if (variants.length === 0) return null;
      const variant = variants.sort((a, b) => Number(a.priceVnd) - Number(b.priceVnd))[0]!;
      return { product: p, variant };
    })
    .filter(Boolean) as { product: ProductWithVariants; variant: VariantRow }[];
}

function toCandidateRows(
  rows: { product: ProductWithVariants; variant: VariantRow }[],
): ConciergeCandidate[] {
  return rows.map(({ product, variant }) => ({
    productId: product.id,
    variantId: variant.id,
    slug: product.slug,
    name: product.name,
    story: product.story,
    priceVnd: vndToString(variant.priceVnd),
    featured: product.featured,
  }));
}

function recommendByRules(
  candidates: { product: ProductWithVariants; variant: VariantRow }[],
) {
  const sorted = [...candidates].sort(
    (a, b) => Number(a.variant.priceVnd) - Number(b.variant.priceVnd),
  );
  const featured =
    candidates.find((c) => c.product.featured) ??
    sorted[Math.floor(sorted.length / 2)]!;
  const safe = sorted[0]!;
  const unexpected = sorted[sorted.length - 1]!;

  return [
    { tier: "safe" as const, item: safe },
    { tier: "signature" as const, item: featured },
    { tier: "unexpected" as const, item: unexpected },
  ];
}

function mapRecommendations(
  picks: {
    tier: "safe" | "signature" | "unexpected";
    item: { product: ProductWithVariants; variant: VariantRow };
    rationale?: string;
  }[],
) {
  const seen = new Set<string>();
  return picks
    .filter(({ item }) => {
      if (seen.has(item.product.id)) return false;
      seen.add(item.product.id);
      return true;
    })
    .map(({ tier, item, rationale }) => ({
      tier,
      tierLabel: TIER_LABELS[tier] ?? tier,
      product: mapProductSummary(item.product),
      variantId: item.variant.id,
      priceVnd: vndToString(item.variant.priceVnd),
      ...(rationale ? { rationale } : {}),
    }));
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
  const products = await loadCandidateProducts(answers, budgetNum);
  const candidates = buildCandidates(products, budgetNum);

  if (candidates.length === 0) {
    return { recommendations: [] as never[], source: "rules" as const };
  }

  const byVariantId = new Map(
    candidates.map((c) => [c.variant.id, c] as const),
  );

  const llm = await pickConciergeWithOpenAi(answers, toCandidateRows(candidates));
  if (llm) {
    const llmPicks = llm.picks
      .map((p) => {
        const item = byVariantId.get(p.variantId);
        if (!item) return null;
        return { tier: p.tier, item, rationale: p.rationale };
      })
      .filter(Boolean) as {
      tier: "safe" | "signature" | "unexpected";
      item: (typeof candidates)[0];
      rationale?: string;
    }[];

    if (llmPicks.length > 0) {
      return {
        source: "openai" as const,
        recommendations: mapRecommendations(llmPicks),
      };
    }
  }

  return {
    source: "rules" as const,
    recommendations: mapRecommendations(recommendByRules(candidates)),
  };
}
