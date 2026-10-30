import { CustomOrderRequestStatus, OrderChannel, OrderStatus, Prisma } from "@prisma/client";
import { vndToString } from "@may-flower/shared";
import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { recordAudit } from "./audit.js";

export async function listCustomOrderRequests(status?: CustomOrderRequestStatus) {
  const rows = await prisma.customOrderRequest.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { customer: true, addons: true },
  });

  return rows.map((r) => ({
    id: r.id,
    requestNumber: r.requestNumber,
    status: r.status,
    customerName: r.customer.name,
    customerPhone: r.customer.phone,
    totalVnd: vndToString((r.pricingJson as { totalVnd?: string })?.totalVnd ?? 0),
    createdAt: r.createdAt.toISOString(),
    referenceImageUrl: r.referenceImageUrl,
  }));
}

export async function getCustomOrderRequest(id: string) {
  const r = await prisma.customOrderRequest.findUnique({
    where: { id },
    include: {
      customer: true,
      addons: true,
      session: {
        include: {
          messages: { orderBy: { createdAt: "asc" }, take: 50 },
          concepts: {
            orderBy: { createdAt: "asc" },
            include: { images: { orderBy: { createdAt: "desc" } } },
          },
        },
      },
    },
  });
  if (!r) throw new AppError("NOT_FOUND", "Không tìm thấy yêu cầu", 404);

  return {
    id: r.id,
    requestNumber: r.requestNumber,
    status: r.status,
    sessionId: r.sessionId,
    convertedOrderId: r.convertedOrderId,
    customer: r.customer,
    recipient: r.recipientJson,
    pricing: r.pricingJson,
    configuration: r.configurationJson,
    conversationSummary: r.conversationSummary,
    messageCard: r.messageCard,
    instructions: r.instructions,
    referenceImageUrl: r.referenceImageUrl,
    deliveryZoneId: r.deliveryZoneId,
    deliverySlotId: r.deliverySlotId,
    deliveryFeeVnd: r.deliveryFeeVnd != null ? vndToString(r.deliveryFeeVnd) : null,
    addons: r.addons.map((a) => ({
      id: a.id,
      name: a.name,
      quantity: a.quantity,
      unitPriceVnd: vndToString(a.unitPriceVnd),
    })),
    designConcepts: r.session.concepts.map((c) => ({
      id: c.id,
      batchId: c.batchId,
      version: c.version,
      name: c.name,
      descriptionVi: c.descriptionVi,
      status: c.status,
      palette: c.palette,
      style: c.style,
      estimatedSubtotalVnd: vndToString(c.estimatedSubtotalVnd),
      images: c.images.map((img) => ({
        id: img.id,
        storageUrl: img.storageUrl,
        disclaimer: img.disclaimer,
        illustrative: img.illustrative,
      })),
    })),
    messages: r.session.messages.map((m) => ({
      role: m.role,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export async function updateCustomOrderRequestStatus(
  id: string,
  status: CustomOrderRequestStatus,
  actorId: string,
) {
  const existing = await prisma.customOrderRequest.findUnique({ where: { id } });
  if (!existing) throw new AppError("NOT_FOUND", "Không tìm thấy yêu cầu", 404);

  const updated = await prisma.customOrderRequest.update({
    where: { id },
    data: { status },
  });

  await prisma.auditEvent.create({
    data: {
      actorId,
      action: "custom_order_request.status",
      entityType: "CustomOrderRequest",
      entityId: id,
      payload: { from: existing.status, to: status },
    },
  });

  return { id: updated.id, status: updated.status };
}

const AI_CUSTOM_SKU = "AI-CUSTOM";

function generateOrderNumber(): string {
  const d = new Date();
  const y = d.getFullYear().toString().slice(-2);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `MF${y}${m}${day}${rand}`;
}

async function resolveAiCustomVariant() {
  const existing = await prisma.productVariant.findUnique({
    where: { sku: AI_CUSTOM_SKU },
    include: { product: true },
  });
  if (existing) return existing;

  const product = await prisma.product.create({
    data: {
      slug: "thiet-ke-ai-florist",
      name: "Thiết kế AI Florist (tùy chỉnh)",
      story: "Đơn hàng được tạo từ yêu cầu thiết kế AI.",
      description: "Sản phẩm nội bộ — giá và mô tả lấy từ snapshot yêu cầu.",
      active: false,
      featured: false,
      variants: {
        create: {
          sku: AI_CUSTOM_SKU,
          sizeLabel: "Tùy chỉnh",
          priceVnd: 0,
          availableQuantity: 9999,
          active: true,
        },
      },
    },
    include: { variants: true },
  });
  return product.variants[0]!;
}

function parsePricingTotal(pricingJson: unknown): number {
  const p = pricingJson as { totalVnd?: string | number; subtotalVnd?: string | number };
  const raw = p.totalVnd ?? p.subtotalVnd ?? 0;
  const n = typeof raw === "string" ? parseInt(raw, 10) : raw;
  return Number.isFinite(n) ? n : 0;
}

/** Staff converts an approved request into a confirmed manual order (custom_request channel). */
export async function convertCustomOrderRequestToOrder(id: string, actorId: string) {
  const request = await prisma.customOrderRequest.findUnique({
    where: { id },
    include: { addons: true },
  });
  if (!request) throw new AppError("NOT_FOUND", "Không tìm thấy yêu cầu", 404);
  if (request.status !== CustomOrderRequestStatus.approved) {
    throw new AppError("INVALID_STATE", "Chỉ duyệt yêu cầu đã approved mới chuyển đơn", 409);
  }
  if (request.convertedOrderId) {
    throw new AppError("ALREADY_CONVERTED", "Yêu cầu đã được chuyển thành đơn", 409);
  }
  if (!request.deliveryZoneId || !request.deliverySlotId) {
    throw new AppError("INCOMPLETE_DELIVERY", "Thiếu thông tin giao hàng trên yêu cầu", 400);
  }

  const slot = await prisma.deliverySlot.findUnique({
    where: { id: request.deliverySlotId },
  });
  if (!slot || slot.bookedCount >= slot.capacity) {
    throw new AppError("SLOT_FULL", "Khung giờ giao không khả dụng", 409);
  }

  const variant = await resolveAiCustomVariant();
  const subtotal = parsePricingTotal(request.pricingJson);
  const deliveryFee = request.deliveryFeeVnd ?? 0;
  const total = subtotal + deliveryFee;
  const config = request.configurationJson as { label?: string };
  const lineLabel = config.label ?? request.requestNumber;

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        status: OrderStatus.confirmed,
        channel: OrderChannel.custom_request,
        customerId: request.customerId,
        recipientJson: request.recipientJson as Prisma.InputJsonValue,
        deliveryZoneId: request.deliveryZoneId!,
        deliverySlotId: request.deliverySlotId!,
        deliveryFeeVnd: deliveryFee,
        subtotalVnd: subtotal,
        totalVnd: total,
        messageCard: request.messageCard,
        items: {
          create: {
            productVariantId: variant.id,
            productName: `AI Florist · ${lineLabel}`,
            variantLabel: "Tùy chỉnh",
            unitPriceVnd: subtotal,
            quantity: 1,
          },
        },
        productionTask: { create: { status: "pending" } },
      },
    });

    await tx.deliverySlot.update({
      where: { id: slot.id },
      data: { bookedCount: { increment: 1 } },
    });

    await tx.customOrderRequest.update({
      where: { id },
      data: {
        status: CustomOrderRequestStatus.converted,
        convertedOrderId: created.id,
      },
    });

    return created;
  });

  await recordAudit({
    actorId,
    action: "custom_order_request.convert",
    entityType: "CustomOrderRequest",
    entityId: id,
    payload: { orderId: order.id, orderNumber: order.orderNumber },
  });

  await recordAudit({
    actorId,
    action: "order.created_from_ai_request",
    entityType: "Order",
    entityId: order.id,
    payload: { requestId: id, requestNumber: request.requestNumber },
  });

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    requestId: id,
    status: CustomOrderRequestStatus.converted,
  };
}
