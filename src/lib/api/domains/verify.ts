import { createRoute, type RouteHandler, z } from "@hono/zod-openapi";
import { getDomainById, updateDomain } from "@/db/domains";
import { PartialDomainSchema } from "@/db/validationschemas";
import { ApiError } from "../helpers";
import type { Env } from "../setup";

export const verifyDomainRoute = createRoute({
  method: "post",
  path: "/domains/{id}/verify",
  tags: ["domains"],
  request: {
    params: z.object({ id: z.uuid() }),
  },
  responses: {
    200: {
      description: "The domain after triggering verification",
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
  },
});

const DAY_IN_MS = 1000 * 60 * 60 * 24;


export const verifyDomainHandler: RouteHandler<
  typeof verifyDomainRoute,
  Env
> = async (c) => {
  const session = c.get("session");
  const { id } = c.req.valid("param");
  const domain = await getDomainById(id);
  if (!domain || domain.userId !== session.user.id) {
    return c.json(
      { code: "domains/not_found", message: "Domain not found" },
      404,
    );
  }
  if (domain.status === "not_started") {
    await updateDomain(domain.id, {
      status: "in_progress",
      nextCheckAt: new Date(),
      deadlineAt: new Date(Date.now() + DAY_IN_MS * 2),
    });
  }


  return c.json({ data: domain }, 200);
};
