import { defineConfig } from "drizzle-kit";

process.loadEnvFile(); // .env — the CLI runs outside Next's env loading

// Runs outside Next (drizzle-kit CLI), so it can't import server-only modules
// like @/lib/env — read the raw variable instead.
export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    // biome-ignore lint/style/noNonNullAssertion: fails loudly if unset
    url: process.env.DATABASE_URL!,
  },
});
