import Fastify from "fastify";
import cors from "@fastify/cors";
import { registerAdminRoutes } from "./routes/admin/index.js";
import { registerV1Routes } from "./routes/v1.js";

export async function buildApp() {
  const app = Fastify({ logger: false });

  // Browsers/clients may POST application/json with no body (Concierge session create).
  app.addContentTypeParser("application/json", { parseAs: "string" }, (req, body, done) => {
    const raw = typeof body === "string" ? body : "";
    if (raw.length === 0) {
      done(null, {});
      return;
    }
    try {
      done(null, JSON.parse(raw) as unknown);
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  await app.register(cors, { origin: true });
  await app.register(
    async (instance) => {
      await registerV1Routes(instance);
    },
    { prefix: "/v1" },
  );
  await app.register(
    async (instance) => {
      await registerAdminRoutes(instance);
    },
    { prefix: "/v1/admin" },
  );
  app.get("/health", async () => ({ ok: true }));
  return app;
}
