import { Skeleton } from "@/components/Skeleton";

// Mirrors the domain detail layout: back link, header, DNS record card.
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <Skeleton className="h-4 w-24" />
      <div className="mt-6 flex items-center gap-3">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-5 w-20" />
      </div>
      <Skeleton className="mt-3 h-4 w-64" />
      <div className="mt-8 rounded-xl border border-border bg-surface p-5 shadow-soft">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="mt-2 h-4 w-80 max-w-full" />
        <div className="mt-4 grid gap-4">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    </main>
  );
}
