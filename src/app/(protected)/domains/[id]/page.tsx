"use client";

import Link from "next/link";
import { use, useState } from "react";
import type {
  CheckLogEntry,
  PartialDomain,
} from "@/db/validationschemas";
import { isInGrace, useDomain, useVerifyDomain } from "@/hooks/domains";
import { StatusBadge } from "@/components/StatusBadge";

const CopyButton = ({ value }: { value: string }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="shrink-0 rounded-md bg-accent px-2 py-1 text-xs font-medium text-accent-foreground transition-opacity hover:opacity-80"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
};

const Field = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0">
    <p className="text-xs font-medium text-muted">{label}</p>
    <div className="mt-1 flex items-start gap-2">
      <code className="min-w-0 break-all rounded-md bg-background px-2 py-1 font-mono text-xs">
        {value}
      </code>
      <CopyButton value={value} />
    </div>
  </div>
);

// Plain-language versions of statusReason, with what to do next.
const REASON_EXPLANATIONS: Record<
  NonNullable<PartialDomain["statusReason"]>,
  string
> = {
  expired:
    "We kept looking for your DNS record for the whole verification window, but it never appeared. Double-check the record below, then start verification again.",
  superseded:
    "Another account verified ownership of this domain, so your verification was revoked. Re-verifying will generate a brand-new DNS record for you to add — the old one won't work anymore.",
  grace_period_expired:
    "Your DNS record disappeared and didn't come back within the grace period, so the domain was unverified. Restore or re-add the record below and verify again.",
  canceled: "Verification was canceled. Start again whenever you're ready.",
};

const verifyButtonLabel = (domain: PartialDomain) => {
  if (domain.status === "in_progress" || isInGrace(domain)) return "Check again now";
  if (domain.status === "failed" && domain.statusReason === "superseded")
    return "Get a new record & re-verify";
  if (domain.status === "failed") return "Try again";
  return "I’ve added the record — verify";
};

const timeAgo = (ts: number) => {
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const minutes = Math.round((ts - Date.now()) / 60_000);
  if (minutes > -1) return "just now";
  if (minutes > -60) return rtf.format(minutes, "minute");
  if (minutes > -60 * 24) return rtf.format(Math.round(minutes / 60), "hour");
  return rtf.format(Math.round(minutes / (60 * 24)), "day");
};

const logEntryLabel = (entry: CheckLogEntry): string => {
  if (entry.status === "ok") return "Record found — all good";
  if (entry.status === "expired") return "Verification window expired";
  if (entry.status === "revoked") {
    if (entry.reason === "superseded") return "Revoked — verified by another account";
    if (entry.reason === "grace_period_expired") return "Revoked — grace period ran out";
    return "Canceled";
  }
  // failed
  if (entry.reason === "record_not_found") return "Record not found yet";
  if (entry.reason === "key_mismatch") return "Found a record, but with a different key";
  if (entry.reason === "domain_not_found") return "Domain doesn’t resolve";
  return "Check hit an unexpected error";
};

const CheckHistory = ({ log }: { log: CheckLogEntry[] }) => {
  const recent = [...log].reverse().slice(0, 8);
  if (recent.length === 0) return null;
  return (
    <div className="mt-8 rounded-xl border border-border bg-surface p-5 shadow-soft">
      <h2 className="text-sm font-semibold">Recent checks</h2>
      <ul className="mt-3 space-y-2">
        {recent.map((entry) => (
          <li
            key={entry.checkedAt}
            className="flex items-center justify-between gap-4 text-sm"
          >
            <span className={entry.status === "ok" ? "text-mint-foreground" : "text-muted"}>
              {entry.status === "ok" ? "✓" : "•"} {logEntryLabel(entry)}
            </span>
            <span className="shrink-0 text-xs text-muted">
              {timeAgo(entry.checkedAt)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

const DnsGuide = () => (
  <details className="mt-4 rounded-md bg-background px-3 py-2">
    <summary className="cursor-pointer text-sm text-muted hover:text-foreground">
      First time editing DNS? No shame — everyone googles this.
    </summary>
    <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted">
      <li>
        Log in to wherever your domain lives — usually the company you pay
        about $12/year (GoDaddy, Namecheap, Cloudflare, and friends).
      </li>
      <li>
        Find the DNS settings. It hides under names like “DNS management”,
        “Zone editor”, or “Advanced DNS”. Companies love renaming this page.
      </li>
      <li>
        Add a new record and set its type to <strong>TXT</strong>.
      </li>
      <li>
        In the <strong>Name</strong> (or “Host”) field, paste the Name shown
        above. Heads-up: if your provider already displays “.yourdomain.com”
        after the box, only paste the part before it.
      </li>
      <li>
        In the <strong>Value</strong> (or “Content”) field, paste the entire
        Value from above. Yes, all of it — that wall of gibberish is a public
        key, not a malfunction.
      </li>
      <li>Leave TTL on the default and save.</li>
      <li>
        Wait. DNS updates travel at the speed of bureaucracy — usually a few
        minutes, occasionally an hour. We re-check every minute, so you can
        just leave this page open.
      </li>
    </ol>
  </details>
);

export default function DomainPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data, error, isPending } = useDomain(id);
  const domain = data?.data;

  const verify = useVerifyDomain(id);

  const showVerifyButton = domain && (domain.status !== "verified" || isInGrace(domain));

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <Link href="/" className="text-sm text-muted hover:text-foreground">
        ← Domains
      </Link>

      {isPending && <p className="mt-8 text-sm text-muted">Loading domain…</p>}
      {error && (
        <p className="mt-8 text-sm text-peach-foreground">
          Domain not found, or you don’t have access to it.
        </p>
      )}

      {domain && (
        <>
          <div className="mt-6 flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {domain.name}
            </h1>
            <StatusBadge status={domain.status} />
          </div>
          <p className="mt-1 text-sm text-muted">
            Added {domain.createdAt.toLocaleDateString()}
            {domain.verifiedAt &&
              ` · Verified ${domain.verifiedAt.toLocaleDateString()}`}
          </p>

          {domain.status === "failed" && domain.statusReason && (
            <div className="mt-4 rounded-md bg-peach px-4 py-3 text-sm text-peach-foreground">
              {REASON_EXPLANATIONS[domain.statusReason]}
            </div>
          )}
          {isInGrace(domain) && (
            <div className="mt-4 rounded-md bg-peach px-4 py-3 text-sm text-peach-foreground">
              Your DNS record has stopped resolving. The domain stays verified
              during a grace period — restore the record below before it runs
              out to keep sending.
            </div>
          )}
          {domain.status === "in_progress" && (
            <div className="mt-4 rounded-md bg-accent px-4 py-3 text-sm text-accent-foreground">
              We’re checking your DNS about once a minute. This page updates
              itself — no refreshing needed.
            </div>
          )}

          <div className="mt-8 rounded-xl border border-border bg-surface p-5 shadow-soft">
            <h2 className="text-sm font-semibold">DNS record</h2>
            <p className="mt-1 text-sm text-muted">
              Add this TXT record to your DNS provider to verify the domain.
            </p>
            <div className="mt-4 grid gap-4">
              <Field
                label="Name"
                value={`${domain.selector}._domainkey.${domain.name}`}
              />
              <Field
                label="Value"
                value={`v=DKIM1; k=rsa; p=${domain.publicKey}`}
              />
            </div>
            <DnsGuide />
            {showVerifyButton && (
              <div className="mt-5 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => verify.mutate()}
                  disabled={verify.isPending}
                  className="rounded-md bg-mint px-3 py-1.5 text-sm font-medium text-mint-foreground transition-opacity hover:opacity-80 disabled:opacity-50"
                >
                  {verify.isPending ? "Checking…" : verifyButtonLabel(domain)}
                </button>
                {verify.isError && (
                  <p className="mt-2 text-xs text-peach-foreground">
                    Couldn’t start verification. Try again.
                  </p>
                )}
              </div>
            )}
          </div>

          <CheckHistory log={domain.checkLog ?? []} />
        </>
      )}
    </main>
  );
}
