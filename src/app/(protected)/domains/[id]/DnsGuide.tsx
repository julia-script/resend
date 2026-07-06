import { strings } from "@/lib/strings";

// Server-rendered: the detected-provider callout, shown above the guide.
export const ProviderHint = ({ provider }: { provider?: string }) => {
  if (!provider) return null;
  const hint = strings.dnsProviders.guide[provider];
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-md bg-background px-3 py-2.5 text-sm">
      <p className="flex items-center gap-2">
        {hint && (
          // biome-ignore lint/performance/noImgElement: tiny bundled SVG, no image pipeline needed
          <img
            src={hint.logo}
            alt=""
            width={20}
            height={20}
            className="h-5 w-5 shrink-0 object-contain"
          />
        )}
        {strings.dnsProviders.intro(provider)}
      </p>
      {hint && (
        <p className="flex flex-wrap gap-x-4 gap-y-1">
          <a
            href={hint.dnsPage}
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-accent-foreground"
          >
            {strings.dnsProviders.dnsPageLink}
          </a>
          <a
            href={hint.article}
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-accent-foreground"
          >
            {strings.dnsProviders.articleLink(provider)}
          </a>
        </p>
      )}
    </div>
  );
};

// Server-rendered: static copy, keyed off a provider guess made at render.
export const DnsGuide = ({ provider }: { provider?: string }) => {
  const hint = provider ? strings.dnsProviders.guide[provider] : undefined;
  return (
    <details className="mt-4 rounded-md bg-background px-3 py-2">
      <summary className="cursor-pointer text-sm text-muted hover:text-foreground">
        {strings.domainPage.guideTitle}
      </summary>
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
