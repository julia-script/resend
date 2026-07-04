import { ApiError } from "@/lib/api/helpers";
import { get } from "lodash-es";
import dns from "node:dns/promises";

export const wrapDns = async <A>(
  fn: () => Promise<A>,
): Promise<
  | {
      type: "success";
      value: A;
    }
  | {
      type: "failure";
      error: ApiError;
    }
> => {
  try {
    const result = await fn();
    return {
      type: "success",
      value: result,
    };
  } catch (error) {
    const code = get(error, "code", "UNKNOWN");
    return {
      type: "failure",
      error: new ApiError({
        code: `dns/${code}`,
        message: String(error),
        cause: error,
      }),
    };
  }
};

export const resolveTxt = (domain: string) =>
  wrapDns(() => dns.resolveTxt(domain));
export const resolveNs = (domain: string) =>
  wrapDns(() => dns.resolveNs(domain));
export const resolveMx = (domain: string) =>
  wrapDns(() => dns.resolveMx(domain));
export const resolveSrv = (domain: string) =>
  wrapDns(() => dns.resolveSrv(domain));
