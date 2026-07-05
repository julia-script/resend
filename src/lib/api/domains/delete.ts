import { createRoute, type RouteHandler, z } from "@hono/zod-openapi";
import { deleteDomain, getDomainById } from "@/db/domains";
import { ApiError } from "../helpers";
import type { Env } from "../setup";

export const deleteDomainRoute = createRoute({
  method: "delete",
  path: "/domains/{id}",
  tags: ["domains"],
  request: {
    params: z.object({ id: z.uuid() }),
  },
  responses: {
    200: {
      description: "The domain was permanently deleted",
      content: {
        "application/json": {
          schema: z.object({ data: z.object({ id: z.string() }) }),
        },
      },
    },
    404: {
      description: "Domain not found",
      content: {
        "application/json": { schema: ApiError.schema },
      },
    },
  },
});

export const deleteDomainHandler: RouteHandler<
  typeof deleteDomainRoute,
  Env
> = async (c) => {
  const session = c.get("session");
  const { id } = c.req.valid("param");
  const domain = await getDomainById(id);
  // Not-owned reads 404 too, so domain ids can't be probed.
  if (!domain || domain.userId !== session.user.id) {
    return c.json(
      { code: "domains/not_found", message: "Domain not found" },
      404,
    );
  }

  await deleteDomain(domain.id);
  return c.json({ data: { id: domain.id } }, 200);
};
