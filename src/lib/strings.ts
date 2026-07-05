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
    inProgress:
      "We’re checking your DNS about once a minute. This page updates itself — no refreshing needed.",
    gracePeriod:
      "Your DNS record has stopped resolving. The domain stays verified during a grace period — restore the record below before it runs out to keep sending.",
  },

  domainPage: {
    back: "← Domains",
    loading: "Loading domain…",
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
    removeConfirm: (name: string) =>
      `Remove ${name}? This deletes it permanently.`,
  },

  // Targeted DNS-editor guidance for detected providers. Detection is a
  // guess from nameservers, so the copy always hedges ("Looks like…") and
  // anything not in this map falls back to the generic guide steps.
  dnsProviders: {
    intro: (provider: string) =>
      `Looks like your DNS is managed by ${provider}.`,
    dashboardLink: (provider: string) => `Open your ${provider} DNS settings`,
    guide: {
      Cloudflare: {
        nameHint:
          "Cloudflare adds “.yourdomain.com” for you — paste only the part of the Name before your domain.",
        dashboard: "https://dash.cloudflare.com",
      },
      GoDaddy: {
        nameHint:
          "GoDaddy adds your domain to the Name automatically — paste only the part before it.",
        dashboard: "https://dcc.godaddy.com/domains",
      },
      Namecheap: {
        nameHint:
          "In Namecheap the Name field is called “Host”, and it adds your domain for you — paste only the part before it.",
        dashboard: "https://ap.www.namecheap.com/domains/list/",
      },
      AWS: {
        nameHint:
          "Route 53 wants the full record name exactly as shown above, including your domain.",
        dashboard: "https://console.aws.amazon.com/route53/",
      },
    } as Record<string, { nameHint: string; dashboard: string } | undefined>,
  },

  domainList: {
    title: "Your domains",
    count: (n: number) => `${n} ${n === 1 ? "domain" : "domains"}`,
    placeholder: "example.com",
    add: "Add domain",
    adding: "Adding…",
    loading: "Loading domains…",
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
