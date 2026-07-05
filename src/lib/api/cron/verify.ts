import { createRoute, type RouteHandler, z } from "@hono/zod-openapi";
import { getDomainsDueForCheck } from "@/db/domains";
import { dispatchNotifications } from "@/domain/notifications";
import { verifyDomain } from "@/domain/verification";
import { env } from "@/lib/env";
import { ApiError } from "../helpers";
import type { Env } from "../setup";

export const cronVerifyRoute = createRoute({
  method: "get",
  path: "/cron/verify",
  tags: ["cron"],
  responses: {
    200: {
      description: "Cron tick accepted",
      content: {
        "application/json": {
          schema: z.object({ ok: z.boolean(), checked: z.number() }),
        },
      },
    },
    401: {
      description: "Missing or invalid cron secret",
      content: {
        "application/json": { schema: ApiError.schema },
      },
    },
  },
});

export const cronVerifyHandler: RouteHandler<
  typeof cronVerifyRoute,
  Env
> = async (c) => {
  // Vercel cron convention: Authorization: Bearer <CRON_SECRET>.
  if (c.req.header("authorization") !== `Bearer ${env.cronSecret}`) {
    return c.json(
      { code: "cron/unauthorized", message: "Invalid cron secret" },
      401,
    );
  }

  const domains = await getDomainsDueForCheck();
  const now = new Date();
  const results = await Promise.all(
    domains.map((domain) => verifyDomain(domain, now)),
  );
  // One batched send for the whole sweep (Resend rate-limits individual sends).
  await dispatchNotifications(results.flatMap((r) => r.notifications));
  return c.json({ ok: true, checked: domains.length }, 200);
};
