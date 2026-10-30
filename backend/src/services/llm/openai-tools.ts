import { openAiConfigured, openAiModel } from "./openai-client.js";

export type ToolCall = {
  id: string;
  name: string;
  arguments: string;
};

export type AssistantToolResult = {
  content: string | null;
  toolCalls: ToolCall[];
};

type OpenAiTool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

/** Staff copilot / multi-turn tool loop */
export type ChatTurn = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: {
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }[];
  tool_call_id?: string;
};

type OpenAiAssistantMessage = {
  content?: string | null;
  tool_calls?: ChatTurn["tool_calls"];
};

export async function completeWithTools(
  turns: ChatTurn[],
  tools: OpenAiTool[],
  options?: { temperature?: number; maxTokens?: number },
): Promise<{ message: OpenAiAssistantMessage; finishReason: string } | null> {
  if (!openAiConfigured()) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: openAiModel(),
        temperature: options?.temperature ?? 0.55,
        max_tokens: options?.maxTokens ?? 700,
        messages: turns,
        tools,
        tool_choice: "auto",
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.warn("[openai] tools chat failed", res.status, await res.text());
      return null;
    }

    const body = (await res.json()) as {
      choices?: { message?: OpenAiAssistantMessage; finish_reason?: string }[];
    };

    const choice = body.choices?.[0];
    if (!choice?.message) return null;

    return {
      message: choice.message,
      finishReason: choice.finish_reason ?? "stop",
    };
  } catch (err) {
    console.warn("[openai] tools chat error", err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Florist orchestrator — single completion with parsed tool calls */
export async function completeChatWithTools(
  messages: Record<string, unknown>[],
  tools: OpenAiTool[],
  options?: { temperature?: number; maxTokens?: number },
): Promise<AssistantToolResult | null> {
  const result = await completeWithTools(messages as ChatTurn[], tools, options);
  if (!result) return null;

  const toolCalls =
    result.message.tool_calls?.map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: tc.function.arguments,
    })) ?? [];

  return {
    content: result.message.content?.trim() || null,
    toolCalls,
  };
}
