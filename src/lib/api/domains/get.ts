import "server-only";
import { createRoute, type RouteHandler, z } from "@hono/zod-openapi";
import { ApiErrorSchema } from "@/lib/errors";
import { DomainResponseSchema } from "@/shared/api";
import type { Env } from "../setup";
import { domainNotFound, getOwnedDomain } from "./shared";

export const getDomainRoute = createRoute({
  method: "get",
  path: "/domains/{id}",
  tags: ["domains"],
  request: {
    params: z.object({ id: z.uuid() }),
  },
  responses: {
    200: {
      description: "A single domain",
      content: {
        "application/json": { schema: DomainResponseSchema },
      },
    },
    404: {
      description: "Domain not found",
      content: {
        "application/json": { schema: ApiErrorSchema },
      },
    },
    500: {
      description: "Internal server error",
      content: {
        "application/json": { schema: ApiErrorSchema },
      },
    },
  },
});

export const getDomainHandler: RouteHandler<
  typeof getDomainRoute,
  Env
> = async (c) => {
  const session = c.get("session");
  const { id } = c.req.valid("param");
  const domain = await getOwnedDomain(session, id);
  if (!domain) return domainNotFound(c);
  return c.json({ data: domain }, 200);
};
