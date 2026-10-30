import type { ChatMessage } from "../llm/openai-client.js";
import { completeChat } from "../llm/openai-client.js";
import { completeWithTools, type ChatTurn } from "../llm/openai-tools.js";
import {
  executeStaffTool,
  openAiToolSpecs,
  type StaffToolContext,
} from "./registry.js";
import * as q from "./data-queries.js";

const ORDER_NUMBER_RE = /\bMF\d{6,}\b/i;

function buildSystemPrompt(ctx: StaffToolContext): string {
  return `You are the internal operations copilot for nau.fleur (May Flower), florist in Da Nang, Vietnam.
Staff: ${ctx.staff.name}, roles: ${ctx.staff.roles.join(", ")}.
Use the provided tools to read live data before answering about orders, stock, or catalog. Never invent order numbers, prices, or quantities.
Answer in Vietnamese unless the staff writes in English. Be concise and actionable.
You cannot mutate data — suggest admin actions (order status, inventory adjust) when changes are needed.
Money is VND integer strings from tools.`;
}

async function rulesReply(
  ctx: StaffToolContext,
  lastUser: string,
): Promise<{ message: string; toolsUsed: string[] }> {
  const text = lastUser.toLowerCase();
  const toolsUsed: string[] = [];

  const orderMatch = lastUser.match(ORDER_NUMBER_RE);
  if (orderMatch) {
    toolsUsed.push("get_order");
    const order = await q.getOrderForStaff(orderMatch[0]!);
    if (!order) {
      return {
        message: `Không thấy đơn ${orderMatch[0].toUpperCase()} trong hệ thống.`,
        toolsUsed,
      };
    }
    return {
      message: `Đơn ${order.orderNumber}: trạng thái ${order.status}, khách ${order.customerName} (${order.customerPhone}), tổng ${order.totalVnd} VND, ${order.items.length} dòng hàng. Giao ${order.deliverySlot.date} ${order.deliverySlot.startTime}–${order.deliverySlot.endTime}.`,
      toolsUsed,
    };
  }

  if (
    text.includes("tồn kho") ||
    text.includes("low stock") ||
    text.includes("sắp hết") ||
    text.includes("còn bao nhiêu")
  ) {
    toolsUsed.push("list_low_stock");
    const low = await q.listLowStockVariants(12);
    if (low.length === 0) {
      return { message: "Không có biến thể nào đang báo tồn thấp (≤3).", toolsUsed };
    }
    const lines = low
      .map((v) => `- ${v.productName} (${v.sizeLabel}): còn ${v.availableQuantity}`)
      .join("\n");
    return { message: `Tồn thấp:\n${lines}`, toolsUsed };
  }

  if (
    text.includes("đơn") ||
    text.includes("order") ||
    text.includes("chờ thanh toán") ||
    text.includes("pending")
  ) {
    toolsUsed.push("get_operations_snapshot", "list_orders");
    const snap = await q.getOperationsSnapshot();
    const pending = await q.listOrdersForStaff({ status: "pending_payment", limit: 5 });
    const pendingLines =
      pending.length === 0
        ? "Không có đơn chờ TT."
        : pending.map((o) => `- ${o.orderNumber} · ${o.customerName} · ${o.totalVnd} VND`).join("\n");
    return {
      message: `Hôm nay: ${snap.ordersToday} đơn, doanh thu ${snap.revenueTodayVnd} VND. Chờ TT: ${snap.pendingPayment}, đang sản xuất: ${snap.inProduction}, chat khách mở: ${snap.openSupportSessions}.\nGần nhất chờ TT:\n${pendingLines}`,
      toolsUsed,
    };
  }

  if (text.includes("sản phẩm") || text.includes("hoa") || text.includes("catalog")) {
    const words = lastUser.split(/\s+/).filter((w) => w.length > 2);
    const query = words.slice(-3).join(" ") || "hoa";
    toolsUsed.push("search_products");
    const found = await q.searchProductsForStaff(query, 5);
    if (found.length === 0) {
      return { message: `Không tìm thấy sản phẩm khớp "${query}".`, toolsUsed };
    }
    const lines = found
      .map((p) => `- ${p.name}: từ ${p.fromPriceVnd} VND, tồn tổng ${p.totalAvailable}`)
      .join("\n");
    return { message: `Kết quả catalog:\n${lines}`, toolsUsed };
  }

  toolsUsed.push("get_operations_snapshot");
  const snap = await q.getOperationsSnapshot();
  return {
    message: `Tóm tắt: ${snap.ordersToday} đơn hôm nay, ${snap.pendingPayment} chờ TT, ${snap.inProduction} sản xuất, ${snap.lowStockVariants} SKU tồn thấp, doanh thu ${snap.revenueTodayVnd} VND. Hỏi mã đơn (MF…), tồn kho, hoặc tên sản phẩm để tra chi tiết.`,
    toolsUsed,
  };
}

export async function runStaffCopilot(
  ctx: StaffToolContext,
  history: ChatMessage[],
): Promise<{ message: string; source: "openai" | "rules"; toolsUsed: string[] }> {
  const trimmed = history.filter((m) => m.role === "user" || m.role === "assistant").slice(-16);
  const lastUser = [...trimmed].reverse().find((m) => m.role === "user")?.content ?? "";

  const tools = openAiToolSpecs();
  const turns: ChatTurn[] = [
    { role: "system", content: buildSystemPrompt(ctx) },
    ...trimmed.map((m) => ({ role: m.role, content: m.content })),
  ];

  const toolsUsed: string[] = [];
  let iterations = 0;

  while (iterations < 5) {
    iterations += 1;
    const result = await completeWithTools(turns, tools, { temperature: 0.35, maxTokens: 700 });
    if (!result?.message) break;

    const { message, finishReason } = result;
    const toolCalls = message.tool_calls;

    if (toolCalls?.length) {
      turns.push({
        role: "assistant",
        content: message.content ?? null,
        tool_calls: toolCalls,
      });

      for (const call of toolCalls) {
        toolsUsed.push(call.function.name);
        let parsedArgs: unknown = {};
        try {
          parsedArgs = JSON.parse(call.function.arguments || "{}");
        } catch {
          parsedArgs = {};
        }
        const toolResult = await executeStaffTool(call.function.name, parsedArgs, ctx);
        turns.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(toolResult),
        });
      }
      continue;
    }

    const content = message.content?.trim();
    if (content) {
      return { message: content, source: "openai", toolsUsed: [...new Set(toolsUsed)] };
    }

    if (finishReason === "stop") break;
    break;
  }

  const fallback = await completeChat(
    [
      { role: "system", content: buildSystemPrompt(ctx) },
      ...trimmed,
      {
        role: "system",
        content: `Tool data (JSON): ${JSON.stringify(await q.getOperationsSnapshot())}`,
      },
    ],
    { temperature: 0.4, maxTokens: 600 },
  );

  if (fallback) {
    return { message: fallback, source: "openai", toolsUsed: ["get_operations_snapshot"] };
  }

  const rules = await rulesReply(ctx, lastUser);
  return { message: rules.message, source: "rules", toolsUsed: rules.toolsUsed };
}
