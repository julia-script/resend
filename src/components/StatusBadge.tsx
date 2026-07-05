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
}: {
  status: PartialDomain["status"];
}) => (
  <span
    className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${statusClassNames[status]}`}
  >
    {strings.status[status]}
  </span>
);
