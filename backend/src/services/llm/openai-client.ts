export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export function openAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function openAiModel(): string {
  return process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
}

/** Plain-text chat completion; null on missing key or API failure. */
export async function completeChat(
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number },
): Promise<string | null> {
  if (!openAiConfigured()) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: openAiModel(),
        temperature: options?.temperature ?? 0.5,
        max_tokens: options?.maxTokens ?? 500,
        messages,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.warn("[openai] chat failed", res.status, await res.text());
      return null;
    }

    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = body.choices?.[0]?.message?.content?.trim();
    return content || null;
  } catch (err) {
    console.warn("[openai] chat error", err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
