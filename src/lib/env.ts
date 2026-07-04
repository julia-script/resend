import { Config, ConfigProvider, Effect } from "effect";

export const AppConfig = Config.all({
  authSecret: Config.redacted("AUTH_SECRET"),
  authResendKey: Config.redacted("AUTH_RESEND_KEY"),
  databaseUrl: Config.redacted("DATABASE_URL"),
  encryptionKey: Config.redacted("ENCRYPTION_KEY"),
  cronSecret: Config.redacted("CRON_SECRET"),
  nodeEnv: Config.string("NODE_ENV").pipe(Config.withDefault("development")),
  dkimSelector: Config.string("DKIM_SELECTOR").pipe(
    Config.withDefault("resendtest"),
  ),
});
export const configProvider = ConfigProvider.fromUnknown({
  AUTH_SECRET: process.env.AUTH_SECRET,
  AUTH_RESEND_KEY: process.env.AUTH_RESEND_KEY,
  DATABASE_URL: process.env.DATABASE_URL,
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
  CRON_SECRET: process.env.CRON_SECRET,
  NODE_ENV: process.env.NODE_ENV,
  DKIM_SELECTOR: process.env.DKIM_SELECTOR,
});

export const envLayer = ConfigProvider.layer(configProvider);
export const env = Effect.runSync(AppConfig.parse(configProvider));
