import dns from "node:dns/promises";
import { Context, type Effect } from "effect";
import * as Schema from "effect/Schema";
import { get } from "lodash-es";

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

export class DnsError extends Schema.TaggedErrorClass<DnsError>()("DnsError", {
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

export class Dns extends Context.Service<
  Dns,
  {
    resolveTxt: (domain: string) => Effect.Effect<string[][], DnsError>;
    resolveNs: (domain: string) => Effect.Effect<string[], DnsError>;
    resolveMx: (domain: string) => Effect.Effect<
      {
        exchange: string;
        priority: number;
      }[],
      DnsError
    >;
    resolveSrv: (domain: string) => Effect.Effect<
      {
        priority: number;
        weight: number;
        port: number;
        name: string;
      }[],
      DnsError
    >;
  }
>()("DnsService") {}
