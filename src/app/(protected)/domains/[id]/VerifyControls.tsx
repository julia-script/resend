"use client";
import type { VerifyAction } from "@/domain/verification";
import { isInGrace, useDomain, useVerifyDomain } from "@/hooks/domains";
import { strings } from "@/lib/strings";
import type { PartialDomain } from "@/shared/domain";

// Mirrors the server's verifyAction (not importable client-side: env/db).
const verifyActionKey = (domain: PartialDomain): VerifyAction => {
  if (domain.status === "not_started") return "start";
  if (domain.status === "failed") {
    if (domain.statusReason === "superseded") return "rotate";
    return "restart";
  }
  return "check";
};

export const VerifyControls = ({
  id,
  initialData,
}: {
  id: string;
  initialData: PartialDomain;
}) => {
  const { data } = useDomain(id, initialData);
  const domain = data?.data ?? initialData;
  const verify = useVerifyDomain(id);

  // Verified and stable: nothing to do here.
  if (domain.status === "verified" && !isInGrace(domain)) return null;

  return (
    <div className="mt-5 border-t border-border pt-4">
      <button
        type="button"
        onClick={() => verify.mutate()}
        disabled={verify.isPending}
        className="rounded-md bg-mint px-3 py-1.5 text-sm font-medium text-mint-foreground shadow-soft transition hover:opacity-80 active:scale-95 disabled:opacity-50"
      >
        {verify.isPending
          ? strings.verifyButtonPending
          : strings.verifyButton[verifyActionKey(domain)]}
      </button>
      {verify.isError && (
        <p className="mt-2 text-xs text-peach-foreground">
          {strings.verifyError}
        </p>
      )}
    </div>
  );
};
