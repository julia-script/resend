import type { VerifyAction } from "@/domain/verification";
import type { CheckLogEntry, PartialDomain } from "@/shared/domain";

type Status = PartialDomain["status"];
type StatusReason = NonNullable<PartialDomain["statusReason"]>;
type FailedReason = Extract<CheckLogEntry, { status: "failed" }>["reason"];
type RevokedReason = Extract<CheckLogEntry, { status: "revoked" }>["reason"];

// All user-facing copy, keyed by the domain enums (localization-style).
// `satisfies` keeps every enum value covered: adding a status/reason without
// a label is a type error here, not a blank spot in the UI.
export const strings = {
  loading: "Loading…",

  status: {
    not_started: "Not started",
    in_progress: "In progress",
    verified: "Verified",
    failed: "Failed",
  } satisfies Record<Status, string>,

  // What happened + what to do next, shown when a domain is failed.
  statusReason: {
    expired:
      "We kept looking for your DNS record for the whole verification window, but it never appeared. Double-check the record below, then start verification again.",
    superseded:
      "Another account verified ownership of this domain, so your verification was revoked. Re-verifying will generate a brand-new DNS record for you to add — the old one won't work anymore.",
    grace_period_expired:
      "Your DNS record disappeared and didn't come back within the grace period, so the domain was unverified. Restore or re-add the record below and verify again.",
    canceled: "Verification was canceled. Start again whenever you're ready.",
  } satisfies Record<StatusReason, string>,

  verifyButton: {
    start: "I’ve added the record — verify",
    restart: "Try again",
    rotate: "Get a new record & re-verify",
    check: "Check again now",
  } satisfies Record<VerifyAction, string>,
  verifyButtonPending: "Checking…",
  verifyError: "Couldn’t start verification. Try again.",

  checkLog: {
    ok: "Record found — all good",
    expired: "Verification window expired",
    rotated: "New DKIM record generated",
    failed: {
      record_not_found: "Record not found yet",
      key_mismatch: "Found a record, but with a different key",
      domain_not_found: "Domain doesn’t resolve",
      unexpected_error: "Check hit an unexpected error",
    } satisfies Record<FailedReason, string>,
    revoked: {
      superseded: "Revoked — verified by another account",
      grace_period_expired: "Revoked — grace period ran out",
      user_canceled: "Canceled",
    } satisfies Record<RevokedReason, string>,
  },

  banner: {
    inProgressTitle: "Verification in progress — nothing else for you to do",
    inProgressBody:
      "DNS changes take a while to propagate — usually a few minutes, sometimes an hour or more. A wait here is completely normal. We check your DNS about once a minute and this page updates itself, or just close it and we’ll email you once it’s verified.",
    // "ago" comes from timeAgo(), which can return the phrase "just now" —
    // "Last checked just now" reads oddly, so that case drops the "Last".
    inProgressLastCheck: (ago: string) =>
      ago === "just now" ? "Checked just now." : `Last checked ${ago}.`,
    inProgressFirstCheck: "First check is coming up in under a minute.",
    inProgressDeadline: (until: string) =>
      `We’ll keep checking until ${until}.`,
    gracePeriod:
      "Your DNS record has stopped resolving. The domain stays verified during a grace period — restore the record below before it runs out to keep sending.",
  },

  // The illustrated 3-step story shown before verification starts.
  setupSteps: [
    { title: "Copy your DNS record" },
    { title: "Add it at your DNS provider" },
    {
      title: "Relax — we'll take it from here",
      subtitle:
        "DNS changes can take a while to propagate. We’ll email you as soon as your domain is verified.",
    },
  ] as ReadonlyArray<{ title: string; subtitle?: string }>,

  domainPage: {
    back: "← Domains",
    notFound: "Domain not found, or you don’t have access to it.",
    dnsCardTitle: "DNS record",
    dnsCardIntro:
      "Add this TXT record to your DNS provider to verify the domain.",
    nameLabel: "Name",
    valueLabel: "Value",
    guideTitle: "First time editing DNS? No shame — everyone googles this.",
    lastChecked: (label: string, ago: string) => `${label} · ${ago}`,
    remove: "Remove domain",
    removing: "Removing…",
    removeError: "Couldn’t remove the domain. Try again.",
    removeConfirm: (name: string) =>
      `Remove ${name}? This deletes it permanently.`,
  },

  // Targeted DNS-editor guidance for detected providers. Detection is a
  // guess from nameservers, so the copy always hedges ("Looks like…") and
  // anything not in this map falls back to the generic guide steps.
  dnsProviders: {
    intro: (provider: string) =>
      `Looks like your DNS is managed by ${provider}.`,
    dnsPageLink: "Open your DNS records ↗",
    articleLink: (provider: string) =>
      `How to add a TXT record on ${provider} ↗`,
    // Keys must match the provider names emitted by detectprovider.ts
    // (guarded by a unit test). `dnsPage` is the deepest link that works
    // for everyone; `article` is the provider's official how-to.
    guide: {
      Cloudflare: {
        nameHint:
          "Cloudflare adds “.yourdomain.com” for you — paste only the part of the Name before your domain.",
        article:
          "https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/",
        dnsPage: "https://dash.cloudflare.com/?to=/:account/:zone/dns/records",
        logo: "/providers/cloudflare.svg",
      },
      GoDaddy: {
        nameHint:
          "GoDaddy adds your domain to the Name automatically — paste only the part before it.",
        article: "https://www.godaddy.com/help/add-a-txt-record-19232",
        dnsPage: "https://dcc.godaddy.com/domains",
        logo: "/providers/godaddy.svg",
      },
      Namecheap: {
        nameHint:
          "In Namecheap the Name field is called “Host”, and it adds your domain for you — paste only the part before it.",
        article:
          "https://www.namecheap.com/support/knowledgebase/article.aspx/317/2237/how-do-i-add-txtspfdkimdmarc-records-for-my-domain/",
        dnsPage: "https://ap.www.namecheap.com/domains/list/",
        logo: "/providers/namecheap.svg",
      },
      AWS: {
        nameHint:
          "Route 53 wants the full record name exactly as shown above, including your domain.",
        article:
          "https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/resource-record-sets-creating.html",
        dnsPage: "https://console.aws.amazon.com/route53/v2/hostedzones",
        logo: "/providers/aws.svg",
      },
      Google: {
        article: "https://cloud.google.com/dns/docs/records",
        dnsPage: "https://console.cloud.google.com/net-services/dns/zones",
        logo: "/providers/google.svg",
      },
      Azure: {
        article:
          "https://learn.microsoft.com/en-us/azure/dns/dns-operations-recordsets-portal",
        dnsPage:
          "https://portal.azure.com/#browse/Microsoft.Network%2FdnsZones",
        logo: "/providers/azure.svg",
      },
      DigitalOcean: {
        article:
          "https://docs.digitalocean.com/products/networking/dns/how-to/manage-records/",
        dnsPage: "https://cloud.digitalocean.com/networking/domains",
        logo: "/providers/digitalocean.svg",
      },
      Bluehost: {
        article:
          "https://www.bluehost.com/help/article/dm-guide-to-the-dns-tab-in-the-account-manager",
        dnsPage: "https://my.bluehost.com",
        logo: "/providers/bluehost.svg",
      },
      HostGator: {
        article: "https://www.hostgator.com/help/article/changing-dns-records",
        dnsPage: "https://portal.hostgator.com",
        logo: "/providers/hostgator.svg",
      },
      DreamHost: {
        article:
          "https://help.dreamhost.com/hc/en-us/articles/360035516812-Adding-custom-DNS-records",
        dnsPage: "https://panel.dreamhost.com",
        logo: "/providers/dreamhost.svg",
      },
      Squarespace: {
        article:
          "https://support.squarespace.com/hc/en-us/articles/360002101888",
        dnsPage: "https://account.squarespace.com/domains",
        logo: "/providers/squarespace.svg",
      },
      Wix: {
        article:
          "https://support.wix.com/en/article/adding-or-updating-txt-records-in-your-wix-account",
        dnsPage: "https://manage.wix.com/account/domains",
        logo: "/providers/wix.svg",
      },
      Vercel: {
        article: "https://vercel.com/docs/domains/managing-dns-records",
        dnsPage: "https://vercel.com/dashboard/domains",
        logo: "/providers/vercel.svg",
      },
    } as Record<
      string,
      | { nameHint?: string; article: string; dnsPage: string; logo: string }
      | undefined
    >,
  },

  domainList: {
    title: "Your domains",
    count: (n: number) => `${n} ${n === 1 ? "domain" : "domains"}`,
    nameLabel: "Domain name",
    placeholder: "example.com",
    add: "Add domain",
    adding: "Adding…",
    loadError: "Couldn’t load domains. Try refreshing.",
    empty: "No domains yet. Add one above to start sending.",
    genericError: "Something went wrong.",
    claimWarning:
      "is already verified by another account. You can claim it — once you verify ownership, their verification will be revoked.",
    claim: "Claim it anyway",
    claiming: "Claiming…",
  },

  copy: { idle: "Copy", copied: "Copied" },
} as const;
