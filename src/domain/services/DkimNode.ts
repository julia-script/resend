import { randomBytes } from "node:crypto";
import { Schema } from "effect";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Result from "effect/Result";
import * as tldts from "tldts";
import { generateRsaKeyPair } from "../crypto";
import { Dkim, DkimError } from "./Dkim";
import * as Dns from "./Dns";

class CryptoError extends Schema.TaggedErrorClass<CryptoError>()(
  "CryptoError",
  {
    cause: Schema.Unknown,
  },
) {
  static fromError(cause: unknown) {
    return CryptoError.make({ cause });
  }
}
// const generateRsaKeyPair = Effect.callback<
//   Result.Result<{ publicKey: Uint8Array; privateKey: string }, DkimError>,
//   never,
//   never
// >((resume) => {
//   generateKeyPairCrypto(
//     "rsa",
//     {
//       modulusLength: DKIM_MODULUS_LENGTH,
//       publicKeyEncoding: { type: "spki", format: "der" },
//       privateKeyEncoding: { type: "pkcs8", format: "pem" },
//     },
//     (err, publicKey, privateKey) => {
//       if (err) {
//         resume(Effect.succeed(Result.fail(DkimError.fromError("failedToGenerateKeyPair", err))));
//       } else {
//         resume(Effect.succeed(Result.succeed({ publicKey, privateKey })));
//       }
//     },
//   );
// }).pipe(Effect.flatMap(Effect.fromResult));

const _DKIM_MODULUS_LENGTH = 1024;
const SELECTOR_BYTES = 6; // 12 lowercase hex chars, DNS-label-safe

export const generateDkimKeys = Effect.gen(function* () {
  const { publicKey, privateKey } = yield* generateRsaKeyPair.pipe(
    Effect.mapError((error) =>
      DkimError.fromError("failedToGenerateKeyPair", error),
    ),
  );
  return {
    selector: randomBytes(SELECTOR_BYTES).toString("hex"),
    publicKey: Buffer.from(publicKey).toString("base64"),
    privateKeyPem: privateKey,
  };
});

export const layer = Layer.effect(
  Dkim,
  Effect.gen(function* () {
    const dns = yield* Dns.Dns;
    return Dkim.of({
      generateDkimKeys: generateDkimKeys,
      resolveDkim: Effect.fnUntraced(function* (
        selector: string,
        domain: string,
      ) {
        if (!tldts.getDomain(domain)) {
          return yield* Effect.fail(
            DkimError.fromError("record/invalidDomain"),
          );
        }
        // happy path first
        const record = `${selector}._domainkey.${domain}`;
        const records = yield* dns.resolveTxt(record).pipe(Effect.result);
        if (Result.isSuccess(records)) {
          return yield* Effect.succeed(
            records.success.map((record) => record.join("")),
          );
        }

        // now let's try to diagnose the error
        if (records.failure.isTag("ENODATA")) {
          return yield* Effect.fail(
            DkimError.fromError("record/recordNotFound", records.failure),
          );
        }
        if (records.failure.isTag("ENOTFOUND")) {
          return yield* Effect.fail(
            DkimError.fromError("record/domainDoesntExist", records.failure),
          );
        }

        return yield* Effect.fail(
          DkimError.fromError("record/unknownError", records.failure),
        );
      }),
    });
  }),
);
