import { vndToString } from "@may-flower/shared";
import { completeChat, type ChatMessage } from "./llm/openai-client.js";
import { prisma } from "../lib/prisma.js";

function startOfTodayUtc(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

async function buildStaffContext(staff: { name: string; roles: string[] }): Promise<string> {
  const since = startOfTodayUtc();
  const [ordersToday, pendingPayment, inProduction, lowStock] = await Promise.all([
    prisma.order.count({ where: { createdAt: { gte: since } } }),
    prisma.order.count({ where: { status: "pending_payment" } }),
    prisma.order.count({ where: { status: "in_production" } }),
    prisma.productVariant.count({
      where: { active: true, availableQuantity: { lte: 3, gt: 0 } },
    }),
  ]);

  return `You are the internal operations copilot for nau.fleur (May Flower), a florist in Da Nang, Vietnam.
Staff user: ${staff.name}, roles: ${staff.roles.join(", ")}.
Live snapshot (server time UTC): orders created today=${ordersToday}, pending_payment=${pendingPayment}, in_production=${inProduction}, variants with limited stock (1-3)=${lowStock}.
Answer in Vietnamese unless the staff writes in English. Be concise and actionable.
You cannot change data — only suggest steps (admin panel, order status, catalog). Do not invent order IDs or customer PII.
Money is VND integers.`;
}

export async function staffAssistantReply(
  staff: { name: string; roles: string[] },
  history: ChatMessage[],
): Promise<{ message: string; source: "openai" | "rules" }> {
  const trimmed = history.filter((m) => m.role === "user" || m.role === "assistant").slice(-16);
  const system = await buildStaffContext(staff);

  const llmMessages: ChatMessage[] = [{ role: "system", content: system }, ...trimmed];
  const reply = await completeChat(llmMessages, { temperature: 0.45, maxTokens: 700 });

  if (reply) {
    return { message: reply, source: "openai" };
  }

  return {
    message:
      "Trợ lý AI chưa bật (thiếu OPENAI_API_KEY trên server). Bạn vẫn xem tab Chat khách và đơn hàng bình thường.",
    source: "rules",
  };
}

/** Optional: expose a one-line stats blob for UI headers */
export async function staffAssistantStats() {
  const since = startOfTodayUtc();
  const pending = await prisma.order.count({ where: { status: "pending_payment" } });
  const today = await prisma.order.count({ where: { createdAt: { gte: since } } });
  const revenueToday = await prisma.order.aggregate({
    where: { createdAt: { gte: since }, status: { not: "cancelled" } },
    _sum: { totalVnd: true },
  });
  return {
    ordersToday: today,
    pendingPayment: pending,
    revenueTodayVnd: vndToString(revenueToday._sum.totalVnd ?? 0),
  };
}
