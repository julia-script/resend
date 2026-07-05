import { strings } from "@/lib/strings";
import type { PartialDomain } from "@/shared/domain";

const statusClassNames: Record<PartialDomain["status"], string> = {
  not_started: "bg-border text-muted",
  in_progress: "bg-accent text-accent-foreground",
  verified: "bg-mint text-mint-foreground",
  failed: "bg-peach text-peach-foreground",
};

export const StatusBadge = ({
  status,
  pulse = false,
}: {
  status: PartialDomain["status"];
  /** Continuous "checks are running" indicator — domain state, not fetches. */
  pulse?: boolean;
}) => (
  <span
    className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ${statusClassNames[status]}`}
  >
    {pulse && (
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
    )}
    {strings.status[status]}
  </span>
);
