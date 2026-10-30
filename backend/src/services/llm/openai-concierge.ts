import type { ConciergeAnswers } from "@may-flower/shared";
import { z } from "zod";

export type ConciergeCandidate = {
  productId: string;
  variantId: string;
  slug: string;
  name: string;
  story: string;
  priceVnd: string;
  featured: boolean;
};

const llmPickSchema = z.object({
  picks: z
    .array(
      z.object({
        tier: z.enum(["safe", "signature", "unexpected"]),
        variantId: z.string().min(1),
        rationale: z.string().max(280).optional(),
      }),
    )
    .min(1)
    .max(3),
});

function isOpenAiEnabled(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function model(): string {
  return process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
}

/**
 * Ask ChatGPT to pick tiers from catalog candidates only. Returns null → caller uses rules.
 */
export async function pickConciergeWithOpenAi(
  answers: ConciergeAnswers,
  candidates: ConciergeCandidate[],
): Promise<z.infer<typeof llmPickSchema> | null> {
  if (!isOpenAiEnabled() || candidates.length === 0) return null;

  const allowedIds = new Set(candidates.map((c) => c.variantId));
  const catalogJson = candidates.slice(0, 20).map((c) => ({
    variantId: c.variantId,
    slug: c.slug,
    name: c.name,
    story: c.story,
    priceVnd: c.priceVnd,
    featured: c.featured,
  }));

  const system = `You are May Flower Studio's florist concierge in Da Nang, Vietnam.
Reply in JSON only. Pick up to 3 products from the provided catalog list—never invent products or variantIds.
Tiers: "safe" (accessible, within budget), "signature" (studio highlight), "unexpected" (distinctive).
Use Vietnamese for optional rationale (one short sentence).`;

  const user = JSON.stringify({
    customer: answers,
    catalog: catalogJson,
    rules: [
      "Each pick.variantId MUST be one of catalog[].variantId",
      "Prefer different products per tier when possible",
      "All prices are VND integers as strings",
    ],
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model(),
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.warn("[openai] chat/completions failed", res.status, await res.text());
      return null;
    }

    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = body.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = llmPickSchema.safeParse(JSON.parse(content));
    if (!parsed.success) {
      console.warn("[openai] invalid JSON shape", parsed.error.message);
      return null;
    }

    const picks = parsed.data.picks.filter((p) => allowedIds.has(p.variantId));
    if (picks.length === 0) return null;

    return { picks };
  } catch (err) {
    console.warn("[openai] concierge pick error", err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
