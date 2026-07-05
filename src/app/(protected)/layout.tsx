import Link from "next/link";
import { type PropsWithChildren, Suspense } from "react";
import { UserMenu } from "@/components/auth/UserMenu";

export default async function ProtectedLayout({ children }: PropsWithChildren) {
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
            <Suspense>
              <UserMenu />
            </Suspense>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
