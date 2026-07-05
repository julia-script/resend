"use cache";
import "server-only";
import { resolveNs, resolveSoa } from "node:dns/promises";
import { cacheLife } from "next/cache";
import * as tldts from "tldts";
import { matchProvider } from "./providerfingerprints";

export interface DnsProviderResult {
  provider: string;
  confidence: "high" | "medium" | "low";
  matchedBy: "ns" | "soa" | "unknown";
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
