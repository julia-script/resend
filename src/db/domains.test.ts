import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import type { CheckLogEntry } from "@/shared/domain";
import { db } from "./client";
import {
  deleteDomain,
  getDomainById,
  insertDomain,
  updateDomain,
} from "./domains";
import { users } from "./schema";

// Integration tests against the local Postgres from docker-compose: the
// capped jsonb append lives in SQL, so only SQL can prove it. Skipped
// (visibly) when no DATABASE_URL is configured — env.ts only placeholders
// the URL for the parsed env object, never process.env.
const describeDb = describe.skipIf(!process.env.DATABASE_URL);

const userId = randomUUID();
const cleanup: string[] = [];

const makeDomain = async () => {
  const domain = await insertDomain({
    name: `append-test-${randomUUID()}.example`,
    userId,
    selector: "testsel",
    publicKey: "TESTKEY",
    privateKey: "TESTPRIVATE",
  });
  cleanup.push(domain.id);
  return domain;
};

describeDb("domains (live Postgres)", () => {
  beforeAll(async () => {
    await db.insert(users).values({ id: userId }).execute();
  });

  afterAll(async () => {
    await Promise.all(cleanup.map(deleteDomain));
    await db.delete(users).where(eq(users.id, userId));
  });

  test("sequential appends both land and the cap holds", async () => {
    const domain = await makeDomain();

    const first: CheckLogEntry[] = [{ status: "ok", checkedAt: 1 }];
    const second: CheckLogEntry[] = [
      { status: "failed", reason: "record_not_found", checkedAt: 2 },
    ];
    await updateDomain(domain.id, { appendCheckLog: first });
    const afterSecond = await updateDomain(domain.id, {
      appendCheckLog: second,
    });
    expect(afterSecond?.checkLog).toEqual([...first, ...second]);

    // 99 more entries → 101 total → oldest (checkedAt: 1) drops.
    const bulk: CheckLogEntry[] = Array.from({ length: 99 }, (_, i) => ({
      status: "ok",
      checkedAt: 100 + i,
    }));
    const capped = await updateDomain(domain.id, { appendCheckLog: bulk });
    expect(capped?.checkLog).toHaveLength(100);
    expect(capped?.checkLog?.[0]).toEqual({
      status: "failed",
      reason: "record_not_found",
      checkedAt: 2,
    });
    expect(capped?.checkLog?.at(-1)).toEqual({ status: "ok", checkedAt: 198 });
  });

  // /domains/<typo> must 404, not 500: a non-uuid id short-circuits to null
  // before Postgres gets to choke on the uuid cast.
  test("malformed domain id returns null instead of throwing", async () => {
    await expect(getDomainById("mocks")).resolves.toBeNull();
  });

  test("update without appendCheckLog leaves the log untouched", async () => {
    const domain = await makeDomain();
    await updateDomain(domain.id, {
      appendCheckLog: [{ status: "ok", checkedAt: 7 }],
    });
    const updated = await updateDomain(domain.id, { statusReason: null });
    expect(updated?.checkLog).toEqual([{ status: "ok", checkedAt: 7 }]);
  });

  test("stale guard matches zero rows, fresh guard writes", async () => {
    const domain = await makeDomain(); // status: not_started

    const stale = await updateDomain(
      domain.id,
      { status: "verified" },
      {
        guard: {
          status: "in_progress",
          gracePeriodStartedAt: null,
          gracePeriodWarningSentAt: null,
        },
      },
    );
    expect(stale).toBeNull();

    const fresh = await updateDomain(
      domain.id,
      { status: "in_progress" },
      {
        guard: {
          status: "not_started",
          gracePeriodStartedAt: null,
          gracePeriodWarningSentAt: null,
        },
      },
    );
    expect(fresh?.status).toBe("in_progress");
  });

  test("duplicate insert surfaces as db/domain_exists", async () => {
    const domain = await makeDomain();
    await expect(
      insertDomain({
        name: domain.name,
        userId,
        selector: "testsel2",
        publicKey: "TESTKEY2",
        privateKey: "TESTPRIVATE2",
      }),
    ).rejects.toMatchObject({ code: "db/domain_exists" });
  });
});
