import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { Redacted } from "effect";
import { env } from "@/lib/env";
export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: Redacted.value(env.databaseUrl),
  },
});
