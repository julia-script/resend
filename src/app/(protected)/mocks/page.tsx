import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/lib/auth/handlers";
import { env } from "@/lib/env";
import { MocksClient } from "./MocksClient";

const fmtMs = (ms: number) => {
  if (ms % 86_400_000 === 0) return `${ms / 86_400_000}d`;
  if (ms % 3_600_000 === 0) return `${ms / 3_600_000}h`;
  if (ms % 60_000 === 0) return `${ms / 60_000}m`;
  return `${ms / 1000}s`;
};

// Prod cron is fixed at every minute (vercel.json); dev honors the override.
const cronIntervalMs = Number(process.env.CRON_DEV_INTERVAL_MS) || 60_000;

const timings: [string, string][] = [
  ["Cron sweep", `every ${fmtMs(cronIntervalMs)}`],
  ["Pending recheck", fmtMs(env.pendingRecheckMs)],
  ["Verified recheck", fmtMs(env.successRecheckMs)],
  ["Verification window", fmtMs(env.verificationWindowMs)],
  ["Grace period", fmtMs(env.gracePeriodMs)],
  ["Grace warning after", fmtMs(env.gracePeriodWarningMs)],
];

export default function MocksPage() {
  if (!env.enableMock) notFound();
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">DNS mocks</h1>
      <p className="mt-2 text-sm text-muted">
        Domains with <code className="font-mono text-xs">mock</code> as a label
        resolve DKIM against the canned answer below instead of real DNS.
      </p>
      <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-1 rounded-xl border border-border bg-surface px-4 py-3 text-xs shadow-soft">
        {timings.map(([label, value]) => (
          <div key={label} className="flex items-baseline gap-1.5">
            <dt className="text-muted">{label}</dt>
            <dd className="font-mono">{value}</dd>
          </div>
        ))}
      </dl>
      <Suspense fallback={<p className="mt-8 text-sm text-muted">Loading…</p>}>
        <AuthGate />
      </Suspense>
    </main>
  );
}

async function AuthGate() {
  const session = await auth();
  if (!session) redirect("/signin");
  return <MocksClient />;
}
