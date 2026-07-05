import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { DnsGuide } from "./DnsGuide";

test("curated provider renders logo, deep link, and article link", () => {
  const html = renderToStaticMarkup(<DnsGuide provider="Cloudflare" />);
  expect(html).toContain("/providers/cloudflare.svg");
  expect(html).toContain(
    "https://dash.cloudflare.com/?to=/:account/:zone/dns/records",
  );
  expect(html).toContain(
    "https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/",
  );
  expect(html).toContain('target="_blank"');
  expect(html).toContain('rel="noreferrer"');
  // Curated name hint replaces the generic one.
  expect(html).toContain("paste only the part of the Name before your domain");
});

test("no provider renders the generic guide with no provider block", () => {
  const html = renderToStaticMarkup(<DnsGuide />);
  expect(html).not.toContain("Looks like");
  expect(html).not.toContain("<img");
  expect(html).not.toContain("providers/");
});

test("provider without metadata degrades to name-only", () => {
  const html = renderToStaticMarkup(<DnsGuide provider="SomeNewHost" />);
  expect(html).toContain("Looks like your DNS is managed by SomeNewHost.");
  expect(html).not.toContain("<img");
  expect(html).not.toContain('target="_blank"');
});
