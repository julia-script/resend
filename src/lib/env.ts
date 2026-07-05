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
  notificationsFrom: z.string().default("Resend <notifications@jlort.com>"),
});
export const env = EnvSchema.parse({
  authSecret: process.env.AUTH_SECRET,
  authResendKey: process.env.AUTH_RESEND_KEY,
  databaseUrl: process.env.DATABASE_URL,
  encryptionKey: process.env.ENCRYPTION_KEY,
  cronSecret: process.env.CRON_SECRET,
  nodeEnv: process.env.NODE_ENV,
  pendingRecheckMs: process.env.PENDING_RECHECK_MS,
  successRecheckMs: process.env.SUCCESS_RECHECK_MS,
  gracePeriodMs: process.env.GRACE_PERIOD_MS,
  gracePeriodWarningMs: process.env.GRACE_PERIOD_WARNING_MS,
  verificationWindowMs: process.env.VERIFICATION_WINDOW_MS,
  notificationsFrom: process.env.NOTIFICATIONS_FROM,
});
