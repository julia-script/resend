import { auth } from "@/lib/auth/handlers";
import { SignOutButton } from "./SignOutButton";

// Not an auth gate — pages own their own redirects. Signed out: render nothing.
export async function UserMenu() {
  const session = await auth();
  if (!session) {
    return null;
  }
  const name = session.user.name ?? session.user.email ?? "Account";
  const initial = name.charAt(0).toUpperCase();
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
          {initial}
        </span>
        <span className="hidden text-sm text-muted sm:inline">{name}</span>
      </div>
      <SignOutButton />
    </div>
  );
}
