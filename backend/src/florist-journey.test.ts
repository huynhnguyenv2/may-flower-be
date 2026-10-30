import { beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { prisma } from "./lib/prisma.js";

describe("AI Florist journey", () => {
  beforeAll(async () => {
    const count = await prisma.flower.count();
    if (count === 0) {
      throw new Error("Run pnpm db:seed before florist journey tests");
    }
  });

  it("session → message → concepts → select → submit", async () => {
    const app = await buildApp();

    const create = await app.inject({
      method: "POST",
      url: "/v1/florist/sessions",
      payload: { locale: "vi" },
    });
    expect(create.statusCode).toBe(201);
    const sessionId = create.json().data.id as string;

    const msg = await app.inject({
      method: "POST",
      url: `/v1/florist/sessions/${sessionId}/messages`,
      payload: {
        content:
          "Tôi muốn bó sinh nhật cho vợ, hồng và trắng, ngân sách 1500000 VND",
      },
    });
    expect(msg.statusCode).toBe(200);
    expect(["openai", "rules"]).toContain(msg.json().data.source);

    let conceptsRes = await app.inject({
      method: "GET",
      url: `/v1/florist/sessions/${sessionId}/concepts`,
    });
    expect(conceptsRes.statusCode).toBe(200);
    let concepts = conceptsRes.json().data as { id: string }[];
    if (concepts.length === 0) {
      await app.inject({
        method: "POST",
        url: `/v1/florist/sessions/${sessionId}/messages`,
        payload: { content: "gợi ý thiết kế giúp mình" },
      });
      conceptsRes = await app.inject({
        method: "GET",
        url: `/v1/florist/sessions/${sessionId}/concepts`,
      });
      concepts = conceptsRes.json().data as { id: string }[];
    }
    expect(concepts.length).toBeGreaterThan(0);

    const select = await app.inject({
      method: "POST",
      url: `/v1/florist/sessions/${sessionId}/concepts/${concepts[0]!.id}/select`,
    });
    expect(select.statusCode).toBe(200);

    const summary = await app.inject({
      method: "GET",
      url: `/v1/florist/sessions/${sessionId}/summary`,
    });
    expect(summary.statusCode).toBe(200);
    expect(summary.json().data.priceBreakdown).toBeTruthy();

    const zones = await app.inject({ method: "GET", url: "/v1/delivery/zones" });
    const zoneSlug = zones.json().data[0].slug as string;
    const date = new Date().toISOString().slice(0, 10);
    const slots = await app.inject({
      method: "GET",
      url: `/v1/delivery/slots?zone=${zoneSlug}&date=${date}`,
    });
    const slotId = slots.json().data[0].id as string;

    const submitBody = {
      confirm: true as const,
      customer: { name: "Test User", phone: "0901234567", email: "test@example.com" },
      recipient: {
        name: "Recipient",
        phone: "0907654321",
        addressLine1: "123 Street",
        district: "Hai Chau",
        city: "Da Nang",
      },
      deliveryZoneSlug: zoneSlug,
      deliverySlotId: slotId,
      messageCard: "Chúc mừng sinh nhật",
    };

    const submit = await app.inject({
      method: "POST",
      url: `/v1/florist/sessions/${sessionId}/submit`,
      headers: { "idempotency-key": `florist-test-${sessionId}` },
      payload: submitBody,
    });
    expect(submit.statusCode).toBe(201);
    expect(submit.json().data.status).toBe("pending_review");

    const replay = await app.inject({
      method: "POST",
      url: `/v1/florist/sessions/${sessionId}/submit`,
      headers: { "idempotency-key": `florist-test-${sessionId}` },
      payload: submitBody,
    });
    expect(replay.statusCode).toBe(201);
    expect(replay.json().data.requestNumber).toBe(submit.json().data.requestNumber);

    await app.close();
  });
});
