import type { FastifyInstance } from "fastify";
import { OrderStatus, StaffRole } from "@prisma/client";
import { z } from "zod";
import { errorPayload } from "../../lib/errors.js";
import { requireRoles, requireStaffAuth } from "../../middleware/admin-auth.js";
import * as adminCatalog from "../../services/admin-catalog.js";
import * as adminOrders from "../../services/admin-orders.js";
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
      "/orders",
      { preHandler: requireRoles(StaffRole.owner, StaffRole.manager, StaffRole.florist, StaffRole.delivery) },
      async (req) => {
        const status = (req.query as { status?: OrderStatus }).status;
        return { data: await adminOrders.listAdminOrders({ status }) };
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
  });
}
