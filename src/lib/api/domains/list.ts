import {
  createRoute,
  RouteConfig,
  type RouteHandler,
  z,
} from "@hono/zod-openapi";
import { getDomainsByUserId,  } from "@/db/domains";
import { ApiError } from "../helpers";
import type { Env } from "../setup";
import { PartialDomainSchema } from "@/db/validationschemas";

export const listDomainsRoute = createRoute({
  method: "get",
  path: "/domains",
  tags: ["domains"],

  responses: {
    200: {
      description: "A list of domains",
      content: {
        "application/json": {
          schema: z.object({ data: z.array(PartialDomainSchema) }),
        },
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

export const listDomainsHandler: RouteHandler<
  typeof listDomainsRoute,
  Env
> = async (c) => {
  try {
    const session = c.get("session");
    const result = await ApiError.mapToValue({
      fn: () => getDomainsByUserId(session.user.id),
      map: () => ({
        code: "data/domain_list_not_found",
        message: "Domain list not found",
      }),
    });
    if (result.type === "failure") {
      return c.json(result.error.toJson(), 500);
    }
    return c.json({ data: result.value }, 200);
  } catch (error) {
    if (error instanceof ApiError) {
      return c.json(error.toJson(), 500);
    }
    throw error;
  }
};
