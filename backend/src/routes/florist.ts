import type { FastifyInstance } from "fastify";
import {
  floristCreateSessionSchema,
  floristSendMessageSchema,
  floristUpdateConfigurationSchema,
  floristUpdateSessionSchema,
  submitCustomOrderRequestSchema,
} from "@may-flower/shared";
import { AppError, errorPayload } from "../lib/errors.js";
import { listSessionConcepts, selectConcept } from "../services/florist/concepts.js";
import { updateDesignConfiguration, updateSessionFields } from "../services/florist/configuration.js";
import { handleFloristMessage } from "../services/florist/orchestrator.js";
import { createFloristSession, loadFloristSession } from "../services/florist/session.js";
import { buildSessionSummary } from "../services/florist/summary.js";
import { submitCustomOrderRequest } from "../services/florist/submit.js";
import { listAvailableAddons } from "../services/florist/addons.js";

export async function registerFloristRoutes(app: FastifyInstance) {
  app.post("/florist/sessions", async (req, reply) => {
    const parsed = floristCreateSessionSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send(errorPayload("VALIDATION_ERROR", "Dữ liệu không hợp lệ"));
    }
    const session = await createFloristSession(parsed.data.locale ?? "vi");
    return reply.status(201).send({
      data: {
        id: session.id,
        recoveryToken: session.recoveryToken,
        expiresAt: session.expiresAt.toISOString(),
        locale: session.locale,
      },
    });
  });

  app.get<{ Params: { id: string } }>("/florist/sessions/:id", async (req, reply) => {
    const session = await loadFloristSession(req.params.id);
    if (!session) {
      return reply.status(404).send(errorPayload("SESSION_EXPIRED", "Phiên thiết kế đã hết hạn"));
    }
    const summary = await buildSessionSummary(session.id);
    return {
      data: {
        session: {
          id: session.id,
          status: session.status,
          locale: session.locale,
          expiresAt: session.expiresAt.toISOString(),
        },
        messages: session.messages.map((m: { role: string; content: string; createdAt: Date }) => ({
          role: m.role,
          content: m.content,
          createdAt: m.createdAt.toISOString(),
        })),
        summary,
      },
    };
  });

  app.post<{ Params: { id: string } }>("/florist/sessions/:id/messages", async (req, reply) => {
    const parsed = floristSendMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send(errorPayload("VALIDATION_ERROR", "Dữ liệu không hợp lệ"));
    }
    const result = await handleFloristMessage(req.params.id, parsed.data.content);
    if (!result) {
      return reply.status(404).send(errorPayload("SESSION_EXPIRED", "Phiên thiết kế đã hết hạn"));
    }
    return { data: result };
  });

  app.get<{ Params: { id: string } }>("/florist/sessions/:id/concepts", async (req, reply) => {
    const session = await loadFloristSession(req.params.id);
    if (!session) {
      return reply.status(404).send(errorPayload("SESSION_EXPIRED", "Phiên thiết kế đã hết hạn"));
    }
    return { data: await listSessionConcepts(req.params.id) };
  });

  app.post<{ Params: { id: string; conceptId: string } }>(
    "/florist/sessions/:id/concepts/:conceptId/select",
    async (req, reply) => {
      const session = await loadFloristSession(req.params.id);
      if (!session) {
        return reply.status(404).send(errorPayload("SESSION_EXPIRED", "Phiên thiết kế đã hết hạn"));
      }
      const concept = await selectConcept(req.params.id, req.params.conceptId);
      if (!concept) {
        return reply.status(404).send(errorPayload("NOT_FOUND", "Không tìm thấy concept"));
      }
      const summary = await buildSessionSummary(req.params.id);
      return { data: { concept, summary } };
    },
  );

  app.put<{ Params: { id: string } }>("/florist/sessions/:id/configuration", async (req, reply) => {
    const parsed = floristUpdateConfigurationSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send(errorPayload("VALIDATION_ERROR", "Cấu hình không hợp lệ"));
    }
    const result = await updateDesignConfiguration(req.params.id, parsed.data);
    if ("error" in result) {
      return reply.status(404).send(errorPayload("NOT_FOUND", "Phiên không tồn tại"));
    }
    return { data: result };
  });

  app.patch<{ Params: { id: string } }>("/florist/sessions/:id", async (req, reply) => {
    const parsed = floristUpdateSessionSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send(errorPayload("VALIDATION_ERROR", "Dữ liệu không hợp lệ"));
    }
    const summary = await updateSessionFields(req.params.id, parsed.data);
    if (!summary) {
      return reply.status(404).send(errorPayload("NOT_FOUND", "Phiên không tồn tại"));
    }
    return { data: summary };
  });

  app.get<{ Params: { id: string } }>("/florist/sessions/:id/addons", async (req, reply) => {
    const session = await loadFloristSession(req.params.id);
    if (!session) {
      return reply.status(404).send(errorPayload("SESSION_EXPIRED", "Phiên thiết kế đã hết hạn"));
    }
    return { data: await listAvailableAddons() };
  });

  app.get<{ Params: { id: string } }>("/florist/sessions/:id/summary", async (req, reply) => {
    const summary = await buildSessionSummary(req.params.id);
    if (!summary) {
      return reply.status(404).send(errorPayload("NOT_FOUND", "Phiên không tồn tại"));
    }
    return { data: summary };
  });

  app.post<{ Params: { id: string } }>("/florist/sessions/:id/submit", async (req, reply) => {
    const parsed = submitCustomOrderRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send(errorPayload("VALIDATION_ERROR", "Dữ liệu không hợp lệ", parsed.error.issues));
    }
    const idempotencyKey = (req.headers["idempotency-key"] as string | undefined)?.trim();
    try {
      const data = await submitCustomOrderRequest(req.params.id, parsed.data, idempotencyKey);
      return reply.status(201).send({ data });
    } catch (e) {
      if (e instanceof AppError) {
        return reply.status(e.statusCode).send(errorPayload(e.code, e.message));
      }
      throw e;
    }
  });
}
