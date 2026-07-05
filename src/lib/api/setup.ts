import { OpenAPIHono, type z } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { createMiddleware } from "hono/factory";
import type { Session } from "next-auth";
import { auth } from "../auth/handlers";
import { listDomainsHandler, listDomainsRoute } from "./domains/list";
import { createDomainHandler, createDomainRoute } from "./domains/create";
import { getDomainHandler, getDomainRoute } from "./domains/get";
import { verifyDomainHandler, verifyDomainRoute } from "./domains/verify";
import { cronVerifyHandler, cronVerifyRoute } from "./cron/verify";

export type Env = {
  Variables: {
    session: Session;
  };
};

// const errorContent = (description: string) => ({
//   description,
//   content: { "application/json": { schema: ErrorSchema } },
// });

const _jsonContent = <T extends z.ZodType>(schema: T, description: string) => ({
  description,
  content: { "application/json": { schema } },
});

/** Session gate: every /domains route is scoped to the signed-in user. */
const requireSession = createMiddleware<Env>(async (c, next) => {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return c.json(
      {
        // error: {
        name: "Unauthorized",
        code: "unauthorized",
        message: "Sign in to manage domains.",
        // },
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
app.openapi(cronVerifyRoute, cronVerifyHandler);