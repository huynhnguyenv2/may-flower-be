import {
  floristPreferencesSchema,
  type FloristSessionSummary,
} from "@may-flower/shared";
import { prisma } from "../../lib/prisma.js";
import { parseSelectedAddons } from "./addons.js";
import { mapConceptRow, parseConfiguration } from "./mappers.js";
import { parsePreferences } from "./preferences.js";
import { calculateFloristPrice } from "./pricing.js";

export async function buildSessionSummary(sessionId: string): Promise<FloristSessionSummary | null> {
  const session = await prisma.floristSession.findUnique({
    where: { id: sessionId },
    include: {
      concepts: {
        where: { status: "selected" },
        take: 1,
        include: { images: { take: 1, orderBy: { createdAt: "desc" } } },
      },
    },
  });
  if (!session) return null;

  const preferences = parsePreferences(session.preferencesJson);
  floristPreferencesSchema.parse(preferences);

  const configuration = parseConfiguration(session.configurationJson);
  const selectedAddons = parseSelectedAddons(session.selectedAddonsJson);

  let priceBreakdown = null;
  if (configuration && configuration.stems.length > 0) {
    priceBreakdown = await calculateFloristPrice({
      configuration,
      addons: selectedAddons,
      deliveryZoneSlug: session.deliveryZoneSlug ?? undefined,
    });
    await prisma.floristSession.update({
      where: { id: sessionId },
      data: { pricingSnapshotJson: priceBreakdown },
    });
  }

  const selectedConcept = session.concepts[0] ? mapConceptRow(session.concepts[0]) : null;

  return {
    sessionId: session.id,
    status: session.status,
    locale: session.locale === "en" ? "en" : "vi",
    preferences,
    configuration,
    selectedAddons,
    priceBreakdown,
    selectedConcept,
    messageCard: session.messageCard,
    instructions: session.instructions,
    deliveryZoneSlug: session.deliveryZoneSlug,
    deliverySlotId: session.deliverySlotId,
  };
}
