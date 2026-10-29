import type { StaffRole } from "@prisma/client";
import { AppError } from "../lib/errors.js";
import {
  hashRefreshToken,
  newRefreshTokenRaw,
  signAccessToken,
  verifyAccessToken,
} from "../lib/jwt.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { prisma } from "../lib/prisma.js";
import { recordAudit } from "./audit.js";

const REFRESH_TTL_DAYS = 30;

export async function login(email: string, password: string, ip?: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !user.active) {
    throw new AppError("INVALID_CREDENTIALS", "Email hoặc mật khẩu không đúng", 401);
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    throw new AppError("INVALID_CREDENTIALS", "Email hoặc mật khẩu không đúng", 401);
  }

  const accessToken = await signAccessToken({
    sub: user.id,
    email: user.email,
    roles: user.roles,
  });

  const refreshRaw = newRefreshTokenRaw();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TTL_DAYS);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashRefreshToken(refreshRaw),
      expiresAt,
    },
  });

  await recordAudit({
    actorId: user.id,
    action: "auth.login",
    entityType: "User",
    entityId: user.id,
    ip,
  });

  return {
    accessToken,
    refreshToken: refreshRaw,
    user: { id: user.id, email: user.email, name: user.name, roles: user.roles },
  };
}

export async function refresh(refreshToken: string) {
  const tokenHash = hashRefreshToken(refreshToken);
  const row = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
  if (!row || row.expiresAt < new Date() || !row.user.active) {
    throw new AppError("INVALID_REFRESH", "Phiên đăng nhập hết hạn", 401);
  }

  const accessToken = await signAccessToken({
    sub: row.user.id,
    email: row.user.email,
    roles: row.user.roles,
  });

  return {
    accessToken,
    user: {
      id: row.user.id,
      email: row.user.email,
      name: row.user.name,
      roles: row.user.roles,
    },
  };
}

export async function getUserFromAccessToken(token: string) {
  const payload = await verifyAccessToken(token);
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.active) {
    throw new AppError("UNAUTHORIZED", "Unauthorized", 401);
  }
  return user;
}

export function assertRoles(userRoles: StaffRole[], allowed: StaffRole[]) {
  if (userRoles.some((r) => allowed.includes(r) || r === "owner")) {
    return;
  }
  throw new AppError("FORBIDDEN", "Không có quyền", 403);
}

export async function ensureSeedOwner() {
  const email = (process.env.ADMIN_SEED_EMAIL ?? "owner@mayflower.vn").toLowerCase();
  const password = process.env.ADMIN_SEED_PASSWORD ?? "MayFlower2026!";
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;
  return prisma.user.create({
    data: {
      email,
      name: "Studio Owner",
      passwordHash: await hashPassword(password),
      roles: ["owner", "manager"],
    },
  });
}
