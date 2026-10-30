import type { OrderStatus } from "@prisma/client";
import { vndToString } from "@may-flower/shared";
import { prisma } from "../../lib/prisma.js";
import { listLowStockVariants } from "../inventory/stock.js";
import { listAdminOrders } from "../admin-orders.js";

function startOfTodayUtc(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function getOperationsSnapshot() {
  const since = startOfTodayUtc();
  const [ordersToday, pendingPayment, inProduction, lowStockCount, openSupport] = await Promise.all([
    prisma.order.count({ where: { createdAt: { gte: since } } }),
    prisma.order.count({ where: { status: "pending_payment" } }),
    prisma.order.count({ where: { status: "in_production" } }),
    prisma.productVariant.count({
      where: { active: true, availableQuantity: { lte: 3, gt: 0 } },
    }),
    prisma.supportSession.count({
      where: { expiresAt: { gt: new Date() } },
    }),
  ]);

  const revenueToday = await prisma.order.aggregate({
    where: { createdAt: { gte: since }, status: { not: "cancelled" } },
    _sum: { totalVnd: true },
  });

  return {
    ordersToday,
    pendingPayment,
    inProduction,
    lowStockVariants: lowStockCount,
    openSupportSessions: openSupport,
    revenueTodayVnd: vndToString(revenueToday._sum.totalVnd ?? 0),
  };
}

export async function searchProductsForStaff(query: string, limit = 8) {
  const q = query.trim();
  if (!q) return [];

  const products = await prisma.product.findMany({
    where: {
      active: true,
      OR: [{ name: { contains: q } }, { slug: { contains: q } }],
    },
    take: limit,
    include: { variants: { where: { active: true } } },
  });

  return products.map((p) => {
    const totalQty = p.variants.reduce((s, v) => s + v.availableQuantity, 0);
    const minPrice = p.variants.reduce(
      (min, v) => (min === null || v.priceVnd < min ? v.priceVnd : min),
      null as number | null,
    );
    return {
      slug: p.slug,
      name: p.name,
      totalAvailable: totalQty,
      fromPriceVnd: minPrice !== null ? vndToString(minPrice) : "0",
      variants: p.variants.map((v) => ({
        sku: v.sku,
        sizeLabel: v.sizeLabel,
        priceVnd: vndToString(v.priceVnd),
        availableQuantity: v.availableQuantity,
      })),
    };
  });
}

export async function getOrderForStaff(orderNumber: string) {
  const order = await prisma.order.findUnique({
    where: { orderNumber: orderNumber.trim().toUpperCase() },
    include: { items: true, customer: true, deliverySlot: true },
  });
  if (!order) return null;

  return {
    orderNumber: order.orderNumber,
    status: order.status,
    channel: order.channel,
    customerName: order.customer.name,
    customerPhone: order.customer.phone,
    totalVnd: vndToString(order.totalVnd),
    createdAt: order.createdAt.toISOString(),
    deliverySlot: {
      date: order.deliverySlot.date.toISOString().slice(0, 10),
      startTime: order.deliverySlot.startTime,
      endTime: order.deliverySlot.endTime,
    },
    items: order.items.map((i) => ({
      productName: i.productName,
      variantLabel: i.variantLabel,
      quantity: i.quantity,
      unitPriceVnd: vndToString(i.unitPriceVnd),
    })),
  };
}

export async function listOrdersForStaff(filters: { status?: OrderStatus; limit?: number }) {
  const { items } = await listAdminOrders(filters);
  return items;
}

export { listLowStockVariants };
