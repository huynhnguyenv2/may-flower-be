import { CustomOrderRequestStatus } from "@prisma/client";
import { vndToString } from "@may-flower/shared";
import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";

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
    include: { customer: true, addons: true, session: { include: { messages: { take: 30 } } } },
  });
  if (!r) throw new AppError("NOT_FOUND", "Không tìm thấy yêu cầu", 404);

  return {
    id: r.id,
    requestNumber: r.requestNumber,
    status: r.status,
    customer: r.customer,
    recipient: r.recipientJson,
    pricing: r.pricingJson,
    configuration: r.configurationJson,
    conversationSummary: r.conversationSummary,
    messageCard: r.messageCard,
    instructions: r.instructions,
    referenceImageUrl: r.referenceImageUrl,
    addons: r.addons,
    messages: r.session.messages.map((m) => ({
      role: m.role,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })),
    createdAt: r.createdAt.toISOString(),
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

/** Stub: staff converts approved request into a manual order later (B3 integration). */
export async function convertCustomOrderRequestToOrder(_id: string) {
  throw new AppError(
    "NOT_IMPLEMENTED",
    "Chuyển sang đơn hàng sẽ được bổ sung khi tích hợp production order",
    501,
  );
}
