import type { CreateOrderRequest } from "@may-flower/shared";
import { vndToString } from "@may-flower/shared";
import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";

function generateOrderNumber(): string {
  const d = new Date();
  const y = d.getFullYear().toString().slice(-2);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `MF${y}${m}${day}${rand}`;
}

export async function getOrderByNumber(orderNumber: string) {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { deliverySlot: true, items: true },
  });
  if (!order) return null;

  return {
    orderNumber: order.orderNumber,
    status: order.status,
    subtotalVnd: vndToString(order.subtotalVnd),
    deliveryFeeVnd: vndToString(order.deliveryFeeVnd),
    totalVnd: vndToString(order.totalVnd),
    messageCard: order.messageCard,
    deliverySlot: {
      id: order.deliverySlot.id,
      date: order.deliverySlot.date.toISOString().slice(0, 10),
      startTime: order.deliverySlot.startTime,
      endTime: order.deliverySlot.endTime,
      available: true,
    },
    items: order.items.map((i) => ({
      productName: i.productName,
      variantLabel: i.variantLabel,
      unitPriceVnd: vndToString(i.unitPriceVnd),
      quantity: i.quantity,
    })),
  };
}

export async function createOrder(input: CreateOrderRequest, idempotencyKey?: string) {
  if (idempotencyKey) {
    const existing = await prisma.order.findUnique({ where: { idempotencyKey } });
    if (existing) {
      return getOrderByNumber(existing.orderNumber);
    }
  }

  const zone = await prisma.deliveryZone.findFirst({
    where: { slug: input.deliveryZoneSlug, active: true },
  });
  if (!zone) throw new AppError("ZONE_NOT_FOUND", "Khu vực giao hàng không hợp lệ", 404);

  const slot = await prisma.deliverySlot.findFirst({
    where: { id: input.deliverySlotId, zoneId: zone.id },
  });
  if (!slot) throw new AppError("SLOT_NOT_FOUND", "Khung giờ giao không hợp lệ", 404);
  if (slot.bookedCount >= slot.capacity) {
    throw new AppError("SLOT_FULL", "Khung giờ đã đầy", 409);
  }

  const variantIds = input.items.map((i) => i.variantId);
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: variantIds }, active: true },
    include: { product: true },
  });

  if (variants.length !== variantIds.length) {
    throw new AppError("VARIANT_NOT_FOUND", "Sản phẩm không tồn tại", 404);
  }

  let subtotal = 0;
  const lineData: {
    variant: (typeof variants)[0];
    quantity: number;
  }[] = [];

  for (const item of input.items) {
    const variant = variants.find((v) => v.id === item.variantId);
    if (!variant) throw new AppError("VARIANT_NOT_FOUND", "Sản phẩm không tồn tại", 404);
    if (variant.availableQuantity < item.quantity) {
      throw new AppError(
        "INSUFFICIENT_STOCK",
        `${variant.product.name} không đủ số lượng`,
        409,
      );
    }
    lineData.push({ variant, quantity: item.quantity });
    subtotal += variant.priceVnd * item.quantity;
  }

  const deliveryFee = zone.feeVnd;
  const total = subtotal + deliveryFee;
  const paymentMode = process.env.PAYMENT_MODE ?? "dev_skip";
  const initialStatus = paymentMode === "dev_skip" ? "confirmed" : "pending_payment";

  const customer = await prisma.customer.create({
    data: {
      name: input.customer.name,
      email: input.customer.email,
      phone: input.customer.phone,
    },
  });

  const created = await prisma.order.create({
    data: {
      orderNumber: generateOrderNumber(),
      status: initialStatus,
      customerId: customer.id,
      recipientJson: input.recipient,
      deliveryZoneId: zone.id,
      deliverySlotId: slot.id,
      deliveryFeeVnd: deliveryFee,
      subtotalVnd: subtotal,
      totalVnd: total,
      messageCard: input.messageCard,
      idempotencyKey: idempotencyKey ?? null,
      items: {
        create: lineData.map(({ variant, quantity }) => ({
          productVariantId: variant.id,
          productName: variant.product.name,
          variantLabel: variant.sizeLabel,
          unitPriceVnd: variant.priceVnd,
          quantity,
        })),
      },
    },
  });

  await prisma.deliverySlot.update({
    where: { id: slot.id },
    data: { bookedCount: { increment: 1 } },
  });

  if (initialStatus === "confirmed") {
    for (const { variant, quantity } of lineData) {
      await prisma.productVariant.update({
        where: { id: variant.id },
        data: { availableQuantity: { decrement: quantity } },
      });
    }
  }

  return getOrderByNumber(created.orderNumber);
}
