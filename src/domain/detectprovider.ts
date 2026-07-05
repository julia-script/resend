"use cache";
import "server-only";
import { resolveNs, resolveSoa } from "node:dns/promises";
import { cacheLife } from "next/cache";
import * as tldts from "tldts";

export interface DnsProviderResult {
  provider: string;
  confidence: "high" | "medium" | "low";
  matchedBy: "ns" | "soa" | "unknown";
}

// Nameserver fingerprints. Plain entries match on a label boundary
// (exact host or dot-suffix); entries ending in "-" match as a label
// prefix (Route 53 hosts look like ns-123.awsdns-45.com).
const PROVIDERS: Record<string, string[]> = {
  Cloudflare: ["cloudflare.com"],
  AWS: ["awsdns-"],
  Google: ["googledomains.com", "google.com"],
  Azure: ["azure-dns.com", "azure-dns.net", "azure-dns.org", "azure-dns.info"],
  DigitalOcean: ["digitalocean.com"],
  Namecheap: ["registrar-servers.com"],
  GoDaddy: ["domaincontrol.com"],
  Bluehost: ["bluehost.com"],
  HostGator: ["hostgator.com"],
  DreamHost: ["dreamhost.com"],
  Squarespace: ["squarespacedns.com"],
  Wix: ["wixdns.net"],
  Vercel: ["vercel-dns.com"],
};

const matchesFingerprint = (hostname: string, fingerprint: string) =>
  fingerprint.endsWith("-")
    ? hostname.split(".").some((label) => label.startsWith(fingerprint))
    : hostname === fingerprint || hostname.endsWith(`.${fingerprint}`);

function matchProvider(hostname: string): string | undefined {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  for (const [provider, fingerprints] of Object.entries(PROVIDERS)) {
    if (fingerprints.some((f) => matchesFingerprint(host, f))) {
      return provider;
    }
  }
  return undefined;
}

/**
 * Best-effort guess at where a domain's DNS is managed, from its
 * nameservers (SOA as fallback for vanity NS). Advisory only: callers
 * must treat "Unknown" / low confidence as "show the generic guide".
 */
export async function detectDnsProvider(
  name: string,
): Promise<DnsProviderResult> {
  cacheLife("days");
  // Subdomains rarely have their own NS; query the registrable domain.
  const zone = tldts.getDomain(name) ?? name;

  try {
    const ns = await resolveNs(zone);
    for (const server of ns) {
      const provider = matchProvider(server);
      if (provider) {
        return { provider, confidence: "high", matchedBy: "ns" };
      }
    }
  } catch {
    // advisory: fall through to SOA
  }

  try {
    const soa = await resolveSoa(zone);
    const provider = matchProvider(soa.nsname);
    if (provider) {
      return { provider, confidence: "medium", matchedBy: "soa" };
    }
  } catch {
    // advisory: fall through to Unknown
  }

  return { provider: "Unknown", confidence: "low", matchedBy: "unknown" };
}
