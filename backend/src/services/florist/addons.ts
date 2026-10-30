import { vndToString, type FloristAddonLine } from "@may-flower/shared";
import { prisma } from "../../lib/prisma.js";

export async function listAvailableAddons() {
  const rows = await prisma.addon.findMany({
    where: { active: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  return rows.map((a) => ({
    id: a.id,
    slug: a.slug,
    name: a.name,
    category: a.category,
    priceVnd: vndToString(a.priceVnd),
    imageUrl: a.imageUrl,
  }));
}

export async function recommendAddonIds(input: {
  occasion?: string;
  budgetRemainingVnd?: number;
  limit?: number;
}): Promise<string[]> {
  const addons = await prisma.addon.findMany({ where: { active: true } });
  const occasion = input.occasion?.toLowerCase() ?? "";
  const budget = input.budgetRemainingVnd ?? Number.MAX_SAFE_INTEGER;

  const scored = addons.map((a) => {
    let score = 0;
    if (a.occasionTags.some((t) => occasion.includes(t.toLowerCase()))) score += 3;
    if (a.priceVnd <= budget) score += 2;
    if (a.category === "gift") score += 1;
    return { id: a.id, score };
  });

  return scored
    .sort((x, y) => y.score - x.score)
    .slice(0, input.limit ?? 5)
    .map((s) => s.id);
}

export function parseSelectedAddons(raw: unknown): FloristAddonLine[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const addonId = (row as { addonId?: string }).addonId;
      const quantity = (row as { quantity?: number }).quantity;
      if (!addonId || !quantity || quantity < 1) return null;
      return { addonId, quantity };
    })
    .filter(Boolean) as FloristAddonLine[];
}
