import "server-only";
import { createRoute, type RouteHandler, z } from "@hono/zod-openapi";
import { DeleteDomainResponseSchema } from "@/shared/api";
import { deleteDomain } from "@/db/domains";
import { domainNotFound, getOwnedDomain } from "./shared";
import { ApiErrorSchema } from "@/lib/errors";
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
          schema: DeleteDomainResponseSchema,
        },
      },
    },
    404: {
      description: "Domain not found",
      content: {
        "application/json": { schema: ApiErrorSchema },
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
  const domain = await getOwnedDomain(session, id);
  if (!domain) return domainNotFound(c);

  await deleteDomain(domain.id);
  return c.json({ data: { id: domain.id } }, 200);
};
