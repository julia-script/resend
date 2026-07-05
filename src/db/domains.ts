import "server-only";
import { and, asc, eq, inArray, lte, ne, sql } from "drizzle-orm";
import { encryptPrivateKey } from "@/domain/crypto";
import { env } from "@/lib/env";
import { ApiError } from "@/lib/errors";
import type { CheckLogEntry, PartialDomain } from "@/shared/domain";
import { db } from "./client";
import { domains } from "./schema";

const CHECK_LOG_MAX_ENTRIES = 100;

/**
 * Concat-and-cap in a single UPDATE expression so concurrent checks can't
 * lose each other's entries to a read-modify-write race.
 */
const appendCheckLogSql = (entries: CheckLogEntry[]) => {
  const appended = sql`${domains.checkLog} || ${JSON.stringify(entries)}::jsonb`;
  return sql`(
    SELECT coalesce(jsonb_agg(elem ORDER BY ord), '[]'::jsonb)
    FROM jsonb_array_elements(${appended}) WITH ORDINALITY AS t(elem, ord)
    WHERE ord > jsonb_array_length(${appended}) - ${CHECK_LOG_MAX_ENTRIES}
  )`;
};

const partialDomainTable = {
  id: domains.id,
  name: domains.name,
  userId: domains.userId,
  selector: domains.selector,
  publicKey: domains.publicKey,
  status: domains.status,
  statusReason: domains.statusReason,
  gracePeriodStartedAt: domains.gracePeriodStartedAt,
  gracePeriodWarningSentAt: domains.gracePeriodWarningSentAt,
  checkLog: domains.checkLog,
  nextCheckAt: domains.nextCheckAt,
  deadlineAt: domains.deadlineAt,
  verifiedAt: domains.verifiedAt,
  createdAt: domains.createdAt,
  updatedAt: domains.updatedAt,
  dnsMockRecord: domains.dnsMockRecord,
};

export const getDomainsByUserId = async (
  userId: string,
): Promise<PartialDomain[]> => {
  try {
    const result = await db
      .select(partialDomainTable)
      .from(domains)
      .where(eq(domains.userId, userId))
      .execute();
    return result;
  } catch (error) {
    throw new ApiError({
      code: "db/get_domains_by_user_id_failed",
      message: "Failed to get domains by user id",
      cause: error,
    });
  }
};

export const getDomainById = async (
  id: string,
): Promise<PartialDomain | null> => {
  try {
    const result = await db
      .select(partialDomainTable)
      .from(domains)
      .where(eq(domains.id, id))
      .execute();
    return result[0] || null;
  } catch (error) {
    throw new ApiError({
      code: "db/get_domain_by_id_failed",
      message: "Failed to get domain by id",
      cause: error,
    });
  }
};

/** The caller's own row for a name, if any (unique on userId + name). */
export const getDomainByNameAndUserId = async (
  name: string,
  userId: string,
): Promise<PartialDomain | null> => {
  try {
    const result = await db
      .select(partialDomainTable)
      .from(domains)
      .where(and(eq(domains.name, name), eq(domains.userId, userId)))
      .limit(1)
      .execute();
    return result[0] || null;
  } catch (error) {
    throw new ApiError({
      code: "db/get_domain_by_name_and_user_id_failed",
      message: "Failed to get domain by name and user id",
      cause: error,
    });
  }
};

/** Whether anyone has a verified copy of this name — O(1) existence check. */
export const hasVerifiedDomainByName = async (
  name: string,
): Promise<boolean> => {
  try {
    const result = await db
      .select({ id: domains.id })
      .from(domains)
      .where(and(eq(domains.name, name), eq(domains.status, "verified")))
      .limit(1)
      .execute();
    return result.length > 0;
  } catch (error) {
    throw new ApiError({
      code: "db/has_verified_domain_by_name_failed",
      message: "Failed to check for a verified domain by name",
      cause: error,
    });
  }
};

export const deleteDomain = async (id: string): Promise<boolean> => {
  try {
    const result = await db
      .delete(domains)
      .where(eq(domains.id, id))
      .returning({ id: domains.id })
      .execute();
    return result.length > 0;
  } catch (error) {
    throw new ApiError({
      code: "db/delete_domain_failed",
      message: "Failed to delete domain",
      cause: error,
    });
  }
};

/** Domains awaiting (re-)verification whose nextCheckAt has passed. */
export const getDomainsDueForCheck = async (
  limit = 50,
): Promise<PartialDomain[]> => {
  try {
    const result = await db
      .select(partialDomainTable)
      .from(domains)
      .where(
        and(
          // verified is swept too: that's how grace-period monitoring runs.
          inArray(domains.status, ["in_progress", "verified"]),
          lte(domains.nextCheckAt, new Date()),
        ),
      )
      .orderBy(asc(domains.nextCheckAt))
      .limit(limit)
      .execute();
    return result;
  } catch (error) {
    throw new ApiError({
      code: "db/get_domains_due_for_check_failed",
      message: "Failed to get domains due for check",
      cause: error,
    });
  }
};

/** Verified domains with the same name owned by anyone else (for supersede). */
export const getVerifiedDomainsByName = async (
  name: string,
  excludeId: string,
): Promise<PartialDomain[]> => {
  try {
    const result = await db
      .select(partialDomainTable)
      .from(domains)
      .where(
        and(
          eq(domains.name, name),
          eq(domains.status, "verified"),
          ne(domains.id, excludeId),
        ),
      )
      .execute();
    return result;
  } catch (error) {
    throw new ApiError({
      code: "db/get_verified_domains_by_name_failed",
      message: "Failed to get verified domains by name",
      cause: error,
    });
  }
};

export type DomainUpdate = Partial<
  Pick<
    typeof domains.$inferInsert,
    | "status"
    | "statusReason"
    | "nextCheckAt"
    | "deadlineAt"
    | "verifiedAt"
    | "gracePeriodStartedAt"
    | "gracePeriodWarningSentAt"
  >
> & { appendCheckLog?: CheckLogEntry[] };
export const updateDomain = async (
  id: string,
  { appendCheckLog, ...updates }: DomainUpdate,
): Promise<PartialDomain | null> => {
  try {
    const result = await db
      .update(domains)
      .set({
        ...updates,
        ...(appendCheckLog?.length
          ? { checkLog: appendCheckLogSql(appendCheckLog) }
          : {}),
      })
      .where(eq(domains.id, id))
      .returning(partialDomainTable)
      .execute();
    return result[0] || null;
  } catch (error) {
    throw new ApiError({
      code: "db/update_domain_failed",
      message: "Failed to update domain",
      cause: error,
    });
  }
};

/**
 * Replaces a domain's DKIM identity. Key fields are deliberately not part of
 * DomainUpdate: rotation is its own operation (used when re-claiming a
 * superseded domain) and must never happen as a side effect of a status write.
 */
export const rotateDomainKeys = async (
  id: string,
  keys: { selector: string; publicKey: string; privateKey: string },
): Promise<PartialDomain | null> => {
  const privateKeyEncrypted = await encryptPrivateKey(
    keys.privateKey,
    env.encryptionKey,
  );
  try {
    const result = await db
      .update(domains)
      .set({
        selector: keys.selector,
        publicKey: keys.publicKey,
        privateKeyEncrypted,
        // jsonb concat: logged atomically with the rotation itself.
        checkLog: appendCheckLogSql([
          { status: "rotated", checkedAt: Date.now() },
        ]),
      })
      .where(eq(domains.id, id))
      .returning(partialDomainTable)
      .execute();
    return result[0] || null;
  } catch (error) {
    throw new ApiError({
      code: "db/rotate_domain_keys_failed",
      message: "Failed to rotate domain keys",
      cause: error,
    });
  }
};

export const insertDomain = async ({
  privateKey,
  ...params
}: Pick<
  typeof domains.$inferInsert,
  "name" | "userId" | "selector" | "publicKey"
> & { privateKey: string }): Promise<PartialDomain> => {
  const privateKeyEncrypted = await encryptPrivateKey(
    privateKey,
    env.encryptionKey,
  );
  try {
    const result = await db
      .insert(domains)
      .values({
        ...params,
        privateKeyEncrypted,
        status: "not_started",
      })
      .returning(partialDomainTable)
      .execute();
    return result[0];
  } catch (error) {
    throw new ApiError({
      code: "db/insert_domain_failed",
      message: "Failed to create domain",
      cause: error,
    });
  }
};
