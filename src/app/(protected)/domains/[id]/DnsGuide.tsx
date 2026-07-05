import { strings } from "@/lib/strings";

// Server-rendered: static copy, keyed off a provider guess made at render.
export const DnsGuide = ({ provider }: { provider?: string }) => {
  const hint = provider ? strings.dnsProviders.guide[provider] : undefined;
  return (
    <details className="mt-4 rounded-md bg-background px-3 py-2">
      <summary className="cursor-pointer text-sm text-muted hover:text-foreground">
        {strings.domainPage.guideTitle}
      </summary>
      {provider && (
        <p className="mt-3 text-sm text-foreground">
          {strings.dnsProviders.intro(provider)}
          {hint && (
            <>
              {" "}
              <a
                href={hint.dashboard}
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-accent-foreground"
              >
                {strings.dnsProviders.dashboardLink(provider)}
              </a>
            </>
          )}
        </p>
      )}
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted">
        <li>
          Log in to wherever your domain lives — usually the company you pay
          about $12/year (GoDaddy, Namecheap, Cloudflare, and friends).
        </li>
        <li>
          Find the DNS settings. It hides under names like “DNS management”,
          “Zone editor”, or “Advanced DNS”. Companies love renaming this page.
        </li>
        <li>
          Add a new record and set its type to <strong>TXT</strong>.
        </li>
        <li>
          In the <strong>Name</strong> (or “Host”) field, paste the Name shown
          above.{" "}
          {hint?.nameHint ??
            "Heads-up: if your provider already displays “.yourdomain.com” after the box, only paste the part before it."}
        </li>
        <li>
          In the <strong>Value</strong> (or “Content”) field, paste the entire
          Value from above. Yes, all of it — that wall of gibberish is a public
          key, not a malfunction.
        </li>
        <li>Leave TTL on the default and save.</li>
        <li>
          Wait. DNS updates travel at the speed of bureaucracy — usually a few
          minutes, occasionally an hour. We re-check every minute, so you can
          just leave this page open.
        </li>
      </ol>
    </details>
  );
};
