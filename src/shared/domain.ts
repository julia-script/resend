import { z } from "zod";

// Client-safe module: no imports from ./schema (it opens a DB connection and
// would drag postgres/fs into the browser bundle). schema.ts builds its
// pgEnums from these arrays, so this stays the single source of truth.
export const domainStatusValues = [
  "not_started",
  "in_progress",
  "verified",
  "failed",
  // "expired",
  // "canceled",
] as const;

export const domainStatusReasonValues = [
  "expired",
  "canceled",
  "superseded",
  "grace_period_expired",
  // "key_mismatch",
  // "record_not_found",
  // "domain_not_found",

  // "window_expired",
  // "revoked_after_grace",
] as const;

export const CheckLogEntrySchema = z.union([
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
});

export type PartialDomain = z.infer<typeof PartialDomainSchema>;

export type CheckLogEntry = z.input<typeof CheckLogEntrySchema>;

// The DKIM TXT record, written once for the resolver and every UI surface.
export const dkimRecordName = (d: { selector: string; name: string }) =>
  `${d.selector}._domainkey.${d.name}`;
export const dkimRecordValue = (d: { publicKey: string }) =>
  `v=DKIM1; k=rsa; p=${d.publicKey}`;
