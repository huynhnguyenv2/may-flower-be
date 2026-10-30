import "dotenv/config";
import { describe, expect, it } from "vitest";
import { buildApp } from "./app.js";

process.env.JWT_SECRET ??= "test-secret-min-16-chars";

async function staffToken(app: Awaited<ReturnType<typeof buildApp>>) {
  const login = await app.inject({
    method: "POST",
    url: "/v1/admin/auth/login",
    payload: {
      email: process.env.ADMIN_SEED_EMAIL ?? "owner@mayflower.vn",
      password: process.env.ADMIN_SEED_PASSWORD ?? "MayFlower2026!",
    },
  });
  expect(login.statusCode).toBe(200);
  return (login.json() as { data: { accessToken: string } }).data.accessToken;
}

describe("admin dashboard", () => {
  it("returns dashboard payload for authenticated staff", async () => {
    const app = await buildApp();
    const token = await staffToken(app);
    const res = await app.inject({
      method: "GET",
      url: "/v1/admin/dashboard",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const { data } = res.json() as {
      data: { kpis: { ordersToday: number }; ordersByStatus: Record<string, number> };
    };
    expect(typeof data.kpis.ordersToday).toBe("number");
    expect(data.ordersByStatus).toBeTruthy();
    await app.close();
  });
});
