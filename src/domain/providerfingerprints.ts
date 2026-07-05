// Nameserver fingerprints. Plain entries match on a label boundary
// (exact host or dot-suffix); entries ending in "-" match as a label
// prefix (Route 53 hosts look like ns-123.awsdns-45.com).
// Lives outside detectprovider.ts: that file is "use cache", which only
// permits async-function exports, and tests need this map directly.
export const PROVIDERS: Record<string, string[]> = {
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

export function matchProvider(hostname: string): string | undefined {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  for (const [provider, fingerprints] of Object.entries(PROVIDERS)) {
    if (fingerprints.some((f) => matchesFingerprint(host, f))) {
      return provider;
    }
  }
  return undefined;
}
