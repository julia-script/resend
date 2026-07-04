import {
  createCipheriv,
  createDecipheriv,
  generateKeyPair as generateKeyPairCrypto,
  randomBytes,
} from "node:crypto";
import { Schema } from "effect";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";

export class CryptoError extends Schema.TaggedErrorClass<CryptoError>()(
  "CryptoError",
  {
    message: Schema.String,
    cause: Schema.Unknown,
  },
) {
  static fromError(message: string, cause?: unknown) {
    return CryptoError.make({ message, cause });
  }
}
export const generateRsaKeyPair = Effect.callback<
  Result.Result<{ publicKey: Uint8Array; privateKey: string }, CryptoError>,
  never,
  never
>((resume) => {
  generateKeyPairCrypto(
    "rsa",
    {
      modulusLength: DKIM_MODULUS_LENGTH,
      publicKeyEncoding: { type: "spki", format: "der" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    },
    (err, publicKey, privateKey) => {
      if (err) {
        resume(
          Effect.succeed(
            Result.fail(
              CryptoError.fromError("Could not generate RSA key pair", err),
            ),
          ),
        );
      } else {
        resume(Effect.succeed(Result.succeed({ publicKey, privateKey })));
      }
    },
  );
}).pipe(Effect.flatMap(Effect.fromResult));

const DKIM_MODULUS_LENGTH = 1024;

const IV_BYTES = 12;

const keyFromHex = (encryptionKeyHex: string): Buffer => {
  const key = Buffer.from(encryptionKeyHex, "hex");
  if (key.length !== 32) {
    throw CryptoError.fromError("Invalid encryption key");
  }
  return key;
};

export const encryptPrivateKey = Effect.fnUntraced(function* (
  privateKeyPem: string,
  encryptionKeyHex: string,
) {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(
    "aes-256-gcm",
    keyFromHex(encryptionKeyHex),
    iv,
  );
  const ciphertext = Buffer.concat([
    cipher.update(privateKeyPem, "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), ciphertext]
    .map((part) => part.toString("base64"))
    .join(":");
});

export const decryptPrivateKey = Effect.fnUntraced(function* (
  payload: string,
  encryptionKeyHex: string,
) {
  const [iv, authTag, ciphertext] = payload
    .split(":")
    .map((part) => Buffer.from(part, "base64"));
  if (!iv || !authTag || !ciphertext) {
    return yield* Effect.fail(CryptoError.fromError("Malformed payload"));
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    keyFromHex(encryptionKeyHex),
    iv,
  );
  decipher.setAuthTag(authTag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
});
