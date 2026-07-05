import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  generateKeyPair as generateKeyPairCrypto,
  randomBytes,
} from "node:crypto";
import { promisify } from "node:util";
import { ApiError } from "@/lib/errors";

export const generateRsaKeyPair = promisify(generateKeyPairCrypto);

const DKIM_MODULUS_LENGTH = 1024;

const IV_BYTES = 12;

const parseHex = (hex: string) => {
  return Uint8Array.from(Buffer.from(hex, "hex"));
};
const keyFromHex = (encryptionKeyHex: string): Uint8Array => {
  const key = parseHex(encryptionKeyHex.replace(/-/g, ""));
  if (key.length !== 32) {
    throw new ApiError({
      code: "crypto/invalid_encryption_key",
      message: "Invalid encryption key",
    });
  }
  return key;
};

export const encryptPrivateKey = (
  privateKeyPem: string,
  encryptionKeyHex: string,
) => {
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
};

// Unused until real sending ships, but it's the only way to read the
// privateKeyEncrypted column — the counterpart of encryptPrivateKey.
// fallow-ignore-next-line unused-export
export const decryptPrivateKey = (
  payload: string,
  encryptionKeyHex: string,
) => {
  const [iv, authTag, ciphertext] = payload
    .split(":")
    .map((part) => Buffer.from(part, "base64"));
  if (!iv || !authTag || !ciphertext) {
    throw new ApiError({
      code: "crypto/malformed_payload",
      message: "Malformed payload",
    });
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
};
