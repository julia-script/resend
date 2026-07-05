import { createRoute, type RouteHandler, z } from "@hono/zod-openapi";
import { getDomainById, rotateDomainKeys, updateDomain } from "@/db/domains";
import { PartialDomainSchema } from "@/db/validationschemas";
import * as Dkim from "@/domain/dkim";
import { dispatchNotifications } from "@/domain/notifications";
import {
  isCheckThrottled,
  verifyAction,
  verifyDomain,
} from "@/domain/verification";
import { env } from "@/lib/env";
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

// Manual checks are skipped when anything was logged more recently than this.
const VERIFY_THROTTLE_MS = 30_000;

export const verifyDomainHandler: RouteHandler<
  typeof verifyDomainRoute,
  Env
> = async (c) => {
  const session = c.get("session");
  const { id } = c.req.valid("param");
  let domain = await getDomainById(id);
  if (!domain || domain.userId !== session.user.id) {
    return c.json(
      { code: "domains/not_found", message: "Domain not found" },
      404,
    );
  }

  const now = new Date();
  const action = verifyAction(domain);

  if (action === "rotate") {
    // Superseded: the old record belongs to whoever took the name over.
    const keys = await Dkim.generateDkimKeys();
    domain =
      (await rotateDomainKeys(domain.id, {
        selector: keys.selector,
        publicKey: keys.publicKey,
        privateKey: keys.privateKeyPem,
      })) ?? domain;
  }

  if (action !== "check") {
    domain =
      (await updateDomain(domain.id, {
        status: "in_progress",
        statusReason: null,
        verifiedAt: null,
        nextCheckAt: now,
        deadlineAt: new Date(now.getTime() + env.verificationWindowMs),
      })) ?? domain;
  }

  // Instant feedback, throttled so the button can't hammer DNS. A rotation
  // counts as recent activity: the new record can't be in DNS yet anyway.
  if (!isCheckThrottled(domain, now, VERIFY_THROTTLE_MS)) {
    const result = await verifyDomain(domain, now);
    await dispatchNotifications(result.notifications);
    domain = result.domain;
  }

  return c.json({ data: domain }, 200);
};
