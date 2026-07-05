"use server";

import { eq, like } from "drizzle-orm";
import { db } from "@/db/client";
import { domains } from "@/db/schema";
import { auth } from "@/lib/auth/handlers";
import { env } from "@/lib/env";
import {
  type DnsMockResponse,
  DnsMockResponseSchema,
  isMockDomainName,
} from "@/shared/domain";

// Signed-in + mock-mode gate only. Deliberately NOT scoped to the caller's
// own rows: the mocks page is a shared test console over every mock domain.
const requireMockAccess = async () => {
  if (!env.enableMock) throw new Error("Mocks are disabled");
  if (!(await auth())) throw new Error("Unauthorized");
};

export const getMockDomains = async () => {
  await requireMockAccess();
  const rows = await db
    .select({
      id: domains.id,
      name: domains.name,
      status: domains.status,
      statusReason: domains.statusReason,
      selector: domains.selector,
      publicKey: domains.publicKey,
      checkLog: domains.checkLog,
      nextCheckAt: domains.nextCheckAt,
      deadlineAt: domains.deadlineAt,
      verifiedAt: domains.verifiedAt,
      gracePeriodStartedAt: domains.gracePeriodStartedAt,
      gracePeriodWarningSentAt: domains.gracePeriodWarningSentAt,
      dnsMockRecord: domains.dnsMockRecord,
    })
    .from(domains)
    .where(like(domains.name, "%mock%"));
  // SQL prefilter, JS decides: same word-boundary rule the resolver uses.
  return rows.filter((row) => isMockDomainName(row.name));
};

export type MockDomain = Awaited<ReturnType<typeof getMockDomains>>[number];

/** Sets the canned DNS answer and queues an immediate recheck. */
export const updateMockDomain = async (
  domainId: string,
  record: DnsMockResponse,
): Promise<boolean> => {
  await requireMockAccess();
  const result = await db
    .update(domains)
    .set({
      dnsMockRecord: DnsMockResponseSchema.parse(record),
      nextCheckAt: new Date(),
    })
    .where(eq(domains.id, domainId))
    .returning({ id: domains.id });
  return result.length > 0;
};
