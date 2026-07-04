import type { Session } from "next-auth";
import { SignOutButton } from "./SignOutButton";

export function UserMenu({ user }: { user: Session["user"] }) {
  const name = user?.name ?? user?.email ?? "Account";
  const initial = name.charAt(0).toUpperCase();
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
          {initial}
        </span>
        <span className="text-sm text-muted">{name}</span>
      </div>
      <SignOutButton />
    </div>
  );
}
