import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, expect, test } from "vitest";
import type { CheckLogEntry } from "@/shared/domain";
import { db } from "./client";
import { deleteDomain, insertDomain, updateDomain } from "./domains";
import { users } from "./schema";

// Integration tests against the local Postgres from docker-compose: the
// capped jsonb append lives in SQL, so only SQL can prove it.

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

test("update without appendCheckLog leaves the log untouched", async () => {
  const domain = await makeDomain();
  await updateDomain(domain.id, {
    appendCheckLog: [{ status: "ok", checkedAt: 7 }],
  });
  const updated = await updateDomain(domain.id, { statusReason: null });
  expect(updated?.checkLog).toEqual([{ status: "ok", checkedAt: 7 }]);
});
