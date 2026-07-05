"use client";
import { useRouter } from "next/navigation";
import { useDeleteDomain } from "@/hooks/domains";
import { strings } from "@/lib/strings";

export const RemoveButton = ({ id, name }: { id: string; name: string }) => {
  const router = useRouter();
  const remove = useDeleteDomain(id);
  const onRemove = () => {
    if (!window.confirm(strings.domainPage.removeConfirm(name))) return;
    remove.mutate(undefined, { onSuccess: () => router.push("/") });
  };

  return (
    <button
      type="button"
      onClick={onRemove}
      disabled={remove.isPending}
      className="text-sm text-peach-foreground hover:underline disabled:opacity-50"
    >
      {remove.isPending
        ? strings.domainPage.removing
        : strings.domainPage.remove}
    </button>
  );
};
