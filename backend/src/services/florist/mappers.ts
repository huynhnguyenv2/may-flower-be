import {
  floristDesignConfigurationSchema,
  vndToString,
  type FloristConcept,
  type FloristDesignConfiguration,
} from "@may-flower/shared";
import type { FlowerDesignConcept, GeneratedDesignImage } from "@prisma/client";

type ConceptWithImages = FlowerDesignConcept & {
  images?: GeneratedDesignImage[];
};

export function mapConceptRow(row: ConceptWithImages): FloristConcept {
  const image = row.images?.[0];
  return {
    id: row.id,
    name: row.name,
    descriptionVi: row.descriptionVi,
    palette: row.palette,
    style: row.style,
    sizeHint: row.sizeHint,
    estimatedSubtotalVnd: vndToString(row.estimatedSubtotalVnd),
    status: row.status as FloristConcept["status"],
    composition: row.compositionJson as Record<string, unknown>,
    ...(image
      ? {
          image: {
            url: image.storageUrl,
            illustrative: image.illustrative,
            disclaimer: image.disclaimer,
          },
        }
      : {}),
  };
}

export function parseConfiguration(raw: unknown): FloristDesignConfiguration | null {
  const parsed = floristDesignConfigurationSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
