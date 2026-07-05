import Link from "next/link";
import { redirect } from "next/navigation";
import type { PropsWithChildren } from "react";
import { UserMenu } from "@/components/auth/UserMenu";
import { auth } from "@/lib/auth/handlers";

export default async function ProtectedLayout({ children }: PropsWithChildren) {
  const session = await auth();
  if (!session) {
    redirect("/signin");
  }
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-surface/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-6">
          <Link href="/" className="font-semibold tracking-tight">
            resend<span className="text-accent-foreground">.</span>
          </Link>
          <div className="flex items-center gap-4">
            <a
              href="/api/reference"
              className="text-sm text-muted transition-colors hover:text-foreground"
            >
              API
            </a>
            <UserMenu user={session.user} />
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
