import { redirect } from "next/navigation";
import { SignIn } from "@/components/auth/SignIn";
import { auth } from "@/lib/auth/handlers";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const session = await auth();
  if (session) {
    redirect("/");
  }
  const { type } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8 shadow-soft">
        {type === "email" ? (
          <>
            <span className="inline-block rounded-md bg-mint px-2 py-0.5 text-xs font-medium text-mint-foreground">
              Link sent
            </span>
            <p className="mt-3 text-sm text-muted">
              Check your email — a sign-in link is on the way.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold tracking-tight">
              Welcome back
            </h1>
            <p className="mt-1 mb-6 text-sm text-muted">
              Enter your email and we&apos;ll send you a magic link.
            </p>
            <SignIn />
          </>
        )}
      </div>
    </main>
  );
}
