import type { FastifyInstance } from "fastify";
import {
  conciergeAnswersSchema,
  createOrderRequestSchema,
  supportCreateSessionSchema,
  supportSendMessageSchema,
} from "@may-flower/shared";
import { AppError, errorPayload } from "../lib/errors.js";
import * as catalog from "../services/catalog.js";
import * as concierge from "../services/concierge.js";
import * as delivery from "../services/delivery.js";
import * as orders from "../services/orders.js";
import * as support from "../services/support.js";
import { prisma } from "../lib/prisma.js";

export async function registerV1Routes(app: FastifyInstance) {
  app.get("/collections", async () => ({ data: await catalog.listCollections() }));

  app.get<{ Params: { slug: string } }>("/collections/:slug", async (req, reply) => {
    const data = await catalog.getCollectionBySlug(req.params.slug);
    if (!data) return reply.status(404).send(errorPayload("NOT_FOUND", "Không tìm thấy bộ sưu tập"));
    return { data };
  });

  app.get<{
    Querystring: { collection?: string; feeling?: string; minPrice?: string; maxPrice?: string };
  }>("/products", async (req) => ({
    data: await catalog.listProducts(req.query),
  }));

  app.get("/products/featured/list", async () => ({
    data: await catalog.listFeaturedProducts(),
  }));

  app.get<{ Params: { slug: string } }>("/products/:slug", async (req, reply) => {
    const data = await catalog.getProductBySlug(req.params.slug);
    if (!data) return reply.status(404).send(errorPayload("NOT_FOUND", "Không tìm thấy sản phẩm"));
    return { data };
  });

  app.post("/concierge/sessions", async (_req, reply) => {
    const session = await concierge.createSession();
    return reply.status(201).send({ data: { id: session.id, expiresAt: session.expiresAt.toISOString() } });
  });

  app.post<{ Params: { id: string } }>("/concierge/sessions/:id/recommend", async (req, reply) => {
    const parsed = conciergeAnswersSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send(errorPayload("VALIDATION_ERROR", "Dữ liệu không hợp lệ", parsed.error.issues));
    }
    const result = await concierge.recommend(req.params.id, parsed.data);
    if (!result) {
      return reply.status(404).send(errorPayload("SESSION_EXPIRED", "Phiên tư vấn đã hết hạn"));
    }
    return { data: result };
  });

  app.post("/support/sessions", async (req, reply) => {
    const parsed = supportCreateSessionSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send(errorPayload("VALIDATION_ERROR", "Dữ liệu không hợp lệ", parsed.error.issues));
    }
    const session = await support.createSession(parsed.data.locale ?? "vi");
    return reply.status(201).send({
      data: { id: session.id, expiresAt: session.expiresAt.toISOString(), locale: session.locale },
    });
  });

  app.post<{ Params: { id: string } }>("/support/sessions/:id/messages", async (req, reply) => {
    const parsed = supportSendMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send(errorPayload("VALIDATION_ERROR", "Dữ liệu không hợp lệ", parsed.error.issues));
    }
    const result = await support.sendMessage(req.params.id, parsed.data.content);
    if (!result) {
      return reply.status(404).send(errorPayload("SESSION_EXPIRED", "Phiên chat đã hết hạn"));
    }
    return { data: result };
  });

  app.get("/delivery/zones", async () => ({ data: await delivery.listZones() }));

  app.get<{ Querystring: { zone: string; date: string } }>("/delivery/slots", async (req, reply) => {
    const { zone, date } = req.query;
    if (!zone || !date) {
      return reply.status(400).send(errorPayload("VALIDATION_ERROR", "Thiếu zone hoặc date"));
    }
    const data = await delivery.listSlots(zone, date);
    if (!data) return reply.status(404).send(errorPayload("NOT_FOUND", "Khu vực không tồn tại"));
    return { data };
  });

  app.post("/orders", async (req, reply) => {
    const parsed = createOrderRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send(errorPayload("VALIDATION_ERROR", "Dữ liệu đơn hàng không hợp lệ", parsed.error.issues));
    }
    const idempotencyKey = (req.headers["idempotency-key"] as string | undefined)?.trim();
    try {
      const data = await orders.createOrder(parsed.data, idempotencyKey);
      return reply.status(201).send({ data });
    } catch (e) {
      if (e instanceof AppError) {
        return reply.status(e.statusCode).send(errorPayload(e.code, e.message));
      }
      throw e;
    }
  });

  app.get<{ Params: { orderNumber: string } }>("/orders/:orderNumber", async (req, reply) => {
    const data = await orders.getOrderByNumber(req.params.orderNumber);
    if (!data) return reply.status(404).send(errorPayload("NOT_FOUND", "Không tìm thấy đơn hàng"));
    return { data };
  });

  app.post<{ Params: { provider: string } }>("/webhooks/payments/:provider", async (req, reply) => {
    const body = req.body as { eventId?: string; orderNumber?: string };
    const eventId = body.eventId ?? `stub-${Date.now()}`;
    const provider = req.params.provider;

    try {
      await prisma.paymentWebhookEvent.create({
        data: { provider, eventId },
      });
    } catch {
      return reply.send({ data: { duplicate: true } });
    }

    if (body.orderNumber) {
      await prisma.order.updateMany({
        where: { orderNumber: body.orderNumber, status: "pending_payment" },
        data: { status: "confirmed" },
      });
    }

    return reply.send({ data: { received: true } });
  });
}
