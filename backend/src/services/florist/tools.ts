import type { FloristPreferences } from "@may-flower/shared";
import { listAvailableAddons, recommendAddonIds } from "./addons.js";
import { generateDesignConcepts, selectConcept } from "./concepts.js";
import { updateDesignConfiguration, updateSessionFields } from "./configuration.js";
import {
  extractPreferencesFromText,
  mergePreferences,
  parsePreferences,
  readyForConcepts,
  savePreferences,
} from "./preferences.js";
import { calculateFloristPrice } from "./pricing.js";
import { buildSessionSummary } from "./summary.js";
import { prisma } from "../../lib/prisma.js";
import { parseConfiguration } from "./mappers.js";
import { parseSelectedAddons } from "./addons.js";

export type ToolResult = Record<string, unknown>;

export async function toolAnalyzeRequirements(
  sessionId: string,
  message: string,
): Promise<ToolResult> {
  const session = await prisma.floristSession.findUnique({ where: { id: sessionId } });
  if (!session) return { error: "SESSION_NOT_FOUND" };

  const current = parsePreferences(session.preferencesJson);
  const merged = extractPreferencesFromText(message, current);
  await savePreferences(sessionId, merged);

  const missingOptional: string[] = [];
  if (!merged.recipient) missingOptional.push("recipient");
  if (!merged.budgetVnd) missingOptional.push("budgetVnd");
  if (!merged.deliveryDate) missingOptional.push("deliveryDate");

  return {
    preferences: merged,
    missingOptional,
    readyForConcepts: readyForConcepts(merged),
  };
}

export async function toolGenerateConcepts(
  sessionId: string,
  args: { revisionHint?: string; count?: number },
): Promise<ToolResult> {
  const result = await generateDesignConcepts(sessionId, args);
  if ("error" in result) return { error: result.error };
  return { concepts: result.concepts, batchId: result.batchId };
}

export async function toolUpdateConfiguration(
  sessionId: string,
  patch: Record<string, unknown>,
): Promise<ToolResult> {
  const result = await updateDesignConfiguration(sessionId, patch);
  if ("error" in result) return { error: result.error };
  return { configuration: result.configuration, summary: result.summary };
}

export async function toolGetAvailableAddons(): Promise<ToolResult> {
  return { addons: await listAvailableAddons() };
}

export async function toolRecommendAddons(sessionId: string): Promise<ToolResult> {
  const session = await prisma.floristSession.findUnique({ where: { id: sessionId } });
  if (!session) return { error: "SESSION_NOT_FOUND" };

  const prefs = parsePreferences(session.preferencesJson);
  const summary = await buildSessionSummary(sessionId);
  const budget = Number(prefs.budgetVnd ?? 0);
  const spent = Number(summary?.priceBreakdown?.subtotalVnd ?? 0);
  const ids = await recommendAddonIds({
    occasion: prefs.occasion,
    budgetRemainingVnd: budget > 0 ? Math.max(0, budget - spent) : undefined,
  });
  const addons = (await listAvailableAddons()).filter((a) => ids.includes(a.id));
  return { recommendedAddonIds: ids, addons };
}

export async function toolCalculatePrice(sessionId: string): Promise<ToolResult> {
  const session = await prisma.floristSession.findUnique({ where: { id: sessionId } });
  if (!session) return { error: "SESSION_NOT_FOUND" };

  const config = parseConfiguration(session.configurationJson);
  if (!config) return { error: "NO_CONFIGURATION" };

  const addons = parseSelectedAddons(session.selectedAddonsJson);
  const breakdown = await calculateFloristPrice({
    configuration: config,
    addons,
    deliveryZoneSlug: session.deliveryZoneSlug ?? undefined,
  });
  return { priceBreakdown: breakdown };
}

export async function toolGetOrderSummary(sessionId: string): Promise<ToolResult> {
  const summary = await buildSessionSummary(sessionId);
  if (!summary) return { error: "SESSION_NOT_FOUND" };
  return { summary };
}

export async function toolSelectConcept(
  sessionId: string,
  conceptId: string,
): Promise<ToolResult> {
  const concept = await selectConcept(sessionId, conceptId);
  if (!concept) return { error: "CONCEPT_NOT_FOUND" };
  const summary = await buildSessionSummary(sessionId);
  return { selectedConcept: concept, summary };
}

export async function toolPatchPreferences(
  sessionId: string,
  patch: Partial<FloristPreferences>,
): Promise<ToolResult> {
  const session = await prisma.floristSession.findUnique({ where: { id: sessionId } });
  if (!session) return { error: "SESSION_NOT_FOUND" };
  const merged = mergePreferences(parsePreferences(session.preferencesJson), patch);
  await savePreferences(sessionId, merged);
  return { preferences: merged, readyForConcepts: readyForConcepts(merged) };
}

export async function toolUpdateOrderConfiguration(
  sessionId: string,
  body: Record<string, unknown>,
): Promise<ToolResult> {
  const summary = await updateSessionFields(sessionId, body);
  if (!summary) return { error: "VALIDATION_ERROR" };
  return { summary };
}

export const FLORIST_TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "analyze_customer_requirements",
      description: "Extract and merge customer preferences from the conversation.",
      parameters: {
        type: "object",
        properties: {
          message: { type: "string", description: "Latest user message to analyze" },
        },
        required: ["message"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "generate_design_concepts",
      description: "Create 3-4 design concepts with server pricing and reference images.",
      parameters: {
        type: "object",
        properties: {
          revisionHint: { type: "string" },
          count: { type: "number" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_design_configuration",
      description: "Patch stem counts, materials, or size tier on the active configuration.",
      parameters: {
        type: "object",
        properties: {
          sizeTier: { type: "string", enum: ["petite", "classic", "grand"] },
          stems: {
            type: "array",
            items: {
              type: "object",
              properties: {
                flowerId: { type: "string" },
                quantity: { type: "number" },
              },
            },
          },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_available_addons",
      description: "List add-ons with server prices.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "recommend_addons",
      description: "Recommend add-on ids for this session.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "calculate_order_price",
      description: "Compute full price breakdown from current configuration.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_order_summary",
      description: "Get live order summary for the session.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "select_design_concept",
      description: "Mark a design concept as selected and seed configuration.",
      parameters: {
        type: "object",
        properties: { conceptId: { type: "string" } },
        required: ["conceptId"],
      },
    },
  },
];

export async function executeFloristTool(
  sessionId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  switch (name) {
    case "analyze_customer_requirements":
      return toolAnalyzeRequirements(sessionId, String(args.message ?? ""));
    case "generate_design_concepts":
      return toolGenerateConcepts(sessionId, {
        revisionHint: args.revisionHint as string | undefined,
        count: args.count as number | undefined,
      });
    case "update_design_configuration":
      return toolUpdateConfiguration(sessionId, args);
    case "get_available_addons":
      return toolGetAvailableAddons();
    case "recommend_addons":
      return toolRecommendAddons(sessionId);
    case "calculate_order_price":
      return toolCalculatePrice(sessionId);
    case "get_order_summary":
      return toolGetOrderSummary(sessionId);
    case "select_design_concept":
      return toolSelectConcept(sessionId, String(args.conceptId ?? ""));
    default:
      return { error: "UNKNOWN_TOOL" };
  }
}
