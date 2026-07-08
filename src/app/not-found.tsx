import Link from "next/link";

// Renders for unknown routes and every notFound() call (foreign domain ids,
// the gated mocks console) — instead of Next's unbranded default.
export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-sm font-medium text-muted">404</p>
      <h1 className="text-lg font-semibold">This page doesn’t exist.</h1>
      <p className="max-w-sm text-sm text-muted">
        The link may be stale, or it points at a domain you don’t have access
        to.
      </p>
      <Link
        href="/"
        className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-foreground hover:text-surface"
      >
        Back to your domains
      </Link>
    </main>
  );
}
