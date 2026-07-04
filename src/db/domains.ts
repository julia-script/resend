import { eq } from "drizzle-orm";
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

export const getDomainByName = async (name: string): Promise<PartialDomain | null> => {
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

export const insertDomain = async ({ privateKey, ...params }: Pick<typeof domains.$inferInsert, "name" | "userId" | "selector" | "publicKey"> & { privateKey: string }): Promise<PartialDomain> => {
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