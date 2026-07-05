import "server-only";
import { createRoute, type RouteHandler, z } from "@hono/zod-openapi";
import { getDomainsByName, insertDomain } from "@/db/domains";
import { CreateDomainInputSchema, DomainResponseSchema } from "@/shared/api";
import * as Dkim from "@/domain/dkim";
import { ApiError, ApiErrorSchema } from "@/lib/errors";
import type { Env } from "../setup";

export const createDomainRoute = createRoute({
  method: "post",
  path: "/domains",
  tags: ["domains"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: CreateDomainInputSchema,
        },
      },
    },
  },

  responses: {
    200: {
      description: "The created (or already owned) domain",
      content: {
        "application/json": {
          schema: DomainResponseSchema,
        },
      },
    },
    409: {
      description:
        "The name is verified by another account; retry with enforce: true to claim it",
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

export const createDomainHandler: RouteHandler<
  typeof createDomainRoute,
  Env
> = async (c) => {
  const session = c.get("session");
  const input = c.req.valid("json");
  const normalizedName = Dkim.normalizeDomainName(input.name);

  const existing = await getDomainsByName(normalizedName);
  const mine = existing.find((d) => d.userId === session.user.id);
  if (mine) {
    return c.json({ data: mine }, 200);
  }

  // Someone else's verified copy: warn first; enforce means the user
  // confirmed the takeover (whoever verifies wins — see supersedeOthers).
  const verifiedByOther = existing.some((d) => d.status === "verified");
  if (verifiedByOther && !input.enforce) {
    return c.json(
      {
        code: "domains/name_taken",
        message: "This domain is already verified by another account.",
      },
      409,
    );
  }

  const dkimKeys = await Dkim.generateDkimKeys();
  const domain = await insertDomain({
    name: normalizedName,
    userId: session.user.id,
    selector: dkimKeys.selector,
    publicKey: dkimKeys.publicKey,
    privateKey: dkimKeys.privateKeyPem,
  });

  return c.json({ data: domain }, 200);
};
