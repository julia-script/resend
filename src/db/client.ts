import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import { env } from "@/lib/env";

// HMR re-evaluates this module; reuse the pool or dev leaks a connection per reload.
const globalForDb = globalThis as unknown as {
  db?: ReturnType<typeof drizzle>;
};
export const db = globalForDb.db ?? drizzle(env.databaseUrl);
if (env.nodeEnv !== "production") globalForDb.db = db;
