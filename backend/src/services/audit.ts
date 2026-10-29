import { prisma } from "../lib/prisma.js";

export async function recordAudit(input: {
  actorId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  payload?: unknown;
  ip?: string;
}) {
  await prisma.auditEvent.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      payload: input.payload as object | undefined,
      ip: input.ip,
    },
  });
}
