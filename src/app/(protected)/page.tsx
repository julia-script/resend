import { Domains } from "@/components/Domains";
import { auth } from "@/lib/auth/handlers";

export default async function Home() {
  const session = await auth();
  const firstName = session?.user?.name?.split(" ")[0] ?? "there";
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">
        Hi, {firstName} 👋
      </h1>
      <p className="mt-2 text-muted">
        Welcome back. Your domains will show up here.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-5 shadow-soft">
          <span className="inline-block rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
            Domains
          </span>
          <p className="mt-3 text-sm text-muted">
            Add and verify sending domains.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5 shadow-soft">
          <span className="inline-block rounded-md bg-mint px-2 py-0.5 text-xs font-medium text-mint-foreground">
            API
          </span>
          <p className="mt-3 text-sm text-muted">
            Explore the API reference at{" "}
            <code className="font-mono text-xs">/api/reference</code>.
          </p>
        </div>
        <Domains />
      </div>
    </main>
  );
}
