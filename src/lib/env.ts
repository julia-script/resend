import "server-only";
import { z } from "zod";

const MINUTE_IN_MS = 1000 * 60;
const DAY_IN_MS = 1000 * 60 * 60 * 24;
const ms = z.coerce.number().int().positive();

const EnvSchema = z.object({
  authSecret: z.string(),
  authResendKey: z.string(),
  databaseUrl: z.string(),
  encryptionKey: z.string(),
  cronSecret: z.string(),
  nodeEnv: z.enum(["development", "test", "production"]).default("development"),

  // Verification timings (ms). Defaults match the shipped behavior.
  pendingRecheckMs: ms.default(MINUTE_IN_MS),
  successRecheckMs: ms.default(DAY_IN_MS),
  gracePeriodMs: ms.default(DAY_IN_MS),
  gracePeriodWarningMs: ms.default(60 * MINUTE_IN_MS),
  verificationWindowMs: ms.default(2 * DAY_IN_MS),
  notificationsFrom: z.string().default("Inkwell <notifications@jlort.com>"),

  // Test-only DNS mocking (see src/domain/dns.ts). Hard-blocked in
  // production below — the env var alone can't enable it there.
  enableMock: z
    .string()
    .optional()
    .transform(
      (v) =>
        (v === "true" || v === "1") && process.env.NODE_ENV !== "production",
    ),
});
// Under vitest (NODE_ENV=test) the schema gets deterministic inputs: secret
// placeholders so a fresh clone with no .env runs green, and timing
// overrides stripped so demo-short values in .env never change what tests
// assert. A real DATABASE_URL is kept — the DB integration suite gates on
// its presence in process.env.
const source: NodeJS.ProcessEnv =
  process.env.NODE_ENV === "test"
    ? {
        ...process.env,
        AUTH_SECRET: "test-auth-secret",
        AUTH_RESEND_KEY: "re_test_placeholder",
        DATABASE_URL:
          process.env.DATABASE_URL ?? "postgres://placeholder:5432/placeholder",
        // 32 bytes of hex: the DB integration tests encrypt for real.
        ENCRYPTION_KEY: "0f".repeat(32),
        CRON_SECRET: "test-cron-secret",
        PENDING_RECHECK_MS: undefined,
        SUCCESS_RECHECK_MS: undefined,
        GRACE_PERIOD_MS: undefined,
        GRACE_PERIOD_WARNING_MS: undefined,
        VERIFICATION_WINDOW_MS: undefined,
      }
    : process.env;

export const env = EnvSchema.parse({
  authSecret: source.AUTH_SECRET,
  authResendKey: source.AUTH_RESEND_KEY,
  databaseUrl: source.DATABASE_URL,
  encryptionKey: source.ENCRYPTION_KEY,
  cronSecret: source.CRON_SECRET,
  nodeEnv: source.NODE_ENV,
  pendingRecheckMs: source.PENDING_RECHECK_MS,
  successRecheckMs: source.SUCCESS_RECHECK_MS,
  gracePeriodMs: source.GRACE_PERIOD_MS,
  gracePeriodWarningMs: source.GRACE_PERIOD_WARNING_MS,
  verificationWindowMs: source.VERIFICATION_WINDOW_MS,
  notificationsFrom: source.NOTIFICATIONS_FROM,
  enableMock: source.ENABLE_MOCK,
});
