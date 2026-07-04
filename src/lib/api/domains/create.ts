import { createRoute, type RouteHandler, z } from "@hono/zod-openapi";
import {
  getDomainByName,
} from "@/db/domains";
import { PartialDomainSchema } from "@/db/validationschemas";
import { ApiError } from "../helpers";
import type { Env } from "../setup";
import * as Dkim from "@/domain/dkim";
import { insertDomain } from "@/db/domains";

export const createDomainRoute = createRoute({
  method: "post",
  path: "/domains",
  tags: ["domains"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            name: z.string().min(1),
            enforce: z.boolean().optional(),
          }),
        },
      },
    },
  },

  responses: {
    200: {
      description: "A list of domains",
      content: {
        "application/json": {
          schema: z.object({ data: PartialDomainSchema }),
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

export const createDomainHandler: RouteHandler<
  typeof createDomainRoute,
  Env
> = async (c) => {
  const session = c.get("session");
  const input = c.req.valid("json");
  const normalizedName = Dkim.normalizeDomainName(input.name);

  const existingDomain = await getDomainByName(normalizedName);

  if (existingDomain) {
    if (existingDomain.userId === session.user.id) {
      return c.json({ data: existingDomain }, 200);
    }
    if (input.enforce) {
      return c.json(
        {
          code: "domains/domain_already_exists",
          message: "Domain already exists",
        },
        500,
      );
    }
  }

  const dkimKeys = await Dkim.generateDkimKeys();
  const domain = await insertDomain({
    name: normalizedName,
    userId: session.user.id,
    selector: dkimKeys.selector,
    publicKey: dkimKeys.publicKey,
    privateKey: dkimKeys.privateKeyPem,
  });

  // return c.json({ data: domain }, 200);

  return c.json({ data: domain }, 200);
};
