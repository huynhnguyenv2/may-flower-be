import "dotenv/config";
import { buildApp } from "./app.js";

/** Render/Railway set `PORT`; local dev uses `API_PORT` (default 3101). */
const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3101);

const app = await buildApp();

try {
  await app.listen({ port, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
