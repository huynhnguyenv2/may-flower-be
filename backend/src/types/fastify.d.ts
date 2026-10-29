import type { User } from "@prisma/client";

declare module "fastify" {
  interface FastifyRequest {
    staffUser?: User;
  }
}
