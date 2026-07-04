import type { PartialDomain } from "@/db/validationschemas";

const statusStyles: Record<
  PartialDomain["status"],
  { label: string; className: string }
> = {
  not_started: { label: "Not started", className: "bg-border text-muted" },
  pending: { label: "Pending", className: "bg-accent text-accent-foreground" },
  verified: { label: "Verified", className: "bg-mint text-mint-foreground" },
  failed: { label: "Failed", className: "bg-peach text-peach-foreground" },
  temporary_failure: {
    label: "Temporary failure",
    className: "bg-peach text-peach-foreground",
  },
};

export const StatusBadge = ({
  status,
}: {
  status: PartialDomain["status"];
}) => {
  const { label, className } = statusStyles[status];
  return (
    <span
      className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
};
