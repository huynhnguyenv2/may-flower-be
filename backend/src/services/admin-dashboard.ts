import { CustomOrderRequestStatus, OrderStatus } from "@prisma/client";
import { vndToString } from "@may-flower/shared";
import { prisma } from "../lib/prisma.js";
import { getOperationsSnapshot } from "./ai-tools/data-queries.js";
import { listLowStockVariants } from "./inventory/stock.js";

function startOfDaysAgo(days: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

export async function getAdminDashboard() {
  const since7 = startOfDaysAgo(7);
  const snapshot = await getOperationsSnapshot();

  const statusGroups = await prisma.order.groupBy({
    by: ["status"],
    _count: { _all: true },
  });

  const ordersByStatus = Object.fromEntries(
    (Object.values(OrderStatus) as OrderStatus[]).map((s) => [s, 0]),
  ) as Record<OrderStatus, number>;
  for (const row of statusGroups) {
    ordersByStatus[row.status] = row._count._all;
  }

  const [pendingAiRequests, revenue7d, recentOrders, recentAudits, topVariants] =
    await Promise.all([
      prisma.customOrderRequest.count({
        where: { status: CustomOrderRequestStatus.pending_review },
      }),
      prisma.order.aggregate({
        where: {
          createdAt: { gte: since7 },
          status: { not: OrderStatus.cancelled },
        },
        _sum: { totalVnd: true },
        _count: { _all: true },
      }),
      prisma.order.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { customer: true },
      }),
      prisma.auditEvent.findMany({
        orderBy: { createdAt: "desc" },
        take: 12,
        include: { actor: { select: { name: true, email: true } } },
      }),
      prisma.orderItem.groupBy({
        by: ["productName"],
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 5,
      }),
    ]);

  const lowStock = await listLowStockVariants(8);

  const aiConverted = await prisma.customOrderRequest.count({
    where: { status: CustomOrderRequestStatus.converted },
  });
  const aiTotal = await prisma.customOrderRequest.count();
  const aiConversionRate =
    aiTotal === 0 ? 0 : Math.round((aiConverted / aiTotal) * 1000) / 10;

  const popularAddons = await prisma.customOrderRequestAddon.groupBy({
    by: ["name"],
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: 5,
  });

  return {
    kpis: {
      ...snapshot,
      pendingAiRequests,
      revenue7dVnd: vndToString(revenue7d._sum.totalVnd ?? 0),
      orders7d: revenue7d._count._all,
      aiConversionRatePercent: aiConversionRate,
    },
    ordersByStatus,
    recentOrders: recentOrders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      channel: o.channel,
      customerName: o.customer.name,
      totalVnd: vndToString(o.totalVnd),
      createdAt: o.createdAt.toISOString(),
    })),
    recentActivity: recentAudits.map((a) => ({
      id: a.id,
      action: a.action,
      entityType: a.entityType,
      entityId: a.entityId,
      actorName: a.actor?.name ?? null,
      createdAt: a.createdAt.toISOString(),
    })),
    popularProducts: topVariants.map((v) => ({
      name: v.productName,
      quantitySold: v._sum.quantity ?? 0,
    })),
    popularAddons: popularAddons.map((a) => ({
      name: a.name,
      quantity: a._sum.quantity ?? 0,
    })),
    lowStock,
    alerts: buildAlerts({
      pendingAiRequests,
      pendingPayment: snapshot.pendingPayment,
      lowStockCount: snapshot.lowStockVariants,
    }),
  };
}

function buildAlerts(input: {
  pendingAiRequests: number;
  pendingPayment: number;
  lowStockCount: number;
}) {
  const alerts: { severity: "warning" | "info"; message: string }[] = [];
  if (input.pendingAiRequests > 0) {
    alerts.push({
      severity: "warning",
      message: `${input.pendingAiRequests} yêu cầu AI Florist chờ duyệt`,
    });
  }
  if (input.pendingPayment > 0) {
    alerts.push({
      severity: "info",
      message: `${input.pendingPayment} đơn chờ thanh toán`,
    });
  }
  if (input.lowStockCount > 0) {
    alerts.push({
      severity: "warning",
      message: `${input.lowStockCount} biến thể sắp hết hàng (≤3)`,
    });
  }
  return alerts;
}
