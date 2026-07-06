import { Skeleton } from "@/components/Skeleton";

// Mirrors the home page layout: greeting, two info cards, domains card.
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="mt-3 h-4 w-72" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-surface p-5 shadow-soft"
          >
            <Skeleton className="h-5 w-20" />
            <Skeleton className="mt-3 h-4 w-full" />
          </div>
        ))}
        <div className="rounded-xl border border-border bg-surface p-5 shadow-soft sm:col-span-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="mt-4 h-9 w-full" />
          <div className="mt-4 space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
