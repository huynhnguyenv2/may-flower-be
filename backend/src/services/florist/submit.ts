import type { SubmitCustomOrderRequest } from "@may-flower/shared";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { parseSelectedAddons } from "./addons.js";
import { parseConfiguration } from "./mappers.js";
import { buildSessionSummary } from "./summary.js";

function generateRequestNumber(): string {
  const d = new Date();
  const y = d.getFullYear().toString().slice(-2);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `MFR${y}${m}${day}${rand}`;
}

export async function submitCustomOrderRequest(
  sessionId: string,
  input: SubmitCustomOrderRequest,
  idempotencyKey?: string,
) {
  if (idempotencyKey) {
    const existing = await prisma.customOrderRequest.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      return formatRequestResponse(existing);
    }
  }

  const session = await prisma.floristSession.findUnique({
    where: { id: sessionId },
    include: {
      concepts: {
        where: { status: "selected" },
        include: { images: { take: 1, orderBy: { createdAt: "desc" } } },
      },
      messages: { orderBy: { createdAt: "asc" }, take: 20 },
    },
  });

  if (!session || session.expiresAt < new Date()) {
    throw new AppError("SESSION_EXPIRED", "Phiên thiết kế đã hết hạn", 404);
  }
  if (session.status === "submitted") {
    throw new AppError("ALREADY_SUBMITTED", "Yêu cầu đã được gửi trước đó", 409);
  }

  const configuration = parseConfiguration(session.configurationJson);
  if (!configuration || configuration.stems.length === 0) {
    throw new AppError("INCOMPLETE_CONFIG", "Chưa chọn thiết kế hoặc cấu hình hoa", 400);
  }

  const zone = await prisma.deliveryZone.findFirst({
    where: { slug: input.deliveryZoneSlug, active: true },
  });
  if (!zone) throw new AppError("ZONE_NOT_FOUND", "Khu vực giao hàng không hợp lệ", 404);

  const slot = await prisma.deliverySlot.findFirst({
    where: { id: input.deliverySlotId, zoneId: zone.id },
  });
  if (!slot) throw new AppError("SLOT_NOT_FOUND", "Khung giờ giao không hợp lệ", 404);

  await prisma.floristSession.update({
    where: { id: sessionId },
    data: {
      deliveryZoneSlug: input.deliveryZoneSlug,
      deliverySlotId: input.deliverySlotId,
      messageCard: input.messageCard ?? session.messageCard,
      instructions: input.instructions ?? session.instructions,
    },
  });

  const summary = await buildSessionSummary(sessionId);
  if (!summary?.priceBreakdown) {
    throw new AppError("PRICING_ERROR", "Không tính được giá ước tính", 500);
  }

  const customer = await prisma.customer.create({
    data: {
      name: input.customer.name,
      email: input.customer.email,
      phone: input.customer.phone,
    },
  });

  const selectedAddons = parseSelectedAddons(session.selectedAddonsJson);
  const referenceImageUrl = session.concepts[0]?.images[0]?.storageUrl ?? null;

  const conversationSummary = session.messages
    .map((m) => `${m.role}: ${m.content.slice(0, 200)}`)
    .join("\n")
    .slice(0, 4000);

  const addonRows = await Promise.all(
    selectedAddons.map(async (row) => {
      const addon = await prisma.addon.findUnique({ where: { id: row.addonId } });
      if (!addon) return null;
      return {
        addonId: addon.id,
        name: addon.name,
        unitPriceVnd: addon.priceVnd,
        quantity: row.quantity,
      };
    }),
  );

  const request = await prisma.customOrderRequest.create({
    data: {
      requestNumber: generateRequestNumber(),
      status: "pending_review",
      sessionId,
      customerId: customer.id,
      recipientJson: input.recipient,
      deliveryZoneId: zone.id,
      deliverySlotId: slot.id,
      deliveryFeeVnd: zone.feeVnd,
      messageCard: input.messageCard ?? session.messageCard,
      instructions: input.instructions ?? session.instructions,
      conversationSummary,
      configurationJson: configuration,
      pricingJson: summary.priceBreakdown,
      referenceImageUrl,
      idempotencyKey: idempotencyKey ?? null,
      ...(addonRows.filter(Boolean).length
        ? {
            addons: {
              create: addonRows.filter(Boolean) as {
                addonId: string;
                name: string;
                unitPriceVnd: number;
                quantity: number;
              }[],
            },
          }
        : {}),
    },
  });

  await prisma.floristSession.update({
    where: { id: sessionId },
    data: { status: "submitted", confirmedAt: new Date() },
  });

  return formatRequestResponse(request, summary.priceBreakdown);
}

function formatRequestResponse(
  request: { requestNumber: string; status: string; pricingJson: unknown },
  pricingOverride?: unknown,
) {
  const pricing = (pricingOverride ?? request.pricingJson) as {
    totalVnd: string;
  };
  return {
    requestNumber: request.requestNumber,
    status: request.status as "pending_review",
    totalVnd: pricing.totalVnd,
    pricing,
  };
}
