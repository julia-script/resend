import { z } from "zod";


const EnvSchema = z.object({
  authSecret: z.string(),
  authResendKey: z.string(),
  databaseUrl: z.string(),
  encryptionKey: z.string(),
  cronSecret: z.string(),
  nodeEnv: z.enum(["development", "production"]).default("development"),
  dkimSelector: z.string().default("resendtest"),
});
export const env = EnvSchema.parse({
  authSecret: process.env.AUTH_SECRET,
  authResendKey: process.env.AUTH_RESEND_KEY,
  databaseUrl: process.env.DATABASE_URL,
  encryptionKey: process.env.ENCRYPTION_KEY,
  cronSecret: process.env.CRON_SECRET,
  nodeEnv: process.env.NODE_ENV,
  dkimSelector: process.env.DKIM_SELECTOR,
});
