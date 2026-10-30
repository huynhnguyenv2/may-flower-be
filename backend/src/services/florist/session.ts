import { randomBytes } from "node:crypto";
import type { FloristSessionStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";

const DEFAULT_TTL_DAYS = Number(process.env.FLORIST_SESSION_TTL_DAYS ?? "7");

export function floristSessionExpiresAt(): Date {
  return new Date(Date.now() + DEFAULT_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export async function createFloristSession(locale: "vi" | "en" = "vi") {
  const recoveryToken = randomBytes(24).toString("hex");
  return prisma.floristSession.create({
    data: {
      locale,
      expiresAt: floristSessionExpiresAt(),
      recoveryToken,
      preferencesJson: {},
      selectedAddonsJson: [],
    },
  });
}

export async function loadFloristSession(sessionId: string) {
  const session = await prisma.floristSession.findUnique({
    where: { id: sessionId },
    include: {
      messages: { orderBy: { createdAt: "asc" }, take: 50 },
      concepts: {
        orderBy: { createdAt: "desc" },
        include: { images: { take: 1, orderBy: { createdAt: "desc" } } },
      },
    },
  });
  if (!session || session.expiresAt < new Date()) return null;
  if (session.status === "submitted") return session;
  return session;
}

export async function updateFloristSessionStatus(sessionId: string, status: FloristSessionStatus) {
  return prisma.floristSession.update({
    where: { id: sessionId },
    data: { status },
  });
}
