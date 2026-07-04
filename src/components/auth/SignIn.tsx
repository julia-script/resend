import { signIn } from "@/lib/auth/handlers";

export function SignIn() {
  return (
    <form
      className="flex flex-col gap-3"
      action={async (formData) => {
        "use server";
        await signIn("resend", formData);
      }}
    >
      <input
        type="email"
        name="email"
        placeholder="you@example.com"
        required
        className="rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted/60 focus:border-accent-foreground/40 focus:ring-2 focus:ring-accent"
      />
      <button
        type="submit"
        className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-foreground hover:text-surface"
      >
        Send me a sign-in link
      </button>
    </form>
  );
}
