import { randomBytes } from "node:crypto";
import { generateRsaKeyPair } from "./crypto";
import * as tldts from "tldts";
import { ApiError } from "@/lib/api/helpers";
import { resolveTxt } from "./dns";

export const recordName = (options: { selector: string; domain: string }) => {
  return `${options.selector}._domainkey.${options.domain}`;
};

export const recordValue = (options: { publicKey: string }) => {
  return `v=DKIM1; k=rsa; p=${options.publicKey}`;
};

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
export const resolveDkim = async (selector: string, domain: string) => {
  if (!isDomainValid(domain)) {
    throw new ApiError({
      code: "dkim/invalid_domain",
      message: "Invalid domain",
    });
  }
  // happy path first
  const record = recordName({ selector, domain });
  const result = await resolveTxt(record);
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


export const normalizeDomainName = (name: string)=>{
  const trimmed = name.trim().toLowerCase().replace(/\.$/, "");
  if (trimmed === "") {
    throw new ApiError({
      code: "dkim/invalid_domain",
      message: "Invalid domain",
    });
  }
  const url = new URL(`http://${trimmed}`);
  const isBareHostname =
    url.pathname === "/" &&
    url.port === "" &&
    url.search === "" &&
    url.hash === "" &&
    url.username === "";
  if (!isBareHostname) {
    throw new ApiError({
      code: "dkim/invalid_domain",
      message: "Invalid domain",
    });
  }
  return url.hostname;
};
