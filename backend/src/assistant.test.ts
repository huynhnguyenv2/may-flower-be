import "dotenv/config";
import { describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { runStaffCopilot } from "./services/ai-tools/staff-copilot.js";

process.env.JWT_SECRET ??= "test-secret-min-16-chars";

describe("staff assistant tools", () => {
  it("rules path answers low-stock question without OpenAI", async () => {
    const prev = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const res = await runStaffCopilot(
      { staff: { name: "Test", roles: ["manager"] } },
      [{ role: "user", content: "SKU nào sắp hết tồn?" }],
    );

    expect(res.message.length).toBeGreaterThan(10);
    expect(res.source).toBe("rules");
    expect(res.toolsUsed).toContain("list_low_stock");

    if (prev) process.env.OPENAI_API_KEY = prev;
  });

  it("admin assistant chat endpoint returns toolsUsed", async () => {
    const app = await buildApp();
    const login = await app.inject({
      method: "POST",
      url: "/v1/admin/auth/login",
      payload: {
        email: process.env.ADMIN_SEED_EMAIL ?? "owner@mayflower.vn",
        password: process.env.ADMIN_SEED_PASSWORD ?? "MayFlower2026!",
      },
    });
    const { data } = login.json() as { data: { accessToken: string } };

    const chat = await app.inject({
      method: "POST",
      url: "/v1/admin/assistant/chat",
      headers: { authorization: `Bearer ${data.accessToken}` },
      payload: {
        messages: [{ role: "user", content: "Hôm nay có bao nhiêu đơn?" }],
      },
    });
    expect(chat.statusCode).toBe(200);
    const body = chat.json() as { data: { message: string; toolsUsed?: string[] } };
    expect(body.data.message.length).toBeGreaterThan(5);
    expect(Array.isArray(body.data.toolsUsed)).toBe(true);

    await app.close();
  });
});
