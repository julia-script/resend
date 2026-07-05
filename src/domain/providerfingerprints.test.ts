import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { strings } from "@/lib/strings";
import { PROVIDERS } from "./providerfingerprints";

// Guards drift between the detection map and the guide metadata map:
// a fingerprinted provider without metadata silently degrades the guide.
test("every fingerprinted provider has guide metadata and a bundled logo", () => {
  for (const provider of Object.keys(PROVIDERS)) {
    const meta = strings.dnsProviders.guide[provider];
    expect(meta, `guide metadata for ${provider}`).toBeDefined();
    if (!meta) continue;
    expect(meta.article, `${provider} article`).toMatch(/^https:\/\//);
    expect(meta.dnsPage, `${provider} dnsPage`).toMatch(/^https:\/\//);
    expect(
      existsSync(join(process.cwd(), "public", meta.logo)),
      `${provider} logo file ${meta.logo}`,
    ).toBe(true);
  }
});
