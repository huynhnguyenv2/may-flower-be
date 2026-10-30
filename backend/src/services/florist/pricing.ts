import {
  floristDesignConfigurationSchema,
  floristAddonLineSchema,
  vndToString,
  type FloristDesignConfiguration,
  type FloristPriceBreakdown,
  type FloristAddonLine,
} from "@may-flower/shared";
import { prisma } from "../../lib/prisma.js";

const SIZE_MULTIPLIER: Record<string, number> = {
  petite: 0.75,
  classic: 1,
  grand: 1.35,
};

const DEFAULT_LABOR: Record<string, number> = {
  petite: 120_000,
  classic: 180_000,
  grand: 250_000,
};

function currentMonth(): number {
  return new Date().getMonth() + 1;
}

function isFlowerInSeason(seasonalFrom: number | null, seasonalTo: number | null): boolean {
  if (seasonalFrom == null || seasonalTo == null) return true;
  const m = currentMonth();
  if (seasonalFrom <= seasonalTo) {
    return m >= seasonalFrom && m <= seasonalTo;
  }
  return m >= seasonalFrom || m <= seasonalTo;
}

export type PricingInput = {
  configuration: FloristDesignConfiguration;
  addons?: FloristAddonLine[];
  deliveryZoneSlug?: string;
};

export async function calculateFloristPrice(input: PricingInput): Promise<FloristPriceBreakdown> {
  const config = floristDesignConfigurationSchema.parse(input.configuration);
  const addons = (input.addons ?? []).map((a) => floristAddonLineSchema.parse(a));

  const warnings: string[] = [];
  const lines: { label: string; amountVnd: string }[] = [];

  let stemsSubtotal = 0;
  for (const stem of config.stems) {
    const flower = await prisma.flower.findUnique({ where: { id: stem.flowerId } });
    if (!flower || !flower.active) {
      warnings.push(`Hoa không khả dụng: ${stem.flowerId}`);
      continue;
    }
    if (!isFlowerInSeason(flower.seasonalFrom, flower.seasonalTo)) {
      warnings.push(`${flower.name} có thể ngoài mùa — studio sẽ xác nhận lại`);
    }
    const lineTotal = flower.unitPriceVnd * stem.quantity;
    stemsSubtotal += lineTotal;
    lines.push({
      label: `${flower.name} × ${stem.quantity}`,
      amountVnd: vndToString(lineTotal),
    });
  }

  let materialsSubtotal = 0;
  for (const mat of config.materials) {
    const material = await prisma.material.findUnique({ where: { id: mat.materialId } });
    if (!material || !material.active) {
      warnings.push(`Vật liệu không khả dụng: ${mat.materialId}`);
      continue;
    }
    const lineTotal = material.unitPriceVnd * mat.quantity;
    materialsSubtotal += lineTotal;
    lines.push({
      label: `${material.name} × ${mat.quantity}`,
      amountVnd: vndToString(lineTotal),
    });
  }

  const tier = config.sizeTier ?? "classic";
  const multiplier = SIZE_MULTIPLIER[tier] ?? 1;
  const labor =
    config.laborFeeVnd ?? DEFAULT_LABOR[tier] ?? DEFAULT_LABOR.classic;

  const arrangementBase = Math.round((stemsSubtotal + materialsSubtotal) * multiplier);
  if (multiplier !== 1) {
    lines.push({
      label: `Quy mô (${tier})`,
      amountVnd: vndToString(arrangementBase - stemsSubtotal - materialsSubtotal),
    });
  }

  lines.push({ label: "Công thiết kế", amountVnd: vndToString(labor) });

  let addonsSubtotal = 0;
  for (const row of addons) {
    const addon = await prisma.addon.findUnique({ where: { id: row.addonId } });
    if (!addon || !addon.active) {
      warnings.push(`Add-on không khả dụng: ${row.addonId}`);
      continue;
    }
    const lineTotal = addon.priceVnd * row.quantity;
    addonsSubtotal += lineTotal;
    lines.push({
      label: `${addon.name} × ${row.quantity}`,
      amountVnd: vndToString(lineTotal),
    });
  }

  const subtotal = arrangementBase + labor + addonsSubtotal;

  let deliveryFee = 0;
  if (input.deliveryZoneSlug) {
    const zone = await prisma.deliveryZone.findFirst({
      where: { slug: input.deliveryZoneSlug, active: true },
    });
    if (zone) {
      deliveryFee = zone.feeVnd;
      lines.push({ label: `Phí giao (${zone.name})`, amountVnd: vndToString(deliveryFee) });
    }
  }

  const total = subtotal + deliveryFee;

  return {
    lines,
    subtotalVnd: vndToString(subtotal),
    ...(deliveryFee > 0 ? { deliveryFeeVnd: vndToString(deliveryFee) } : {}),
    totalVnd: vndToString(total),
    ...(warnings.length ? { warnings } : {}),
  };
}

/** Preview subtotal for stems/materials only (no delivery). */
export async function previewConfigurationSubtotal(
  configuration: FloristDesignConfiguration,
): Promise<number> {
  const result = await calculateFloristPrice({ configuration });
  return Number(result.subtotalVnd);
}
