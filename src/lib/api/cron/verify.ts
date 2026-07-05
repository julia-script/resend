import "server-only";
import { createRoute, type RouteHandler } from "@hono/zod-openapi";
import { getDomainsDueForCheck } from "@/db/domains";
import { dispatchNotifications } from "@/domain/notifications";
import { verifyDomain } from "@/domain/verification";
import { env } from "@/lib/env";
import { ApiErrorSchema } from "@/lib/errors";
import { CronSweepResponseSchema } from "@/shared/api";
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
          schema: CronSweepResponseSchema,
        },
      },
    },
    401: {
      description: "Missing or invalid cron secret",
      content: {
        "application/json": { schema: ApiErrorSchema },
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
  // allSettled: one domain's failure must not abort the sweep or drop
  // the other domains' notifications.
  const results = await Promise.allSettled(
    domains.map((domain) => verifyDomain(domain, now)),
  );
  const fulfilled = results.filter(
    (
      r,
    ): r is PromiseFulfilledResult<Awaited<ReturnType<typeof verifyDomain>>> =>
      r.status === "fulfilled",
  );
  for (const r of results) {
    if (r.status === "rejected")
      console.error("cron: domain check failed", r.reason);
  }

  try {
    // One batched send for the whole sweep (Resend rate-limits individual sends).
    await dispatchNotifications(
      fulfilled.flatMap((r) => r.value.notifications),
    );
  } catch (error) {
    // State is already persisted; losing emails must not fail the tick.
    console.error("cron: notification dispatch failed", error);
  }

  return c.json(
    {
      ok: true,
      checked: fulfilled.length,
      failed: results.length - fulfilled.length,
    },
    200,
  );
};
