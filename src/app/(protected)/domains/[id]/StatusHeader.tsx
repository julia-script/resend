"use client";
import { StatusBadge } from "@/components/StatusBadge";
import { isInGrace, useDomain } from "@/hooks/domains";
import { strings } from "@/lib/strings";
import type { CheckLogEntry, PartialDomain } from "@/shared/domain";

/** Relative time in either direction: "5 minutes ago" / "in 5 minutes". */
export const timeAgo = (ts: number) => {
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const minutes = Math.round((ts - Date.now()) / 60_000);
  if (Math.abs(minutes) < 1) return "just now";
  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
  if (Math.abs(minutes) < 60 * 24)
    return rtf.format(Math.round(minutes / 60), "hour");
  return rtf.format(Math.round(minutes / (60 * 24)), "day");
};

const logEntryLabel = (entry: CheckLogEntry): string => {
  if (entry.status === "failed") return strings.checkLog.failed[entry.reason];
  if (entry.status === "revoked") return strings.checkLog.revoked[entry.reason];
  return strings.checkLog[entry.status];
};

/**
 * Everything on the page that changes while checks run: badge, meta line,
 * banners, last-check freshness. Shares one polled query (by key) with the
 * other islands, seeded from the server-fetched domain.
 */
export const StatusHeader = ({
  id,
  initialData,
}: {
  id: string;
  initialData: PartialDomain;
}) => {
  const { data } = useDomain(id, initialData);
  const domain = data?.data ?? initialData;
  const checking = domain.status === "in_progress" || isInGrace(domain);
  const lastCheck = domain.checkLog?.at(-1);

  return (
    <>
      <div className="mt-6 flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{domain.name}</h1>
        <StatusBadge status={domain.status} pulse={checking} />
      </div>
      <p className="mt-1 text-sm text-muted">
        Added {domain.createdAt.toLocaleDateString()}
        {domain.verifiedAt &&
          ` · Verified ${domain.verifiedAt.toLocaleDateString()}`}
        {lastCheck &&
          ` · ${strings.domainPage.lastChecked(
            logEntryLabel(lastCheck),
            timeAgo(lastCheck.checkedAt),
          )}`}
      </p>

      {domain.status === "failed" && domain.statusReason && (
        <div className="mt-4 rounded-md bg-peach px-4 py-3 text-sm text-peach-foreground">
          {strings.statusReason[domain.statusReason]}
        </div>
      )}
      {isInGrace(domain) && (
        <div className="mt-4 rounded-md bg-peach px-4 py-3 text-sm text-peach-foreground">
          {strings.banner.gracePeriod}
        </div>
      )}
      {domain.status === "in_progress" && (
        <div className="mt-4 rounded-md bg-accent px-4 py-3 text-sm text-accent-foreground">
          {strings.banner.inProgress}
        </div>
      )}
    </>
  );
};
