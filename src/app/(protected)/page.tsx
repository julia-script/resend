import { redirect } from "next/navigation";
import { Domains } from "@/components/Domains";
import { auth } from "@/lib/auth/handlers";

export default async function Home() {
  const session = await auth();
  if (!session) redirect("/signin");
  const firstName = session.user?.name?.split(" ")[0] ?? "there";
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">
        Hi, {firstName} 👋
      </h1>
      <p className="mt-2 text-muted">
        Welcome back. Your domains will show up here.
      </p>
      <div className="mt-8">
        <Domains />
      </div>
    </main>
  );
}
