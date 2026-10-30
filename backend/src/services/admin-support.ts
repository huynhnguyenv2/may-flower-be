import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";

export async function listSupportSessionsForAdmin(limit = 50) {
  const sessions = await prisma.supportSession.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      _count: { select: { messages: true } },
    },
  });

  return sessions.map((s) => ({
    id: s.id,
    locale: s.locale,
    createdAt: s.createdAt.toISOString(),
    expiresAt: s.expiresAt.toISOString(),
    messageCount: s._count.messages,
    lastMessage: s.messages[0]
      ? {
          role: s.messages[0].role,
          content: s.messages[0].content.slice(0, 200),
          createdAt: s.messages[0].createdAt.toISOString(),
        }
      : null,
  }));
}

export async function getSupportSessionForAdmin(sessionId: string) {
  const session = await prisma.supportSession.findUnique({
    where: { id: sessionId },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!session) {
    throw new AppError("NOT_FOUND", "Không tìm thấy phiên chat", 404);
  }

  return {
    id: session.id,
    locale: session.locale,
    createdAt: session.createdAt.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
    messages: session.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}
