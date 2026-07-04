import dns from "node:dns/promises";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Dns from "./Dns";

const wrapDns = <A>(fn: () => Promise<A>) =>
  Effect.tryPromise({
    try: fn,
    catch: Dns.DnsError.fromError,
  });

export const layer = Layer.succeed(
  Dns.Dns,
  Dns.Dns.of({
    resolveTxt: (domain: string) => wrapDns(() => dns.resolveTxt(domain)),
    resolveNs: (domain: string) => wrapDns(() => dns.resolveNs(domain)),
    resolveMx: (domain: string) => wrapDns(() => dns.resolveMx(domain)),
    resolveSrv: (domain: string) => wrapDns(() => dns.resolveSrv(domain)),
  }),
);
