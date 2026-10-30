import {
  floristPreferencesSchema,
  type FloristPreferences,
} from "@may-flower/shared";
import { prisma } from "../../lib/prisma.js";

export function parsePreferences(raw: unknown): FloristPreferences {
  const parsed = floristPreferencesSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : {};
}

export function mergePreferences(
  current: FloristPreferences,
  patch: Partial<FloristPreferences>,
): FloristPreferences {
  return { ...current, ...patch };
}

export function readyForConcepts(prefs: FloristPreferences): boolean {
  const hasBudget = Boolean(prefs.budgetVnd && Number(prefs.budgetVnd) > 0);
  const hasOccasion = Boolean(prefs.occasion?.trim());
  const hasStyleSignal = Boolean(
    prefs.colors?.trim() || prefs.style?.trim() || prefs.preferredFlowers?.trim(),
  );
  return (hasBudget && hasOccasion) || (hasBudget && hasStyleSignal) || (hasOccasion && hasStyleSignal);
}

export async function savePreferences(sessionId: string, prefs: FloristPreferences) {
  await prisma.floristSession.update({
    where: { id: sessionId },
    data: { preferencesJson: prefs },
  });
}

/** Lightweight extraction from user text when LLM is unavailable. */
export function extractPreferencesFromText(
  text: string,
  current: FloristPreferences,
): FloristPreferences {
  const patch: Partial<FloristPreferences> = {};
  const lower = text.toLowerCase();

  const budgetMatch = text.match(/(\d[\d.,\s]{4,12})\s*(?:vnd|đ|dong)?/i);
  if (budgetMatch) {
    const digits = budgetMatch[1]!.replace(/\D/g, "");
    if (digits.length >= 5) patch.budgetVnd = digits;
  }

  if (lower.includes("sinh nhật") || lower.includes("birthday")) patch.occasion = "sinh nhật";
  if (lower.includes("cảm ơn") || lower.includes("thank")) patch.occasion = patch.occasion ?? "cảm ơn";
  if (lower.includes("vợ") || lower.includes("wife")) patch.recipient = patch.recipient ?? "vợ";
  if (lower.includes("hồng") || lower.includes("pink")) {
    patch.colors = [current.colors, "hồng"].filter(Boolean).join(", ");
  }
  if (lower.includes("trắng") || lower.includes("white")) {
    patch.colors = [current.colors, "trắng"].filter(Boolean).join(", ");
  }

  return mergePreferences(current, patch);
}
