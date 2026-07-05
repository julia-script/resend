import "server-only";
import { randomBytes } from "node:crypto";
import * as tldts from "tldts";
import { ApiError, type Result } from "@/lib/errors";
import {
  type DnsMockResponse,
  dkimRecordName,
  isMockDomainName,
} from "@/shared/domain";
import { generateRsaKeyPair } from "./crypto";
import { resolveTxt } from "./dns";

const DKIM_MODULUS_LENGTH = 1024;
const SELECTOR_BYTES = 6; // 12 lowercase hex chars, DNS-label-safe
export const generateDkimKeys = async () => {
  const { publicKey, privateKey } = await generateRsaKeyPair("rsa", {
    modulusLength: DKIM_MODULUS_LENGTH,
    publicKeyEncoding: { type: "spki", format: "der" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return {
    selector: randomBytes(SELECTOR_BYTES).toString("hex"),
    publicKey: Buffer.from(publicKey).toString("base64"),
    privateKeyPem: privateKey,
  };
};

const isDomainValid = (name: string) => {
  return tldts.getDomain(name) !== null;
};
const resolveTxtOrMock = async (
  selector: string,
  domain: string,
  mockRecord?: DnsMockResponse | null,
) => {
  if (mockRecord && isMockDomainName(domain)) {
    if (mockRecord.type === "success") {
      // Mirror dns.resolveTxt's string[][]: each entry is one single-chunk record.
      return {
        type: "success" as const,
        value: mockRecord.value.map((v) => [v]),
      };
    }
    return {
      type: "failure" as const,
      error: new ApiError({
        code: `dns/${mockRecord.error}`,
        message: mockRecord.error,
      }),
    };
  }
  return resolveTxt(dkimRecordName({ selector, name: domain }));
};
const resolveDkim = async (
  selector: string,
  domain: string,
  mockRecord?: DnsMockResponse | null,
) => {
  if (!isDomainValid(domain)) {
    throw new ApiError({
      code: "dkim/invalid_domain",
      message: "Invalid domain",
    });
  }
  const result = await resolveTxtOrMock(selector, domain, mockRecord);
  if (result.type === "success") {
    return result.value;
  }
  if (result.error.isTagged("dns/ENODATA")) {
    throw new ApiError({
      code: "dkim/record_not_found",
      message: "Record not found",
    });
  }
  if (result.error.isTagged("dns/ENOTFOUND")) {
    throw new ApiError({
      code: "dkim/domain_not_found",
      message: "Domain not found",
    });
  }
  throw result.error;
};

export type CheckDkimResult = Result<string, ApiError>;
export const checkDkim = async (options: {
  selector: string;
  domain: string;
  publicKey: string;
  /** Canned DNS answer for mock domains — resolved by the caller, not the DB. */
  mockRecord?: DnsMockResponse | null;
}): Promise<Result<string, ApiError>> => {
  try {
    const records = await resolveDkim(
      options.selector,
      options.domain,
      options.mockRecord,
    );
    // Compare the p= tag only: providers may reorder/drop v= and k= tags.
    const match = records
      .map((chunks) => chunks.join(""))
      .find(
        (record) => record.match(/p=([^;\s"]+)/)?.[1] === options.publicKey,
      );
    if (match) {
      return { type: "success", value: match };
    }
    return {
      type: "failure",
      error: new ApiError({
        code: "dkim/key_mismatch",
        message: "DKIM record found but the public key does not match",
      }),
    };
  } catch (error) {
    return {
      type: "failure",
      error:
        error instanceof ApiError
          ? error
          : new ApiError({
              code: "dkim/check_failed",
              message: "DKIM check failed",
              cause: error,
            }),
    };
  }
};

export const normalizeDomainName = (name: string) => {
  const invalid = () =>
    new ApiError({
      code: "dkim/invalid_domain",
      message: "That doesn’t look like a domain name.",
    });
  const trimmed = name.trim().toLowerCase().replace(/\.$/, "");
  if (trimmed === "") throw invalid();
  let url: URL;
  try {
    url = new URL(`http://${trimmed}`);
  } catch {
    // URL constructor rejects garbage ("not a domain") with a TypeError.
    throw invalid();
  }
  const isBareHostname =
    url.pathname === "/" &&
    url.port === "" &&
    url.search === "" &&
    url.hash === "" &&
    url.username === "";
  if (!isBareHostname) throw invalid();
  // Unregistrable names ("asdf", "localhost") could never verify — reject
  // here instead of creating a domain that fails every check.
  if (!isDomainValid(url.hostname)) throw invalid();
  return url.hostname;
};
