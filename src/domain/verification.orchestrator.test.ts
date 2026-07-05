import { beforeEach, expect, test, vi } from "vitest";
import type { PartialDomain } from "@/db/validationschemas";

vi.mock("@/db/domains", () => ({
  updateDomain: vi.fn(async (id: string, updates: object) => ({
    id,
    ...updates,
  })),
}));
vi.mock("./dkim", () => ({
  checkDkim: vi.fn(),
}));

import { updateDomain } from "@/db/domains";
import { checkDkim } from "./dkim";
import { verifyDomain } from "./verification";

const NOW = new Date("2026-07-05T12:00:00Z");

const domain: PartialDomain = {
  id: "d1",
  name: "example.com",
  userId: "u1",
  selector: "abc123",
  publicKey: "PUBKEY",
  status: "in_progress",
  statusReason: null,
  gracePeriodStartedAt: null,
  gracePeriodWarningSentAt: null,
  checkLog: [],
  nextCheckAt: NOW,
  deadlineAt: null,
  verifiedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
};

beforeEach(() => {
  vi.clearAllMocks();
});

test("null transition (failed domain) → no DB write, returns domain as-is", async () => {
  vi.mocked(checkDkim).mockResolvedValue({ type: "success", value: "rec" });
  const result = await verifyDomain({ ...domain, status: "failed" }, NOW);
  expect(updateDomain).not.toHaveBeenCalled();
  expect(result).toMatchObject({ id: "d1", status: "failed" });
});

test("appends the new entry to the existing checkLog", async () => {
  vi.mocked(checkDkim).mockResolvedValue({ type: "success", value: "rec" });
  const existing = [{ status: "ok", checkedAt: 1 } as const];
  await verifyDomain({ ...domain, checkLog: existing }, NOW);
  const written = vi.mocked(updateDomain).mock.calls[0][1];
  expect(written.checkLog).toEqual([
    { status: "ok", checkedAt: 1 },
    { status: "ok", checkedAt: NOW.getTime() },
  ]);
});

test("caps checkLog at 100 entries, dropping the oldest", async () => {
  vi.mocked(checkDkim).mockResolvedValue({ type: "success", value: "rec" });
  const existing = Array.from({ length: 100 }, (_, i) => ({
    status: "ok" as const,
    checkedAt: i,
  }));
  await verifyDomain({ ...domain, checkLog: existing }, NOW);
  const written = vi.mocked(updateDomain).mock.calls[0][1];
  expect(written.checkLog).toHaveLength(100);
  expect(written.checkLog?.[0]).toEqual({ status: "ok", checkedAt: 1 });
  expect(written.checkLog?.at(-1)).toEqual({
    status: "ok",
    checkedAt: NOW.getTime(),
  });
});

test("passes the domain's own selector/name/key to the DKIM check", async () => {
  vi.mocked(checkDkim).mockResolvedValue({ type: "success", value: "rec" });
  await verifyDomain(domain, NOW);
  expect(checkDkim).toHaveBeenCalledWith({
    selector: "abc123",
    domain: "example.com",
    publicKey: "PUBKEY",
  });
});
