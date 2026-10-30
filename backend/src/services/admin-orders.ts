import type { OrderStatus } from "@prisma/client";
import { vndToString } from "@may-flower/shared";
import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { recordAudit } from "./audit.js";
import { consumeStockOnOrderConfirm, releaseStockOnOrderCancel } from "./orders-stock.js";

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ["confirmed", "cancelled"],
  confirmed: ["in_production", "cancelled"],
  in_production: ["out_for_delivery", "cancelled"],
  out_for_delivery: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

export async function listAdminOrders(filters: {
  status?: OrderStatus;
  q?: string;
  limit?: number;
  offset?: number;
}) {
  const take = Math.min(filters.limit ?? 50, 100);
  const skip = filters.offset ?? 0;
  const q = filters.q?.trim();

  const where = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(q
      ? {
          OR: [
            { orderNumber: { contains: q.toUpperCase() } },
            { customer: { phone: { contains: q } } },
            { customer: { name: { contains: q } } },
          ],
        }
      : {}),
  };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where: Object.keys(where).length ? where : undefined,
      orderBy: { createdAt: "desc" },
      take,
      skip,
      include: { items: true, customer: true },
    }),
    prisma.order.count({
      where: Object.keys(where).length ? where : undefined,
    }),
  ]);

  return {
    items: orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      channel: o.channel,
      customerName: o.customer.name,
      customerPhone: o.customer.phone,
      totalVnd: vndToString(o.totalVnd),
      createdAt: o.createdAt.toISOString(),
      itemCount: o.items.length,
    })),
    total,
  };
}

export async function getAdminOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, customer: true, deliverySlot: true, productionTask: true },
  });
  if (!order) throw new AppError("NOT_FOUND", "Không tìm thấy đơn", 404);

  const timeline = await prisma.auditEvent.findMany({
    where: { entityType: "Order", entityId: order.id },
    orderBy: { createdAt: "asc" },
    include: { actor: { select: { name: true } } },
  });

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    channel: order.channel,
    customerId: order.customerId,
    customerName: order.customer.name,
    customerPhone: order.customer.phone,
    customerEmail: order.customer.email,
    recipient: order.recipientJson,
    totalVnd: vndToString(order.totalVnd),
    subtotalVnd: vndToString(order.subtotalVnd),
    deliveryFeeVnd: vndToString(order.deliveryFeeVnd),
    messageCard: order.messageCard,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    deliverySlot: {
      date: order.deliverySlot.date.toISOString().slice(0, 10),
      startTime: order.deliverySlot.startTime,
      endTime: order.deliverySlot.endTime,
    },
    productionStatus: order.productionTask?.status ?? null,
    items: order.items.map((i) => ({
      id: i.id,
      productName: i.productName,
      variantLabel: i.variantLabel,
      quantity: i.quantity,
      unitPriceVnd: vndToString(i.unitPriceVnd),
      lineTotalVnd: vndToString(i.unitPriceVnd * i.quantity),
    })),
    timeline: timeline.map((t) => ({
      id: t.id,
      action: t.action,
      payload: t.payload,
      actorName: t.actor?.name ?? null,
      createdAt: t.createdAt.toISOString(),
    })),
  };
}

export async function updateOrderStatus(
  orderId: string,
  nextStatus: OrderStatus,
  actorId: string,
) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new AppError("NOT_FOUND", "Không tìm thấy đơn", 404);

  const allowed = ALLOWED_TRANSITIONS[order.status];
  if (!allowed.includes(nextStatus)) {
    throw new AppError(
      "INVALID_TRANSITION",
      `Không thể chuyển từ ${order.status} sang ${nextStatus}`,
      409,
    );
  }

  if (nextStatus === "cancelled") {
    await releaseStockOnOrderCancel(orderId);
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: { status: nextStatus },
  });

  if (nextStatus === "confirmed" && order.status === "pending_payment") {
    await consumeStockOnOrderConfirm(orderId);
    await prisma.productionTask.upsert({
      where: { orderId: order.id },
      create: { orderId: order.id, status: "pending" },
      update: {},
    });
  }

  if (nextStatus === "cancelled") {
    await prisma.productionTask.updateMany({
      where: { orderId: order.id, status: { not: "cancelled" } },
      data: { status: "cancelled" },
    });
  }

  await recordAudit({
    actorId,
    action: "order.status_update",
    entityType: "Order",
    entityId: order.id,
    payload: { from: order.status, to: nextStatus },
  });

  return { id: updated.id, orderNumber: updated.orderNumber, status: updated.status };
}
