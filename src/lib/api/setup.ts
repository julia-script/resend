import "server-only";
import { OpenAPIHono } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { createMiddleware } from "hono/factory";
import type { Session } from "next-auth";
import { auth } from "../auth/handlers";
import { ApiError } from "@/lib/errors";
import { listDomainsHandler, listDomainsRoute } from "./domains/list";
import { createDomainHandler, createDomainRoute } from "./domains/create";
import { getDomainHandler, getDomainRoute } from "./domains/get";
import { verifyDomainHandler, verifyDomainRoute } from "./domains/verify";
import { deleteDomainHandler, deleteDomainRoute } from "./domains/delete";
import { cronVerifyHandler, cronVerifyRoute } from "./cron/verify";

export type Env = {
  Variables: {
    session: Session;
  };
};

/** Session gate: every /domains route is scoped to the signed-in user. */
const requireSession = createMiddleware<Env>(async (c, next) => {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return c.json(
      {
        name: "Unauthorized",
        code: "unauthorized",
        message: "Sign in to manage domains.",
      },
      401,
    );
  }
  c.set("session", session);
  await next();
});

export const app = new OpenAPIHono<Env>({
  // Uniform validation-error shape (same envelope as domain errors).
  defaultHook: (result, c) => {
    if (!result.success) {
      return c.json(
        {
          error: {
            name: "RequestValidationError",
            code: "invalid_request",
            message: result.error.issues
              .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
              .join("; "),
          },
        },
        400,
      );
    }
  },
}).basePath("/api");

// Domain and db failures throw ApiError; one hook maps them all to JSON.
app.onError((err, c) => {
  if (err instanceof ApiError) {
    console.error("api error", err.code, err.cause ?? "");
    return c.json(err.toJson(), 500);
  }
  throw err;
});

app.doc("/openapi.json", {
  openapi: "3.0.0",
  info: {
    version: "1.0.0",
    title: "Resend API",
  },
});

app.get(
  "/reference",
  Scalar({
    url: "/api/openapi.json",
  }),
);

app.use("/domains", requireSession);
app.use("/domains/*", requireSession);

app.openapi(listDomainsRoute, listDomainsHandler);
app.openapi(createDomainRoute, createDomainHandler);
app.openapi(getDomainRoute, getDomainHandler);
app.openapi(verifyDomainRoute, verifyDomainHandler);
app.openapi(deleteDomainRoute, deleteDomainHandler);
app.openapi(cronVerifyRoute, cronVerifyHandler);