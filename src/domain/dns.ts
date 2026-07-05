import "server-only";
import dns from "node:dns/promises";
import { get } from "lodash-es";
import { ApiError } from "@/lib/errors";

const wrapDns = async <A>(
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
