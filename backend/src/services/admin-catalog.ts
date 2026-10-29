import { vndToString } from "@may-flower/shared";
import { prisma } from "../lib/prisma.js";

export async function listAdminProducts() {
  const products = await prisma.product.findMany({
    orderBy: { updatedAt: "desc" },
    include: { variants: true },
  });

  return products.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    active: p.active,
    featured: p.featured,
    imageUrl: p.imageUrl,
    variants: p.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      sizeLabel: v.sizeLabel,
      priceVnd: vndToString(v.priceVnd),
      availableQuantity: v.availableQuantity,
      active: v.active,
    })),
  }));
}
