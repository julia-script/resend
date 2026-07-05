import "server-only";
import { inArray } from "drizzle-orm";
import { ApiError } from "@/lib/errors";
import { db } from "./client";
import { users } from "./schema";

export const getUserEmails = async (
  userIds: string[],
): Promise<Map<string, string>> => {
  if (userIds.length === 0) return new Map();
  try {
    const result = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(inArray(users.id, userIds))
      .execute();
    return new Map(
      result.flatMap((row) => (row.email ? [[row.id, row.email] as const] : [])),
    );
  } catch (error) {
    throw new ApiError({
      code: "db/get_user_emails_failed",
      message: "Failed to get user emails",
      cause: error,
    });
  }
};
