"use client";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth/serveractions";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-muted transition-colors hover:bg-peach hover:text-peach-foreground"
      onClick={async () => {
        await signOut();
        router.push("/");
      }}
    >
      Sign out
    </button>
  );
}
