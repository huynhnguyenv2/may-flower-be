import type { OrderStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

const STOCK_CONSUMED: OrderStatus[] = [
  "confirmed",
  "in_production",
  "out_for_delivery",
  "delivered",
];

/** Decrement variant ATP when an order becomes confirmed (idempotent per line). */
export async function consumeStockOnOrderConfirm(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) return;

  for (const item of order.items) {
    await prisma.productVariant.update({
      where: { id: item.productVariantId },
      data: { availableQuantity: { decrement: item.quantity } },
    });
  }
}

/** Restore variant ATP when a previously active order is cancelled. */
export async function releaseStockOnOrderCancel(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order || !STOCK_CONSUMED.includes(order.status)) return;

  for (const item of order.items) {
    await prisma.productVariant.update({
      where: { id: item.productVariantId },
      data: { availableQuantity: { increment: item.quantity } },
    });
  }
}
