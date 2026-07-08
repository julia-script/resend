import { afterEach, expect, test, vi } from "vitest";

// The mocks console (and mock DNS answers) must be impossible to switch on
// in production — every consumer gates on env.enableMock, so proving the
// flag stays false proves the page 404s, the actions reject, and checks
// ignore mock records.

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

test("ENABLE_MOCK cannot enable mocks in production", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("ENABLE_MOCK", "true");
  // Outside test mode env.ts reads process.env verbatim; stub the required
  // vars so this also passes on a fresh clone with no .env.
  vi.stubEnv("AUTH_SECRET", "s");
  vi.stubEnv("AUTH_RESEND_KEY", "s");
  vi.stubEnv("DATABASE_URL", "postgres://placeholder:5432/placeholder");
  vi.stubEnv("ENCRYPTION_KEY", "s");
  vi.stubEnv("CRON_SECRET", "s");
  vi.resetModules();
  const { env } = await import("./env");
  expect(env.enableMock).toBe(false);
});

test("ENABLE_MOCK enables mocks outside production", async () => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("ENABLE_MOCK", "true");
  vi.resetModules();
  const { env } = await import("./env");
  expect(env.enableMock).toBe(true);
});
