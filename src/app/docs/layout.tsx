import type { PropsWithChildren } from "react";
import { SiteHeader } from "@/components/SiteHeader";

export default function DocsLayout({ children }: PropsWithChildren) {
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        {children}
      </main>
    </div>
  );
}
