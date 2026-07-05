import { expect, test } from "vitest";
import { checkDkim } from "./dkim";

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
