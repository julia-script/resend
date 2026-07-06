import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { UserMenu } from "@/components/auth/UserMenu";
import { env } from "@/lib/env";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-surface/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-6">
        <Link href="/">
          <Image
            src="/logo.png"
            alt="inkwell"
            width={736}
            height={318}
            className="h-8 w-auto"
            priority
            unoptimized
          />
        </Link>
        <div className="flex items-center gap-4">
          {env.enableMock && (
            <Link
              href="/mocks"
              className="text-sm text-muted transition-colors hover:text-foreground"
            >
              Mocks
            </Link>
          )}
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
  );
}
