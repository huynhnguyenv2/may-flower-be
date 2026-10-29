import "dotenv/config";
import { describe, expect, it } from "vitest";
import { buildApp } from "./app.js";

process.env.JWT_SECRET ??= "test-secret-min-16-chars";

describe("admin auth", () => {
  it("rejects unauthenticated admin orders", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/v1/admin/orders" });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("logs in seed owner and lists orders", async () => {
    const app = await buildApp();
    const login = await app.inject({
      method: "POST",
      url: "/v1/admin/auth/login",
      payload: {
        email: process.env.ADMIN_SEED_EMAIL ?? "owner@mayflower.vn",
        password: process.env.ADMIN_SEED_PASSWORD ?? "MayFlower2026!",
      },
    });
    expect(login.statusCode).toBe(200);
    const { data } = login.json() as { data: { accessToken: string } };
    expect(data.accessToken).toBeTruthy();

    const orders = await app.inject({
      method: "GET",
      url: "/v1/admin/orders",
      headers: { authorization: `Bearer ${data.accessToken}` },
    });
    expect(orders.statusCode).toBe(200);
    await app.close();
  });
});
