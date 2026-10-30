const IMAGE_DISCLAIMER =
  "Hình minh họa tham khảo — sản phẩm thực tế có thể khác tùy hoa mùa và tay nghề florist.";

export function imageDisclaimer(): string {
  return IMAGE_DISCLAIMER;
}

export function openAiImageModel(): string {
  return process.env.OPENAI_IMAGE_MODEL?.trim() || "dall-e-2";
}

export async function generateDesignImageUrl(prompt: string): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;

  const model = openAiImageModel();
  const size = model.includes("dall-e-3") ? "1024x1024" : "512x512";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt,
        n: 1,
        size,
        response_format: "url",
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.warn("[openai] image failed", res.status, await res.text());
      return null;
    }

    const body = (await res.json()) as { data?: { url?: string }[] };
    return body.data?.[0]?.url ?? null;
  } catch (err) {
    console.warn("[openai] image error", err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export function buildImagePrompt(input: {
  name: string;
  palette: string;
  style: string;
  compositionSummary: string;
}): string {
  return `Editorial florist bouquet reference photo, ${input.style}, color palette ${input.palette}. ${input.compositionSummary}. Soft natural light, premium studio styling, shallow depth of field. No text, no watermark, no faces.`;
}
