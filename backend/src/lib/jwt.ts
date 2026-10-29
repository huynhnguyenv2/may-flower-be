import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import type { StaffRole } from "@prisma/client";

export type AccessTokenPayload = {
  sub: string;
  email: string;
  roles: StaffRole[];
};

function secretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("JWT_SECRET must be set (min 16 chars)");
  }
  return new TextEncoder().encode(secret);
}

export async function signAccessToken(payload: AccessTokenPayload): Promise<string> {
  const ttl = process.env.JWT_ACCESS_TTL ?? "8h";
  return new SignJWT({ email: payload.email, roles: payload.roles })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(ttl)
    .sign(secretKey());
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, secretKey());
  const sub = payload.sub;
  if (!sub) throw new Error("Invalid token");
  return {
    sub,
    email: String(payload.email ?? ""),
    roles: (payload.roles as StaffRole[]) ?? [],
  };
}

export function hashRefreshToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function newRefreshTokenRaw(): string {
  return randomBytes(32).toString("base64url");
}
