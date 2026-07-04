import { z } from "zod";

// Client-safe module: no imports from ./schema (it opens a DB connection and
// would drag postgres/fs into the browser bundle). schema.ts builds its
// pgEnums from these arrays, so this stays the single source of truth.
export const domainStatusValues = [
  "not_started",
  "pending",
  "verified",
  "failed",
  "temporary_failure",
] as const;

export const domainStatusReasonValues = [
  "window_expired",
  "revoked_after_grace",
] as const;

export const PartialDomainSchema = z.object({
  id: z.string(),
  name: z.string(),
  userId: z.string(),
  selector: z.string(),
  publicKey: z.string(),
  status: z.enum(domainStatusValues),
  statusReason: z.enum(domainStatusReasonValues).nullable(),

  // coerce: over JSON these arrive as ISO strings; on the server they're Dates.
  nextCheckAt: z.coerce.date().nullable(),
  deadlineAt: z.coerce.date().nullable(),
  verifiedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type PartialDomain = z.infer<typeof PartialDomainSchema>;
