import { expect, test } from "vitest";
import { dkimRecordValue } from "@/shared/domain";
import { checkDkim, normalizeDomainName } from "./dkim";

// Hermetic DNS: checkDkim's mockRecord seam (the same one the dev mocks
// console uses) answers instead of live resolvers. The domain must contain
// "mock" (isMockDomainName) for the injected record to apply.
const TEST_KEY = "MIGfTESTKEYBASE64";
const MOCK_DOMAIN = "example.mock";

test("matching key verifies", async () => {
  const result = await checkDkim({
    selector: "testsel",
    domain: MOCK_DOMAIN,
    publicKey: TEST_KEY,
    mockRecord: {
      type: "success",
      value: [dkimRecordValue({ publicKey: TEST_KEY })],
    },
  });
  expect(result.type).toBe("success");
});

test("wrong key fails with key_mismatch", async () => {
  const result = await checkDkim({
    selector: "testsel",
    domain: MOCK_DOMAIN,
    publicKey: "MIGfNOTTHEKEY",
    mockRecord: {
      type: "success",
      value: [dkimRecordValue({ publicKey: TEST_KEY })],
    },
  });
  expect(result).toMatchObject({
    type: "failure",
    error: { code: "dkim/key_mismatch" },
  });
});

test("missing record fails with record_not_found", async () => {
  const result = await checkDkim({
    selector: "testsel",
    domain: MOCK_DOMAIN,
    publicKey: TEST_KEY,
    mockRecord: { type: "failure", error: "ENODATA" },
  });
  expect(result).toMatchObject({
    type: "failure",
    error: { code: "dkim/record_not_found" },
  });
});

test("unresolvable domain fails with domain_not_found", async () => {
  const result = await checkDkim({
    selector: "testsel",
    domain: MOCK_DOMAIN,
    publicKey: TEST_KEY,
    mockRecord: { type: "failure", error: "ENOTFOUND" },
  });
  expect(result).toMatchObject({
    type: "failure",
    error: { code: "dkim/domain_not_found" },
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
    selector: "testsel",
    domain: "not a domain",
    publicKey: TEST_KEY,
  });
  expect(result).toMatchObject({
    type: "failure",
    error: { code: "dkim/invalid_domain" },
  });
});
