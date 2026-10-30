import {
  floristDesignConfigurationSchema,
  floristUpdateConfigurationSchema,
  floristUpdateSessionSchema,
  type FloristDesignConfiguration,
} from "@may-flower/shared";
import { prisma } from "../../lib/prisma.js";
import { parseConfiguration } from "./mappers.js";
import { buildSessionSummary } from "./summary.js";

export async function updateDesignConfiguration(
  sessionId: string,
  patch: Partial<FloristDesignConfiguration>,
) {
  const parsed = floristUpdateConfigurationSchema.safeParse(patch);
  if (!parsed.success) return { error: "VALIDATION_ERROR" as const };

  const session = await prisma.floristSession.findUnique({ where: { id: sessionId } });
  if (!session) return { error: "SESSION_NOT_FOUND" as const };

  const current =
    parseConfiguration(session.configurationJson) ??
    floristDesignConfigurationSchema.parse({ stems: [], materials: [], sizeTier: "classic" });

  const merged = floristDesignConfigurationSchema.parse({
    ...current,
    ...parsed.data,
    stems: parsed.data.stems ?? current.stems,
    materials: parsed.data.materials ?? current.materials,
  });

  await prisma.floristSession.update({
    where: { id: sessionId },
    data: {
      configurationJson: merged,
      status: session.status === "collecting" ? "customizing" : session.status,
    },
  });

  const summary = await buildSessionSummary(sessionId);
  return { configuration: merged, summary };
}

export async function updateSessionFields(
  sessionId: string,
  body: unknown,
) {
  const parsed = floristUpdateSessionSchema.safeParse(body);
  if (!parsed.success) return null;

  await prisma.floristSession.update({
    where: { id: sessionId },
    data: {
      ...(parsed.data.addons !== undefined
        ? { selectedAddonsJson: parsed.data.addons }
        : {}),
      ...(parsed.data.messageCard !== undefined
        ? { messageCard: parsed.data.messageCard }
        : {}),
      ...(parsed.data.instructions !== undefined
        ? { instructions: parsed.data.instructions }
        : {}),
      ...(parsed.data.deliveryZoneSlug !== undefined
        ? { deliveryZoneSlug: parsed.data.deliveryZoneSlug }
        : {}),
      ...(parsed.data.deliverySlotId !== undefined
        ? { deliverySlotId: parsed.data.deliverySlotId }
        : {}),
    },
  });

  return buildSessionSummary(sessionId);
}
