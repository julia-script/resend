import { expect, test } from "vitest";
import { checkDkim, normalizeDomainName } from "./dkim";

// Live DNS fixtures, same as the pre-refactor test suite: jlort.com publishes
// this key at resend._domainkey.
const JLORT_KEY =
  "MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDuu5N8JTRzYBMTuTOD+/OmE9TX4ioO01tI1pOmhne9qordKnQbq8xzY5PugM+yFR+UvsfyjIYG5VJGOKoaMIiiLnQ0udOBeKg+UxjlSMxJ+RNoFuFPxeCK8hMvX/q3e42gt8eXVI7Z1SoNQNGLDRPSI5JQgVP/mLFdmKmMEvqINwIDAQAB";

test("matching key verifies", async () => {
  const result = await checkDkim({
    selector: "resend",
    domain: "jlort.com",
    publicKey: JLORT_KEY,
  });
  expect(result.type).toBe("success");
});

test("wrong key fails with key_mismatch", async () => {
  const result = await checkDkim({
    selector: "resend",
    domain: "jlort.com",
    publicKey: "MIGfNOTTHEKEY",
  });
  expect(result).toMatchObject({
    type: "failure",
    error: { code: "dkim/key_mismatch" },
  });
});

test("missing record fails with record_not_found", async () => {
  const result = await checkDkim({
    selector: "definitely-not-a-selector",
    domain: "jlort.com",
    publicKey: JLORT_KEY,
  });
  expect(result).toMatchObject({
    type: "failure",
    error: { code: "dkim/record_not_found" },
  });
});

// Garbage input must throw the tagged ApiError (mapped to 400), never a
// raw TypeError from the URL constructor (which surfaced as a 500).
test.each(["not a domain", "asdf", "example.com/path", "  ", "a:b@c"])(
  "normalizeDomainName rejects %j",
  (input) => {
    expect(() => normalizeDomainName(input)).toThrow(
      expect.objectContaining({ code: "dkim/invalid_domain" }),
    );
  },
);

// IDN names must reach DNS in punycode — the form DNS actually resolves.
test("normalizes unicode domains to punycode", () => {
  expect(normalizeDomainName("münchen.de")).toBe("xn--mnchen-3ya.de");
});

test("already-punycoded names pass through unchanged", () => {
  expect(normalizeDomainName("xn--mnchen-3ya.de")).toBe("xn--mnchen-3ya.de");
});

test("normalizes unicode with uppercase and trailing dot", () => {
  expect(normalizeDomainName("MÜNCHEN.de.")).toBe("xn--mnchen-3ya.de");
});

test("invalid domain fails without throwing", async () => {
  const result = await checkDkim({
    selector: "resend",
    domain: "not a domain",
    publicKey: JLORT_KEY,
  });
  expect(result).toMatchObject({
    type: "failure",
    error: { code: "dkim/invalid_domain" },
  });
});
