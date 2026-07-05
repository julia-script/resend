// Local stand-in for the Vercel cron: hits /api/cron/verify once a minute.
// Run alongside `pnpm dev`: `pnpm cron:dev`
// Overrides: CRON_DEV_INTERVAL_MS (default 60000), CRON_DEV_URL (default localhost:3000)
const base = process.env.CRON_DEV_URL ?? "http://localhost:3000";
const intervalMs = Number(process.env.CRON_DEV_INTERVAL_MS) || 60_000;
const secret = process.env.CRON_SECRET;
if (!secret) {
  console.error("CRON_SECRET is not set (loaded from .env via --env-file)");
  process.exit(1);
}

const tick = async () => {
  const at = new Date().toISOString();
  try {
    const res = await fetch(`${base}/api/cron/verify`, {
      headers: { authorization: `Bearer ${secret}` },
    });
    console.log(at, res.status, await res.text());
  } catch (error) {
    console.log(at, "tick failed:", error.message);
  }
};

await tick();
setInterval(tick, intervalMs);
