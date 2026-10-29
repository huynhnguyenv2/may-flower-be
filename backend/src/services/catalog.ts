import type { Prisma } from "@prisma/client";
import { vndToString } from "@may-flower/shared";
import { prisma } from "../lib/prisma.js";

type ProductWithVariants = Prisma.ProductGetPayload<{
  include: { variants: true; tags: { include: { tag: true } } };
}>;

export function availabilityLabel(qty: number): "available" | "limited" | "unavailable" {
  if (qty <= 0) return "unavailable";
  if (qty <= 3) return "limited";
  return "available";
}

export function mapProductSummary(product: ProductWithVariants) {
  const activeVariants = product.variants.filter((v) => v.active);
  const maxQty = Math.max(0, ...activeVariants.map((v) => v.availableQuantity));
  const minPrice = activeVariants.reduce(
    (min, v) => (min === null || v.priceVnd < min ? v.priceVnd : min),
    null as null | typeof activeVariants[0]["priceVnd"],
  );

  return {
    slug: product.slug,
    name: product.name,
    story: product.story,
    imageUrl: product.imageUrl,
    fromPriceVnd: minPrice ? vndToString(minPrice) : "0",
    isAvailable: maxQty > 0,
    availabilityLabel: availabilityLabel(maxQty),
  };
}

export async function listCollections() {
  const collections = await prisma.collection.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { products: true } } },
  });

  return collections.map((c) => ({
    slug: c.slug,
    title: c.title,
    story: c.story,
    kind: c.kind,
    mood: c.mood,
    palette: c.palette,
    imageUrl: c.imageUrl,
    productCount: c._count.products,
  }));
}

export async function getCollectionBySlug(slug: string) {
  const collection = await prisma.collection.findFirst({
    where: { slug, active: true },
    include: {
      products: {
        include: {
          product: {
            include: {
              variants: true,
              tags: { include: { tag: true } },
            },
          },
        },
      },
    },
  });

  if (!collection) return null;

  const products = collection.products
    .map((pc) => pc.product)
    .filter((p) => p.active)
    .map(mapProductSummary);

  return {
    slug: collection.slug,
    title: collection.title,
    story: collection.story,
    kind: collection.kind,
    mood: collection.mood,
    palette: collection.palette,
    imageUrl: collection.imageUrl,
    products,
  };
}

export async function listProducts(filters: {
  collection?: string;
  feeling?: string;
  minPrice?: string;
  maxPrice?: string;
}) {
  const where: Prisma.ProductWhereInput = { active: true };

  if (filters.collection) {
    where.collections = { some: { collection: { slug: filters.collection } } };
  }

  if (filters.feeling) {
    where.tags = { some: { tag: { slug: filters.feeling } } };
  }

  const products = await prisma.product.findMany({
    where,
    include: { variants: true, tags: { include: { tag: true } } },
    orderBy: { name: "asc" },
  });

  let mapped = products.map(mapProductSummary);

  if (filters.minPrice) {
    const min = BigInt(filters.minPrice);
    mapped = mapped.filter((p) => BigInt(p.fromPriceVnd) >= min);
  }
  if (filters.maxPrice) {
    const max = BigInt(filters.maxPrice);
    mapped = mapped.filter((p) => BigInt(p.fromPriceVnd) <= max);
  }

  return mapped;
}

export async function getProductBySlug(slug: string) {
  const product = await prisma.product.findFirst({
    where: { slug, active: true },
    include: { variants: true, tags: { include: { tag: true } } },
  });

  if (!product) return null;

  const summary = mapProductSummary(product);
  const variants = product.variants
    .filter((v) => v.active)
    .map((v) => ({
      id: v.id,
      sku: v.sku,
      sizeLabel: v.sizeLabel,
      priceVnd: vndToString(v.priceVnd),
      availableQuantity: v.availableQuantity,
      isAvailable: v.availableQuantity > 0,
    }));

  return {
    ...summary,
    description: product.description,
    variants,
    emotionalTags: product.tags.map((t) => t.tag.slug),
  };
}

export async function listFeaturedProducts(limit = 6) {
  const products = await prisma.product.findMany({
    where: { active: true, featured: true },
    take: limit,
    include: { variants: true, tags: { include: { tag: true } } },
  });
  return products.map(mapProductSummary);
}
