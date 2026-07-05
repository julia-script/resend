import "server-only";
import { createRoute, type RouteHandler } from "@hono/zod-openapi";
import { getDomainsByUserId } from "@/db/domains";
import { ApiErrorSchema } from "@/lib/errors";
import { DomainListResponseSchema } from "@/shared/api";
import type { Env } from "../setup";

export const listDomainsRoute = createRoute({
  method: "get",
  path: "/domains",
  tags: ["domains"],

  responses: {
    200: {
      description: "A list of domains",
      content: {
        "application/json": {
          schema: DomainListResponseSchema,
        },
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

export const listDomainsHandler: RouteHandler<
  typeof listDomainsRoute,
  Env
> = async (c) => {
  const session = c.get("session");
  const domains = await getDomainsByUserId(session.user.id);
  return c.json({ data: domains }, 200);
};
