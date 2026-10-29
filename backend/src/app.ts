import Fastify from "fastify";
import cors from "@fastify/cors";
import { registerAdminRoutes } from "./routes/admin/index.js";
import { registerV1Routes } from "./routes/v1.js";

export async function buildApp() {
  const app = Fastify({ logger: false });
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
