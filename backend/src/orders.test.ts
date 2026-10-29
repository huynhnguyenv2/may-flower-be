import "dotenv/config";
import { DEFAULT_DELIVERY_ZONE_SLUG } from "@may-flower/shared";
import { beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { prisma } from "./lib/prisma.js";

describe("public API", () => {
  beforeAll(async () => {
    const count = await prisma.product.count();
    if (count === 0) {
      throw new Error("Database empty — run pnpm db:seed before tests");
    }
  });

  it("lists collections", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/v1/collections" });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { data: unknown[] };
    expect(body.data.length).toBeGreaterThan(0);
    await app.close();
  });

  it("creates order with idempotency key", async () => {
    const app = await buildApp();
    const variant = await prisma.productVariant.findFirst({
      where: { availableQuantity: { gt: 0 } },
    });
    expect(variant).toBeTruthy();

    const zone = await prisma.deliveryZone.findFirst({
      where: { slug: DEFAULT_DELIVERY_ZONE_SLUG, active: true },
    });
    expect(zone).toBeTruthy();

    const slotSafe = await prisma.deliverySlot.findFirst({
      where: { zoneId: zone!.id, capacity: { gt: 0 } },
    });
    expect(slotSafe).toBeTruthy();

    const payload = {
      customer: { name: "Test User", phone: "0901234567", email: "test@example.com" },
      recipient: {
        name: "Recipient",
        phone: "0907654321",
        addressLine1: "123 Bạch Đằng, gần Cầu Rồng",
        district: "Quận Hải Châu",
        city: "Đà Nẵng",
      },
      items: [{ variantId: variant!.id, quantity: 1 }],
      deliveryZoneSlug: DEFAULT_DELIVERY_ZONE_SLUG,
      deliverySlotId: slotSafe!.id,
    };

    const key = `test-${Date.now()}`;
    const res1 = await app.inject({
      method: "POST",
      url: "/v1/orders",
      headers: { "idempotency-key": key },
      payload,
    });
    expect(res1.statusCode).toBe(201);
    const order1 = (res1.json() as { data: { orderNumber: string } }).data;

    const res2 = await app.inject({
      method: "POST",
      url: "/v1/orders",
      headers: { "idempotency-key": key },
      payload,
    });
    expect(res2.statusCode).toBe(201);
    const order2 = (res2.json() as { data: { orderNumber: string } }).data;
    expect(order2.orderNumber).toBe(order1.orderNumber);

    await app.close();
  });
});
