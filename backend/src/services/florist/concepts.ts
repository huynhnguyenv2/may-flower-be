import { randomUUID } from "node:crypto";
import { vndToString, type FloristConcept, type FloristPreferences } from "@may-flower/shared";
import { prisma } from "../../lib/prisma.js";
import { previewConfigurationSubtotal } from "./pricing.js";
import type { FloristDesignConfiguration } from "@may-flower/shared";
import {
  buildImagePrompt,
  generateDesignImageUrl,
  imageDisclaimer,
  openAiImageModel,
} from "./images.js";
import { mapConceptRow } from "./mappers.js";

const MAX_BATCHES = Number(process.env.FLORIST_MAX_CONCEPT_BATCHES ?? "3");
const CONCEPTS_PER_BATCH = 4;

const STYLE_VARIANTS = [
  { style: "romantic", suffix: "Dịu dàng" },
  { style: "modern minimal", suffix: "Tối giản" },
  { style: "luxury garden", suffix: "Sang trọng" },
  { style: "natural wild", suffix: "Tự nhiên" },
];

async function pickFlowersForPalette(colors?: string) {
  const flowers = await prisma.flower.findMany({ where: { active: true, unitPriceVnd: { gt: 0 } } });
  if (flowers.length === 0) return flowers;

  const colorHint = (colors ?? "").toLowerCase();
  const filtered = flowers.filter((f) => {
    if (!colorHint) return true;
    return f.colorTags.some((c) => colorHint.includes(c.toLowerCase()) || c.toLowerCase().includes(colorHint));
  });

  return (filtered.length >= 2 ? filtered : flowers).slice(0, 8);
}

function buildComposition(
  flowers: { id: string; name: string; unitPriceVnd: number }[],
  sizeTier: "petite" | "classic" | "grand",
  index: number,
): FloristDesignConfiguration {
  const baseQty = sizeTier === "petite" ? 5 : sizeTier === "grand" ? 15 : 10;
  const stems = flowers.slice(0, 3).map((f, i) => ({
    flowerId: f.id,
    quantity: baseQty + i * 2 + index,
  }));

  return {
    sizeTier,
    stems,
    materials: [],
  };
}

export async function generateDesignConcepts(
  sessionId: string,
  input: { revisionHint?: string; count?: number },
): Promise<{ concepts: FloristConcept[]; batchId: string } | { error: string }> {
  const session = await prisma.floristSession.findUnique({ where: { id: sessionId } });
  if (!session) return { error: "SESSION_NOT_FOUND" };
  if (session.conceptBatchCount >= MAX_BATCHES) {
    return { error: "CONCEPT_LIMIT_REACHED" };
  }

  const prefs = (session.preferencesJson ?? {}) as FloristPreferences;
  const budget = Number(prefs.budgetVnd ?? "1500000");
  const sizeTier =
    prefs.sizeHint?.includes("lớn") || prefs.sizeHint?.includes("grand")
      ? "grand"
      : prefs.sizeHint?.includes("nhỏ")
        ? "petite"
        : "classic";

  const flowers = await pickFlowersForPalette(prefs.colors);
  if (flowers.length === 0) return { error: "NO_FLOWERS_CATALOG" };

  const wrapping = await prisma.material.findFirst({
    where: { active: true, kind: "wrapping" },
  });
  const ribbon = await prisma.material.findFirst({
    where: { active: true, kind: "ribbon" },
  });

  const batchId = randomUUID();
  const count = Math.min(input.count ?? CONCEPTS_PER_BATCH, CONCEPTS_PER_BATCH);
  const created: FloristConcept[] = [];

  for (let i = 0; i < count; i++) {
    const variant = STYLE_VARIANTS[i % STYLE_VARIANTS.length]!;
    const config = buildComposition(flowers, sizeTier, i);
    if (wrapping) {
      config.materials.push({ materialId: wrapping.id, quantity: 1 });
    }
    if (ribbon) {
      config.materials.push({ materialId: ribbon.id, quantity: 1 });
    }

    let subtotal = await previewConfigurationSubtotal(config);
    if (subtotal > budget * 1.15) {
      config.stems = config.stems.map((s) => ({
        ...s,
        quantity: Math.max(3, Math.floor(s.quantity * 0.7)),
      }));
      subtotal = await previewConfigurationSubtotal(config);
    }

    const name = `${prefs.occasion ? prefs.occasion : "Bó hoa"} — ${variant.suffix}`;
    const palette = prefs.colors?.trim() || "pastel mixed";
    const descriptionVi =
      input.revisionHint?.trim() ||
      `Concept ${variant.style}: ${palette}. Ước tính phù hợp ngân sách ~${vndToString(budget)} VND.`;

    const concept = await prisma.flowerDesignConcept.create({
      data: {
        sessionId,
        batchId,
        name,
        descriptionVi,
        compositionJson: config,
        palette,
        style: variant.style,
        sizeHint: sizeTier,
        estimatedSubtotalVnd: subtotal,
        status: "offered",
      },
      include: { images: true },
    });

    const compositionSummary = config.stems
      .map((s) => {
        const f = flowers.find((x) => x.id === s.flowerId);
        return f ? `${f.name}×${s.quantity}` : "";
      })
      .filter(Boolean)
      .join(", ");

    const prompt = buildImagePrompt({
      name,
      palette,
      style: variant.style,
      compositionSummary,
    });

    const url = await generateDesignImageUrl(prompt);
    if (url) {
      await prisma.generatedDesignImage.create({
        data: {
          conceptId: concept.id,
          storageUrl: url,
          provider: "openai",
          model: openAiImageModel(),
          prompt,
          disclaimer: imageDisclaimer(),
          illustrative: true,
        },
      });
    }

    const withImage = await prisma.flowerDesignConcept.findUnique({
      where: { id: concept.id },
      include: { images: { take: 1, orderBy: { createdAt: "desc" } } },
    });
    if (withImage) created.push(mapConceptRow(withImage));
  }

  await prisma.floristSession.update({
    where: { id: sessionId },
    data: {
      conceptBatchCount: { increment: 1 },
      status: "recommending",
    },
  });

  return { concepts: created, batchId };
}

export async function selectConcept(sessionId: string, conceptId: string) {
  const concept = await prisma.flowerDesignConcept.findFirst({
    where: { id: conceptId, sessionId },
    include: { images: { take: 1, orderBy: { createdAt: "desc" } } },
  });
  if (!concept) return null;

  await prisma.flowerDesignConcept.updateMany({
    where: { sessionId, id: { not: conceptId } },
    data: { status: "rejected" },
  });
  await prisma.flowerDesignConcept.update({
    where: { id: conceptId },
    data: { status: "selected" },
  });

  const config = concept.compositionJson as FloristDesignConfiguration;
  config.conceptId = conceptId;
  config.designName = concept.name;

  await prisma.floristSession.update({
    where: { id: sessionId },
    data: {
      selectedConceptId: conceptId,
      configurationJson: config,
      status: "customizing",
    },
  });

  return mapConceptRow({ ...concept, status: "selected" });
}

export async function listSessionConcepts(sessionId: string): Promise<FloristConcept[]> {
  const rows = await prisma.flowerDesignConcept.findMany({
    where: { sessionId, status: { in: ["offered", "selected"] } },
    orderBy: { createdAt: "desc" },
    include: { images: { take: 1, orderBy: { createdAt: "desc" } } },
  });
  return rows.map(mapConceptRow);
}
