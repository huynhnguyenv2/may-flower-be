import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { recordAudit } from "../audit.js";

export async function listLowStockVariants(limit = 20) {
  const variants = await prisma.productVariant.findMany({
    where: { active: true, availableQuantity: { lte: 3 } },
    orderBy: { availableQuantity: "asc" },
    take: limit,
    include: { product: { select: { name: true, slug: true, active: true } } },
  });

  return variants
    .filter((v) => v.product.active)
    .map((v) => ({
      variantId: v.id,
      sku: v.sku,
      productName: v.product.name,
      productSlug: v.product.slug,
      sizeLabel: v.sizeLabel,
      availableQuantity: v.availableQuantity,
    }));
}

export async function adjustVariantStock(input: {
  variantId: string;
  delta: number;
  reason?: string;
  actorId: string;
}) {
  if (!Number.isInteger(input.delta) || input.delta === 0) {
    throw new AppError("VALIDATION_ERROR", "delta phải là số nguyên khác 0", 400);
  }

  const variant = await prisma.productVariant.findUnique({
    where: { id: input.variantId },
    include: { product: true },
  });
  if (!variant) throw new AppError("NOT_FOUND", "Không tìm thấy biến thể", 404);

  const nextQty = variant.availableQuantity + input.delta;
  if (nextQty < 0) {
    throw new AppError("INSUFFICIENT_STOCK", "Tồn kho không đủ để trừ", 409);
  }

  const quantity = Math.abs(input.delta);

  const updated = await prisma.$transaction(async (tx) => {
    const batch = await tx.inventoryBatch.create({
      data: {
        refType: "product_variant",
        refId: variant.id,
        quantity,
        unitCostVnd: variant.priceVnd,
        lotCode: `ADJ-${Date.now()}`,
      },
    });

    await tx.stockMovement.create({
      data: {
        batchId: batch.id,
        type: "ADJUST",
        quantity,
        reason: input.reason ?? "admin_adjust",
        refType: "product_variant",
        refId: variant.id,
      },
    });

    return tx.productVariant.update({
      where: { id: variant.id },
      data: { availableQuantity: nextQty },
    });
  });

  await recordAudit({
    actorId: input.actorId,
    action: "inventory.adjust",
    entityType: "ProductVariant",
    entityId: variant.id,
    payload: {
      delta: input.delta,
      from: variant.availableQuantity,
      to: nextQty,
      reason: input.reason ?? null,
    },
  });

  return {
    variantId: updated.id,
    sku: updated.sku,
    productName: variant.product.name,
    availableQuantity: updated.availableQuantity,
  };
}
