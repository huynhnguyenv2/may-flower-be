import { beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { calculateFloristPrice } from "./services/florist/pricing.js";

const prisma = new PrismaClient();

describe("florist pricing", () => {
  let flowerId: string;
  let materialId: string;
  let addonId: string;

  beforeAll(async () => {
    const count = await prisma.flower.count();
    if (count === 0) {
      throw new Error("Run pnpm db:seed before florist pricing tests");
    }
    const flower = await prisma.flower.findFirst({ where: { unitPriceVnd: { gt: 0 } } });
    const material = await prisma.material.findFirst({ where: { unitPriceVnd: { gt: 0 } } });
    const addon = await prisma.addon.findFirst();
    if (!flower || !material || !addon) throw new Error("Missing florist seed data");
    flowerId = flower.id;
    materialId = material.id;
    addonId = addon.id;
  });

  it("computes stem, labor, and addon totals", async () => {
    const breakdown = await calculateFloristPrice({
      configuration: {
        sizeTier: "classic",
        stems: [{ flowerId, quantity: 10 }],
        materials: [{ materialId, quantity: 1 }],
      },
      addons: [{ addonId, quantity: 1 }],
    });

    expect(Number(breakdown.subtotalVnd)).toBeGreaterThan(0);
    expect(Number(breakdown.totalVnd)).toBeGreaterThanOrEqual(Number(breakdown.subtotalVnd));
    expect(breakdown.lines.length).toBeGreaterThanOrEqual(3);
  });
});
