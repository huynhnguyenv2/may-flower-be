import type { FastifyReply, FastifyRequest } from "fastify";
import type { StaffRole } from "@prisma/client";
import { AppError, errorPayload } from "../lib/errors.js";
import { assertRoles, getUserFromAccessToken } from "../services/auth.js";

function bearerToken(req: FastifyRequest): string | null {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return null;
  return h.slice(7).trim();
}

export async function requireStaffAuth(req: FastifyRequest, reply: FastifyReply) {
  const token = bearerToken(req);
  if (!token) {
    return reply.status(401).send(errorPayload("UNAUTHORIZED", "Cần đăng nhập"));
  }
  try {
    req.staffUser = await getUserFromAccessToken(token);
  } catch (e) {
    const msg = e instanceof AppError ? e.message : "Unauthorized";
    return reply.status(401).send(errorPayload("UNAUTHORIZED", msg));
  }
}

export function requireRoles(...roles: StaffRole[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.staffUser) {
      return reply.status(401).send(errorPayload("UNAUTHORIZED", "Cần đăng nhập"));
    }
    try {
      assertRoles(req.staffUser.roles, roles);
    } catch (e) {
      const err = e as AppError;
      return reply.status(err.statusCode).send(errorPayload(err.code, err.message));
    }
  };
}
