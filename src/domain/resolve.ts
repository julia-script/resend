import dns from "node:dns/promises";
import { Context, Effect, Result, Schema } from "effect";
import { get } from "lodash-es";
import * as tldts from "tldts";
export const DnsErrorCode = Schema.Literals([
  dns.NODATA,
  dns.FORMERR,
  dns.SERVFAIL,
  dns.NOTFOUND,
  dns.NOTIMP,
  dns.REFUSED,
  dns.BADQUERY,
  dns.BADNAME,
  dns.BADFAMILY,
  dns.BADRESP,
  dns.CONNREFUSED,
  dns.TIMEOUT,
  dns.EOF,
  dns.FILE,
  dns.NOMEM,
  dns.DESTRUCTION,
  dns.BADSTR,
  dns.BADFLAGS,
  dns.NONAME,
  dns.BADHINTS,
  dns.NOTINITIALIZED,
  dns.LOADIPHLPAPI,
  dns.ADDRGETNETWORKPARAMS,
  dns.CANCELLED,

  "UNKNOWN",
]);

class DnsError extends Schema.TaggedErrorClass<DnsError>()("DnsError", {
  code: DnsErrorCode,
  cause: Schema.Unknown,
}) {
  static fromError(error: unknown) {
    const code = get(error, "code", "UNKNOWN");
    return DnsError.make({
      code,
      cause: error,
    });
  }
  isTag(code: typeof DnsErrorCode.Type): boolean {
    return code === this.code;
  }
}

const wrapDns = <A>(fn: () => Promise<A>) =>
  Effect.tryPromise({
    try: fn,
    catch: DnsError.fromError,
  });

export const resolveTxt = (domain: string) =>
  wrapDns(() => dns.resolveTxt(domain));

const DkimErrorCode = Schema.Union([
  // doesnt pass simple text validation
  Schema.Literal("invalidDomain"),

  // domain doesn't exist at all
  Schema.Literal("domainDoesntExist"),

  // domain exists, but record doesn't
  Schema.Literal("recordNotFound"),

  // record exists, but value is wrong
  Schema.Literal("wrongRecordValue"),

  Schema.Literal("unknownError"),
]);
type DkimErrorCode = typeof DkimErrorCode.Type;
class DkimError extends Schema.TaggedErrorClass<DkimError>()("DkimError", {
  code: DkimErrorCode,
  cause: Schema.Unknown,
}) {
  static fromError(code: DkimErrorCode, error?: unknown) {
    return DkimError.make({ code, cause: error });
  }
}
export const resolveDkim = Effect.fnUntraced(function* (
  selector: string,
  domain: string,
) {
  if (!tldts.getDomain(domain)) {
    return yield* Effect.fail(DkimError.fromError("invalidDomain"));
  }
  // happy path first
  const record = `${selector}._domainkey.${domain}`;
  const records = yield* resolveTxt(record).pipe(Effect.result);
  if (Result.isSuccess(records)) {
    return yield* Effect.succeed(
      records.success.map((record) => record.join("")),
    );
  }

  // now let's try to diagnose the error

  if (records.failure.isTag("ENODATA")) {
    return yield* Effect.fail(
      DkimError.fromError("recordNotFound", records.failure),
    );
  }
  if (records.failure.isTag("ENOTFOUND")) {
    return yield* Effect.fail(
      DkimError.fromError("domainDoesntExist", records.failure),
    );
  }

  return yield* Effect.fail(
    DkimError.fromError("unknownError", records.failure),
  );
});

class DkimService extends Context.Service<
  DkimService,
  {
    resolveDkim: (
      selector: string,
      domain: string,
    ) => Effect.Effect<string[], DkimError>;
  }
>()("Config") {}
