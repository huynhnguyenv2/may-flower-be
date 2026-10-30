import { prisma } from "../../lib/prisma.js";
import { completeChatWithTools, type ChatTurn } from "../llm/openai-tools.js";
import { completeChat, type ChatMessage } from "../llm/openai-client.js";
import {
  executeFloristTool,
  FLORIST_TOOL_DEFINITIONS,
  toolAnalyzeRequirements,
  toolGenerateConcepts,
} from "./tools.js";
import { buildSessionSummary } from "./summary.js";
import { readyForConcepts, parsePreferences } from "./preferences.js";
import type { FloristConcept } from "@may-flower/shared";

const MAX_TOOL_ROUNDS = 4;
const MAX_HISTORY = 12;

type MessageEffects = {
  concepts?: FloristConcept[];
  summary?: Awaited<ReturnType<typeof buildSessionSummary>>;
  status?: string;
};

function detectIntent(text: string): "concepts" | "select" | "addons" | "summary" | null {
  const lower = text.toLowerCase();
  if (
    lower.includes("gợi ý") ||
    lower.includes("thiết kế") ||
    lower.includes("design") ||
    lower.includes("xem mẫu")
  ) {
    return "concepts";
  }
  if (lower.includes("add-on") || lower.includes("addon") || lower.includes("quà kèm")) {
    return "addons";
  }
  if (lower.includes("tóm tắt") || lower.includes("summary") || lower.includes("tổng")) {
    return "summary";
  }
  return null;
}

async function rulesBasedReply(
  sessionId: string,
  content: string,
  locale: "vi" | "en",
): Promise<{ message: string; effects: MessageEffects }> {
  const effects: MessageEffects = {};
  await toolAnalyzeRequirements(sessionId, content);

  const session = await prisma.floristSession.findUnique({ where: { id: sessionId } });
  const prefs = parsePreferences(session?.preferencesJson);

  const intent = detectIntent(content);
  if (intent === "concepts" || readyForConcepts(prefs)) {
    if (readyForConcepts(prefs)) {
      const gen = await toolGenerateConcepts(sessionId, {
        revisionHint: content.slice(0, 200),
      });
      if ("concepts" in gen && gen.concepts) {
        effects.concepts = gen.concepts as FloristConcept[];
        effects.status = "recommending";
      }
    }
  }

  if (intent === "addons") {
    await executeFloristTool(sessionId, "recommend_addons", {});
  }

  effects.summary = (await buildSessionSummary(sessionId)) ?? undefined;
  effects.status = effects.summary?.status;

  const vi = !readyForConcepts(prefs)
    ? "Cảm ơn bạn! Bạn có thể chia thêm dịp, ngân sách (VND) hoặc tông màu — mình sẽ gợi ý vài concept minh họa."
    : effects.concepts?.length
      ? "Đây là vài concept tham khảo (giá ước tính từ studio). Chọn một mẫu hoặc nhờ chỉnh thêm nhé."
      : "Mình đã ghi nhận. Bạn có thể bấm «Xem concept» hoặc nhắn «gợi ý thiết kế» để xem mẫu.";

  const en = !readyForConcepts(prefs)
    ? "Thank you! Share occasion, budget (VND), or colors — I'll suggest illustrative concepts."
    : effects.concepts?.length
      ? "Here are reference concepts with estimated pricing. Pick one or ask for tweaks."
      : "Noted. Tap «View concepts» or ask for design suggestions.";

  return { message: locale === "en" ? en : vi, effects };
}

export async function handleFloristMessage(sessionId: string, content: string) {
  const session = await prisma.floristSession.findUnique({
    where: { id: sessionId },
    include: {
      messages: { orderBy: { createdAt: "desc" }, take: MAX_HISTORY },
    },
  });
  if (!session || session.expiresAt < new Date()) return null;
  if (session.status === "submitted") {
    return {
      source: "rules" as const,
      message:
        session.locale === "en"
          ? "This design session is already submitted. Our team will contact you soon."
          : "Phiên thiết kế đã gửi yêu cầu. Studio sẽ liên hệ bạn sớm nhé.",
    };
  }

  const locale = session.locale === "en" ? "en" : "vi";
  const trimmed = content.trim().slice(0, 2000);

  await prisma.floristMessage.create({
    data: { sessionId, role: "user", content: trimmed },
  });

  const systemVi = `Bạn là AI Florist của May Flower Studio (Đà Nẵng). Trả lời tiếng Việt trừ khi khách dùng tiếng Anh.
Luật: KHÔNG tự bịa giá hay sản phẩm — luôn gọi tools để lấy giá/add-on/concept.
Ảnh concept chỉ là minh họa tham khảo.
Khi đủ thông tin, gọi generate_design_concepts. Khi khách chọn concept, gọi select_design_concept với conceptId.
Không submit đơn — khách xác nhận trên màn hình tóm tắt.`;

  const systemEn = `You are May Flower Studio's AI Florist in Da Nang. Use tools for all prices and catalog data.
Design images are illustrative only. Do not submit orders — customer confirms in the summary UI.`;

  const history: ChatMessage[] = session.messages
    .slice()
    .reverse()
    .map((m) => ({
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: m.content,
    }));
  history.push({ role: "user", content: trimmed });

  let source: "openai" | "rules" = "openai";
  let effects: MessageEffects = {};
  let assistantText = "";

  const toolMessages: ChatTurn[] = [
    { role: "system", content: locale === "en" ? systemEn : systemVi },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];

  let round = 0;
  let llmResult = await completeChatWithTools(toolMessages, FLORIST_TOOL_DEFINITIONS);

  if (!llmResult) {
    source = "rules";
    const fallback = await rulesBasedReply(sessionId, trimmed, locale);
    assistantText = fallback.message;
    effects = fallback.effects;
  } else {
    while (llmResult && round < MAX_TOOL_ROUNDS) {
      round++;
      if (llmResult.toolCalls.length === 0) {
        assistantText = llmResult.content ?? "";
        break;
      }

      toolMessages.push({
        role: "assistant",
        content: llmResult.content ?? "",
        tool_calls: llmResult.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: { name: tc.name, arguments: tc.arguments },
        })),
      });

      for (const tc of llmResult.toolCalls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.arguments) as Record<string, unknown>;
        } catch {
          args = {};
        }
        if (tc.name === "analyze_customer_requirements" && !args.message) {
          args.message = trimmed;
        }
        const result = await executeFloristTool(sessionId, tc.name, args);
        if (result.concepts) {
          effects.concepts = result.concepts as FloristConcept[];
        }
        toolMessages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      }

      llmResult = await completeChatWithTools(
        toolMessages as Record<string, unknown>[],
        FLORIST_TOOL_DEFINITIONS,
      );
      if (!llmResult) break;
    }

    if (!assistantText && llmResult?.content) {
      assistantText = llmResult.content;
    }
    if (!assistantText) {
      const chatFallback = await completeChat(
        [
          { role: "system", content: locale === "en" ? systemEn : systemVi },
          ...history,
        ],
        { maxTokens: 400 },
      );
      assistantText =
        chatFallback ??
        (locale === "en"
          ? "I've updated your design. See concepts and summary on the right."
          : "Mình đã cập nhật thiết kế. Xem concept và tóm tắt bên phải nhé.");
    }
  }

  effects.summary = (await buildSessionSummary(sessionId)) ?? undefined;
  effects.status = effects.summary?.status;

  await prisma.floristMessage.create({
    data: {
      sessionId,
      role: "assistant",
      content: assistantText,
    },
  });

  return {
    source,
    message: assistantText,
    effects: {
      ...(effects.concepts ? { concepts: effects.concepts } : {}),
      ...(effects.summary ? { summary: effects.summary } : {}),
      ...(effects.status ? { status: effects.status } : {}),
    },
  };
}
