import { Context, type Effect } from "effect";
import * as Schema from "effect/Schema";

export const DkimErrorCode = Schema.Union([
  // doesnt pass simple text validation
  Schema.Literal("record/invalidDomain"),

  // domain doesn't exist at all
  Schema.Literal("record/domainDoesntExist"),

  // domain exists, but record doesn't
  Schema.Literal("record/recordNotFound"),

  // record exists, but value is wrong
  Schema.Literal("record/wrongRecordValue"),

  Schema.Literal("record/unknownError"),
  Schema.Literal("failedToGenerateKeyPair"),
]);

export type DkimErrorCode = typeof DkimErrorCode.Type;
export class DkimError extends Schema.TaggedErrorClass<DkimError>()(
  "DkimError",
  {
    code: DkimErrorCode,
    cause: Schema.Unknown,
  },
) {
  static fromError(code: DkimErrorCode, error?: unknown) {
    return DkimError.make({ code, cause: error });
  }
}
export class Dkim extends Context.Service<
  Dkim,
  {
    resolveDkim: (
      selector: string,
      domain: string,
    ) => Effect.Effect<string[], DkimError>;
    generateDkimKeys: Effect.Effect<
      {
        selector: string;
        publicKey: string;
        privateKeyPem: string;
      },
      DkimError,
      never
    >;
  }
>()("Config") {}

export const recordName = (options: { selector: string; domain: string }) => {
  return `${options.selector}._domainkey.${options.domain}`;
};

export const recordValue = (options: { publicKey: string }) => {
  return `v=DKIM1; k=rsa; p=${options.publicKey}`;
};
