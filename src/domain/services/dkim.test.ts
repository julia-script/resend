import { Effect } from "effect";
import { describe, expect, test } from "vitest";
import { runtimeNode } from "@/lib/runtime-node";
import * as Dkim from "./Dkim";

describe("Dkim", () => {
  test("should resolve DKIM records for a domain", async () =>
    Effect.gen(function* () {
      const dkim = yield* Dkim.Dkim;
      const records = yield* dkim.resolveDkim("resend", "jlort.com");
      expect(records).toMatchInlineSnapshot(`
        [
          "p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDuu5N8JTRzYBMTuTOD+/OmE9TX4ioO01tI1pOmhne9qordKnQbq8xzY5PugM+yFR+UvsfyjIYG5VJGOKoaMIiiLnQ0udOBeKg+UxjlSMxJ+RNoFuFPxeCK8hMvX/q3e42gt8eXVI7Z1SoNQNGLDRPSI5JQgVP/mLFdmKmMEvqINwIDAQAB",
        ]
      `);
    }).pipe(runtimeNode.runPromise));

  test("Inexistent domain should return 'domainDoesntExist' error", async () =>
    Effect.gen(function* () {
      const dkim = yield* Dkim.Dkim;
      const records = yield* dkim
        .resolveDkim(
          "resend",
          "thisdefinitelydoesntexistunlesssomeonebuysittobreakmytest.com",
        )
        .pipe(Effect.result);
      expect(records).toMatchInlineSnapshot(`
        {
          "_id": "Result",
          "_tag": "Failure",
          "failure": {
            "_tag": "DkimError",
            "cause": [DnsError],
            "code": "record/domainDoesntExist",
          },
        }
      `);
    }).pipe(runtimeNode.runPromise));

  test("Invalid domain should return 'invalidDomain' error", async () =>
    Effect.gen(function* () {
      const dkim = yield* Dkim.Dkim;
      const records = yield* dkim
        .resolveDkim("resend", "thisisnotavaliddomain")
        .pipe(Effect.result);
      expect(records).toMatchInlineSnapshot(`
        {
          "_id": "Result",
          "_tag": "Failure",
          "failure": {
            "_tag": "DkimError",
            "cause": undefined,
            "code": "record/invalidDomain",
          },
        }
      `);
    }).pipe(runtimeNode.runPromise));

  test("Record not found should return 'recordNotFound' error", async () =>
    Effect.gen(function* () {
      const dkim = yield* Dkim.Dkim;
      const records = yield* dkim
        .resolveDkim("validDomainButNoRecord", "jlort.com")
        .pipe(Effect.result);
      expect(records).toMatchInlineSnapshot(`
        {
          "_id": "Result",
          "_tag": "Failure",
          "failure": {
            "_tag": "DkimError",
            "cause": [DnsError],
            "code": "record/recordNotFound",
          },
        }
      `);
    }).pipe(runtimeNode.runPromise));
});
