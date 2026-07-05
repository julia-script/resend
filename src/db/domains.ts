import { and, asc, eq, inArray, lte, ne } from "drizzle-orm";
import { encryptPrivateKey } from "@/domain/crypto";
import { env } from "@/lib/env";
import { db, domains, domainStatus, domainStatusReason } from "./schema";
import { z } from "zod";
import { PgEnum } from "drizzle-orm/pg-core";
import { ApiError } from "@/lib/api/helpers";
import { PartialDomain } from "./validationschemas";
// import { z } from "zod";
// class CreateDomainError extends Schema.TaggedErrorClass<CreateDomainError>()(
//   "CreateDomainError",
//   {
//     message: Schema.String,
//   },
// ) {}

// type DomainInsert = Pick<
//   typeof domains.$inferInsert,
//   "name" | "userId" | "publicKey"
// > & { privateKey: string };

export const partialDomainTable = {
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
};

// type PartialDomain = Simplify<z.infer<typeof PartialDomainSchema>>;
export const getDomainsByUserId = async (
  userId: string,
): Promise<PartialDomain[]> => {
  try {
    const result = await db
      .select(partialDomainTable)
      .from(domains)
      .where(eq(domains.userId, userId))
      .execute();
    return result || [];
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

export const getDomainByName = async (
  name: string,
): Promise<PartialDomain | null> => {
  try {
    const result = await db
      .select(partialDomainTable)
      .from(domains)
      .where(eq(domains.name, name))
      .execute();
    return result[0] || null;
  } catch (error) {
    throw new ApiError({
      code: "db/get_domain_by_name_failed",
      message: "Failed to get domain by name",
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
    return result || [];
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
    return result || [];
  } catch (error) {
    throw new ApiError({
      code: "db/get_verified_domains_by_name_failed",
      message: "Failed to get verified domains by name",
      cause: error,
    });
  }
};

export const getDomainsByStatus = async (
  statuses: PartialDomain["status"][],
): Promise<PartialDomain[]> => {
  try {
    const result = await db
      .select(partialDomainTable)
      .from(domains)
      .where(inArray(domains.status, statuses))
      .execute();
    return result || [];
  } catch (error) {
    throw new ApiError({
      code: "db/get_domains_by_status_failed",
      message: "Failed to get domains by status",
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
    | "checkLog"
  >
>;
export const updateDomain = async (
  id: string,
  updates: DomainUpdate,
): Promise<PartialDomain | null> => {
  try {
    const result = await db
      .update(domains)
      .set(updates)
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
