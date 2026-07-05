import { z } from "zod";
// import "dns/promises"

export const DnsMockResponseErrorSchema = z.union([
  z.literal("ENODATA"),
  z.literal("ENOTFOUND"),
  z.literal("EFORMERR"),
  z.literal("ESERVFAIL"),
  z.literal("ENOTIMP"),
  z.literal("EREFUSED"),
  z.literal("EBADQUERY"),
  z.literal("EBADNAME"),
  z.literal("EBADFAMILY"),
  z.literal("EBADRESP"),
  z.literal("ECONNREFUSED"),
  z.literal("ETIMEOUT"),
  z.literal("EOF"),
  z.literal("EFILE"),
  z.literal("ENOMEM"),
  z.literal("EDESTRUCTION"),
  z.literal("EBADSTR"),
  z.literal("EBADFLAGS"),
  z.literal("ENONAME"),
  z.literal("EBADHINTS"),
  z.literal("ENOTINITIALIZED"),
  z.literal("ELOADIPHLPAPI"),
  z.literal("EADDRGETNETWORKPARAMS"),
  z.literal("ECANCELLED"),
]);

export type DnsMockResponse = z.infer<typeof DnsMockResponseSchema>;

export const DnsMockResponseSchema = z.union([
  z.object({
    type: z.literal("success"),
    value: z.array(z.string()),
  }),
  z.object({
    type: z.literal("failure"),
    error: DnsMockResponseErrorSchema,
  }),
]);
// Client-safe module: no imports from ./schema (it opens a DB connection and
// would drag postgres/fs into the browser bundle). schema.ts builds its
// pgEnums from these arrays, so this stays the single source of truth.
export const domainStatusValues = [
  "not_started",
  "in_progress",
  "verified",
  "failed",
] as const;

export const domainStatusReasonValues = [
  "expired",
  "canceled",
  "superseded",
  "grace_period_expired",
] as const;

const CheckLogEntrySchema = z.union([
  z.object({
    status: z.literal("ok"),
    checkedAt: z.number(),
  }),
  z.object({
    status: z.literal("failed"),
    reason: z.union([
      z.literal("record_not_found"),
      z.literal("domain_not_found"),
      z.literal("key_mismatch"),
      z.literal("unexpected_error"),
    ]),
    checkedAt: z.number(),
  }),
  z.object({
    status: z.literal("expired"),
    checkedAt: z.number(),
  }),
  z.object({
    status: z.literal("rotated"),
    checkedAt: z.number(),
  }),
  z.object({
    status: z.literal("revoked"),
    reason: z.union([
      z.literal("superseded"),
      z.literal("grace_period_expired"),
      z.literal("user_canceled"),
    ]),
    checkedAt: z.number(),
  }),
]);

export const PartialDomainSchema = z.object({
  id: z.string(),
  name: z.string(),
  userId: z.string(),
  selector: z.string(),
  publicKey: z.string(),
  status: z.enum(domainStatusValues),
  statusReason: z.enum(domainStatusReasonValues).nullable(),
  gracePeriodStartedAt: z.coerce.date().nullable(),
  gracePeriodWarningSentAt: z.coerce.date().nullable(),

  checkLog: z.array(CheckLogEntrySchema),
  nextCheckAt: z.coerce.date().nullable(),
  deadlineAt: z.coerce.date().nullable(),
  verifiedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  dnsMockRecord: DnsMockResponseSchema.nullable(),
});

export type PartialDomain = z.infer<typeof PartialDomainSchema>;

export type CheckLogEntry = z.input<typeof CheckLogEntrySchema>;

// A domain is mock-resolvable when "mock" appears as its own label/word.
// Single source of truth for the resolver and the mocks page.
export const isMockDomainName = (name: string) => /\bmock\b/.test(name);

// The DKIM TXT record, written once for the resolver and every UI surface.
export const dkimRecordName = (d: { selector: string; name: string }) =>
  `${d.selector}._domainkey.${d.name}`;
export const dkimRecordValue = (d: { publicKey: string }) =>
  `v=DKIM1; k=rsa; p=${d.publicKey}`;
