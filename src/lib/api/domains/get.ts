import { createRoute, type RouteHandler, z } from "@hono/zod-openapi";
import { getDomainById } from "@/db/domains";
import { PartialDomainSchema } from "@/db/validationschemas";
import { ApiError } from "../helpers";
import type { Env } from "../setup";

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
        "application/json": { schema: z.object({ data: PartialDomainSchema }) },
      },
    },
    404: {
      description: "Domain not found",
      content: {
        "application/json": { schema: ApiError.schema },
      },
    },
    500: {
      description: "Internal server error",
      content: {
        "application/json": { schema: ApiError.schema },
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
  const result = await ApiError.mapToValue({
    fn: () => getDomainById(id),
    map: () => ({
      code: "db/get_domain_by_id_failed",
      message: "Failed to load domain",
    }),
  });
  if (result.type === "failure") {
    return c.json(result.error.toJson(), 500);
  }
  const domain = result.value;
  // Not-owned reads 404 too, so domain ids can't be probed.
  if (!domain || domain.userId !== session.user.id) {
    return c.json(
      { code: "domains/not_found", message: "Domain not found" },
      404,
    );
  }
  return c.json({ data: domain }, 200);
};
