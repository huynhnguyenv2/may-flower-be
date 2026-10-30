import type { FastifyInstance } from "fastify";
import { CustomOrderRequestStatus, OrderStatus, StaffRole } from "@prisma/client";
import { z } from "zod";
import { errorPayload } from "../../lib/errors.js";
import { requireRoles, requireStaffAuth } from "../../middleware/admin-auth.js";
import * as adminCatalog from "../../services/admin-catalog.js";
import * as adminOrders from "../../services/admin-orders.js";
import * as adminSupport from "../../services/admin-support.js";
import * as adminAssistant from "../../services/admin-assistant.js";
import * as adminCustomRequests from "../../services/admin-custom-order-requests.js";
import * as adminDashboard from "../../services/admin-dashboard.js";
import * as adminCustomers from "../../services/admin-customers.js";
import * as adminFlowers from "../../services/admin-flowers.js";
import * as adminAddons from "../../services/admin-addons.js";
import * as inventory from "../../services/inventory/stock.js";
import * as auth from "../../services/auth.js";
import { AppError } from "../../lib/errors.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

const statusSchema = z.object({
  status: z.nativeEnum(OrderStatus),
});

const customRequestStatusSchema = z.object({
  status: z.nativeEnum(CustomOrderRequestStatus),
});

const stockAdjustSchema = z.object({
  delta: z.number().int().min(-9999).max(9999).refine((n) => n !== 0),
  reason: z.string().max(200).optional(),
});

const assistantChatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(24),
});

export async function registerAdminRoutes(app: FastifyInstance) {
  app.post("/auth/login", async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send(errorPayload("VALIDATION_ERROR", "Dữ liệu không hợp lệ"));
    }
    try {
      const data = await auth.login(parsed.data.email, parsed.data.password, req.ip);
      return { data };
    } catch (e) {
      if (e instanceof AppError) {
        return reply.status(e.statusCode).send(errorPayload(e.code, e.message));
      }
      throw e;
    }
  });

  app.post("/auth/refresh", async (req, reply) => {
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send(errorPayload("VALIDATION_ERROR", "Dữ liệu không hợp lệ"));
    }
    try {
      const data = await auth.refresh(parsed.data.refreshToken);
      return { data };
    } catch (e) {
      if (e instanceof AppError) {
        return reply.status(e.statusCode).send(errorPayload(e.code, e.message));
      }
      throw e;
    }
  });

  app.register(async (secured) => {
    secured.addHook("preHandler", requireStaffAuth);

    secured.get("/me", async (req) => ({
      data: {
        id: req.staffUser!.id,
        email: req.staffUser!.email,
        name: req.staffUser!.name,
        roles: req.staffUser!.roles,
      },
    }));

    secured.get(
      "/dashboard",
      { preHandler: requireRoles(StaffRole.owner, StaffRole.manager, StaffRole.florist) },
      async () => ({ data: await adminDashboard.getAdminDashboard() }),
    );

    secured.get(
      "/orders",
      { preHandler: requireRoles(StaffRole.owner, StaffRole.manager, StaffRole.florist, StaffRole.delivery) },
      async (req) => {
        const query = req.query as {
          status?: OrderStatus;
          q?: string;
          limit?: string;
          offset?: string;
        };
        const limit = query.limit ? parseInt(query.limit, 10) : undefined;
        const offset = query.offset ? parseInt(query.offset, 10) : undefined;
        return {
          data: await adminOrders.listAdminOrders({
            status: query.status,
            q: query.q,
            limit,
            offset,
          }),
        };
      },
    );

    secured.get<{ Params: { id: string } }>(
      "/orders/:id",
      { preHandler: requireRoles(StaffRole.owner, StaffRole.manager, StaffRole.florist, StaffRole.delivery) },
      async (req, reply) => {
        try {
          return { data: await adminOrders.getAdminOrder(req.params.id) };
        } catch (e) {
          if (e instanceof AppError) {
            return reply.status(e.statusCode).send(errorPayload(e.code, e.message));
          }
          throw e;
        }
      },
    );

    secured.patch<{ Params: { id: string } }>(
      "/orders/:id/status",
      { preHandler: requireRoles(StaffRole.owner, StaffRole.manager, StaffRole.florist) },
      async (req, reply) => {
        const parsed = statusSchema.safeParse(req.body);
        if (!parsed.success) {
          return reply.status(400).send(errorPayload("VALIDATION_ERROR", "Status không hợp lệ"));
        }
        try {
          const data = await adminOrders.updateOrderStatus(
            req.params.id,
            parsed.data.status,
            req.staffUser!.id,
          );
          return { data };
        } catch (e) {
          if (e instanceof AppError) {
            return reply.status(e.statusCode).send(errorPayload(e.code, e.message));
          }
          throw e;
        }
      },
    );

    secured.get(
      "/products",
      { preHandler: requireRoles(StaffRole.owner, StaffRole.manager) },
      async () => ({ data: await adminCatalog.listAdminProducts() }),
    );

    secured.get(
      "/inventory/low-stock",
      { preHandler: requireRoles(StaffRole.owner, StaffRole.manager, StaffRole.florist) },
      async () => ({ data: await inventory.listLowStockVariants() }),
    );

    secured.patch<{ Params: { id: string } }>(
      "/variants/:id/stock",
      { preHandler: requireRoles(StaffRole.owner, StaffRole.manager) },
      async (req, reply) => {
        const parsed = stockAdjustSchema.safeParse(req.body);
        if (!parsed.success) {
          return reply.status(400).send(errorPayload("VALIDATION_ERROR", "Dữ liệu không hợp lệ"));
        }
        try {
          const data = await inventory.adjustVariantStock({
            variantId: req.params.id,
            delta: parsed.data.delta,
            reason: parsed.data.reason,
            actorId: req.staffUser!.id,
          });
          return { data };
        } catch (e) {
          if (e instanceof AppError) {
            return reply.status(e.statusCode).send(errorPayload(e.code, e.message));
          }
          throw e;
        }
      },
    );

    secured.get(
      "/custom-order-requests",
      { preHandler: requireRoles(StaffRole.owner, StaffRole.manager, StaffRole.florist) },
      async (req) => {
        const status = (req.query as { status?: CustomOrderRequestStatus }).status;
        return { data: await adminCustomRequests.listCustomOrderRequests(status) };
      },
    );

    secured.get<{ Params: { id: string } }>(
      "/custom-order-requests/:id",
      { preHandler: requireRoles(StaffRole.owner, StaffRole.manager, StaffRole.florist) },
      async (req, reply) => {
        try {
          return { data: await adminCustomRequests.getCustomOrderRequest(req.params.id) };
        } catch (e) {
          if (e instanceof AppError) {
            return reply.status(e.statusCode).send(errorPayload(e.code, e.message));
          }
          throw e;
        }
      },
    );

    secured.patch<{ Params: { id: string } }>(
      "/custom-order-requests/:id/status",
      { preHandler: requireRoles(StaffRole.owner, StaffRole.manager) },
      async (req, reply) => {
        const parsed = customRequestStatusSchema.safeParse(req.body);
        if (!parsed.success) {
          return reply.status(400).send(errorPayload("VALIDATION_ERROR", "Status không hợp lệ"));
        }
        try {
          const data = await adminCustomRequests.updateCustomOrderRequestStatus(
            req.params.id,
            parsed.data.status,
            req.staffUser!.id,
          );
          return { data };
        } catch (e) {
          if (e instanceof AppError) {
            return reply.status(e.statusCode).send(errorPayload(e.code, e.message));
          }
          throw e;
        }
      },
    );

    secured.post<{ Params: { id: string } }>(
      "/custom-order-requests/:id/convert",
      { preHandler: requireRoles(StaffRole.owner, StaffRole.manager) },
      async (req, reply) => {
        try {
          const data = await adminCustomRequests.convertCustomOrderRequestToOrder(
            req.params.id,
            req.staffUser!.id,
          );
          return { data };
        } catch (e) {
          if (e instanceof AppError) {
            return reply.status(e.statusCode).send(errorPayload(e.code, e.message));
          }
          throw e;
        }
      },
    );

    secured.get(
      "/customers",
      { preHandler: requireRoles(StaffRole.owner, StaffRole.manager, StaffRole.florist) },
      async (req) => {
        const query = req.query as { q?: string; limit?: string };
        return {
          data: await adminCustomers.listAdminCustomers({
            q: query.q,
            limit: query.limit ? parseInt(query.limit, 10) : undefined,
          }),
        };
      },
    );

    secured.get<{ Params: { id: string } }>(
      "/customers/:id",
      { preHandler: requireRoles(StaffRole.owner, StaffRole.manager, StaffRole.florist) },
      async (req, reply) => {
        try {
          return { data: await adminCustomers.getAdminCustomer(req.params.id) };
        } catch (e) {
          if (e instanceof AppError) {
            return reply.status(e.statusCode).send(errorPayload(e.code, e.message));
          }
          throw e;
        }
      },
    );

    secured.get(
      "/flowers",
      { preHandler: requireRoles(StaffRole.owner, StaffRole.manager, StaffRole.florist) },
      async () => ({ data: await adminFlowers.listAdminFlowers() }),
    );

    secured.get<{ Params: { id: string } }>(
      "/flowers/:id",
      { preHandler: requireRoles(StaffRole.owner, StaffRole.manager, StaffRole.florist) },
      async (req, reply) => {
        try {
          return { data: await adminFlowers.getAdminFlower(req.params.id) };
        } catch (e) {
          if (e instanceof AppError) {
            return reply.status(e.statusCode).send(errorPayload(e.code, e.message));
          }
          throw e;
        }
      },
    );

    secured.post(
      "/flowers",
      { preHandler: requireRoles(StaffRole.owner, StaffRole.manager) },
      async (req, reply) => {
        try {
          const data = await adminFlowers.createAdminFlower(req.body, req.staffUser!.id);
          return { data };
        } catch (e) {
          if (e instanceof AppError) {
            return reply.status(e.statusCode).send(errorPayload(e.code, e.message));
          }
          throw e;
        }
      },
    );

    secured.patch<{ Params: { id: string } }>(
      "/flowers/:id",
      { preHandler: requireRoles(StaffRole.owner, StaffRole.manager) },
      async (req, reply) => {
        try {
          const data = await adminFlowers.updateAdminFlower(
            req.params.id,
            req.body,
            req.staffUser!.id,
          );
          return { data };
        } catch (e) {
          if (e instanceof AppError) {
            return reply.status(e.statusCode).send(errorPayload(e.code, e.message));
          }
          throw e;
        }
      },
    );

    secured.get(
      "/addons",
      { preHandler: requireRoles(StaffRole.owner, StaffRole.manager, StaffRole.florist) },
      async () => ({ data: await adminAddons.listAdminAddons() }),
    );

    secured.get<{ Params: { id: string } }>(
      "/addons/:id",
      { preHandler: requireRoles(StaffRole.owner, StaffRole.manager, StaffRole.florist) },
      async (req, reply) => {
        try {
          return { data: await adminAddons.getAdminAddon(req.params.id) };
        } catch (e) {
          if (e instanceof AppError) {
            return reply.status(e.statusCode).send(errorPayload(e.code, e.message));
          }
          throw e;
        }
      },
    );

    secured.post(
      "/addons",
      { preHandler: requireRoles(StaffRole.owner, StaffRole.manager) },
      async (req, reply) => {
        try {
          const data = await adminAddons.createAdminAddon(req.body, req.staffUser!.id);
          return { data };
        } catch (e) {
          if (e instanceof AppError) {
            return reply.status(e.statusCode).send(errorPayload(e.code, e.message));
          }
          throw e;
        }
      },
    );

    secured.patch<{ Params: { id: string } }>(
      "/addons/:id",
      { preHandler: requireRoles(StaffRole.owner, StaffRole.manager) },
      async (req, reply) => {
        try {
          const data = await adminAddons.updateAdminAddon(
            req.params.id,
            req.body,
            req.staffUser!.id,
          );
          return { data };
        } catch (e) {
          if (e instanceof AppError) {
            return reply.status(e.statusCode).send(errorPayload(e.code, e.message));
          }
          throw e;
        }
      },
    );

    secured.get(
      "/support/sessions",
      { preHandler: requireRoles(StaffRole.owner, StaffRole.manager) },
      async () => ({ data: await adminSupport.listSupportSessionsForAdmin() }),
    );

    secured.get<{ Params: { id: string } }>(
      "/support/sessions/:id",
      { preHandler: requireRoles(StaffRole.owner, StaffRole.manager) },
      async (req, reply) => {
        try {
          return { data: await adminSupport.getSupportSessionForAdmin(req.params.id) };
        } catch (e) {
          if (e instanceof AppError) {
            return reply.status(e.statusCode).send(errorPayload(e.code, e.message));
          }
          throw e;
        }
      },
    );

    secured.get(
      "/assistant/stats",
      { preHandler: requireRoles(StaffRole.owner, StaffRole.manager, StaffRole.florist) },
      async () => ({ data: await adminAssistant.staffAssistantStats() }),
    );

    secured.post(
      "/assistant/chat",
      { preHandler: requireRoles(StaffRole.owner, StaffRole.manager, StaffRole.florist) },
      async (req, reply) => {
        const parsed = assistantChatSchema.safeParse(req.body);
        if (!parsed.success) {
          return reply.status(400).send(errorPayload("VALIDATION_ERROR", "Dữ liệu không hợp lệ"));
        }
        const data = await adminAssistant.staffAssistantReply(
          { name: req.staffUser!.name, roles: req.staffUser!.roles },
          parsed.data.messages,
        );
        return { data };
      },
    );
  });
}
