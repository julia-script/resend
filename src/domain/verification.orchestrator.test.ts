import { beforeEach, expect, test, vi } from "vitest";
import type { PartialDomain } from "@/shared/domain";

vi.mock("@/db/domains", () => ({
  updateDomain: vi.fn(async (id: string, updates: object) => ({
    id,
    ...updates,
  })),
  getVerifiedDomainsByName: vi.fn(async () => []),
}));
vi.mock("./dkim", () => ({
  checkDkim: vi.fn(),
}));

import { getVerifiedDomainsByName, updateDomain } from "@/db/domains";
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

test("null transition (failed domain) → no DB write, no notifications", async () => {
  vi.mocked(checkDkim).mockResolvedValue({ type: "success", value: "rec" });
  const result = await verifyDomain({ ...domain, status: "failed" }, NOW);
  expect(updateDomain).not.toHaveBeenCalled();
  expect(result.domain).toMatchObject({ id: "d1", status: "failed" });
  expect(result.notifications).toEqual([]);
});

test("passes only the new entry as an append — concat happens in SQL", async () => {
  vi.mocked(checkDkim).mockResolvedValue({ type: "success", value: "rec" });
  const existing = [{ status: "ok", checkedAt: 1 } as const];
  await verifyDomain({ ...domain, checkLog: existing }, NOW);
  const written = vi.mocked(updateDomain).mock.calls[0][1];
  expect(written.appendCheckLog).toEqual([
    { status: "ok", checkedAt: NOW.getTime() },
  ]);
  expect(written).not.toHaveProperty("checkLog");
});

test("no row persisted (deleted mid-check) → no notifications, no supersede sweep", async () => {
  vi.mocked(checkDkim).mockResolvedValue({ type: "success", value: "rec" });
  vi.mocked(updateDomain).mockResolvedValueOnce(null);
  const result = await verifyDomain(domain, NOW);
  expect(result.notifications).toEqual([]);
  expect(getVerifiedDomainsByName).not.toHaveBeenCalled();
  expect(result.domain).toMatchObject({ id: "d1" });
});

test("revoke affecting no row → no superseded notification for that owner", async () => {
  vi.mocked(checkDkim).mockResolvedValue({ type: "success", value: "rec" });
  const previousOwner = {
    ...domain,
    id: "d2",
    userId: "u2",
    status: "verified" as const,
  };
  vi.mocked(getVerifiedDomainsByName).mockResolvedValueOnce([previousOwner]);
  // Main domain persists; the revoke of d2 hits no row.
  vi.mocked(updateDomain)
    .mockResolvedValueOnce({ ...domain, status: "verified" })
    .mockResolvedValueOnce(null);
  const result = await verifyDomain(domain, NOW);
  expect(result.notifications).toEqual([
    { event: "notifyVerificationSucceeded", domain },
  ]);
});

test("returns the transition's events as notifications", async () => {
  vi.mocked(checkDkim).mockResolvedValue({ type: "success", value: "rec" });
  const result = await verifyDomain(domain, NOW);
  expect(result.notifications).toEqual([
    { event: "notifyVerificationSucceeded", domain },
  ]);
});

test("fresh verification revokes another owner's verified copy and queues their notification", async () => {
  vi.mocked(checkDkim).mockResolvedValue({ type: "success", value: "rec" });
  const previousOwner = {
    ...domain,
    id: "d2",
    userId: "u2",
    status: "verified" as const,
    checkLog: [],
  };
  vi.mocked(getVerifiedDomainsByName).mockResolvedValueOnce([previousOwner]);

  const result = await verifyDomain(domain, NOW);

  expect(getVerifiedDomainsByName).toHaveBeenCalledWith("example.com", "d1");
  expect(updateDomain).toHaveBeenCalledWith("d2", {
    status: "failed",
    statusReason: "superseded",
    verifiedAt: null,
    nextCheckAt: null,
    deadlineAt: null,
    gracePeriodStartedAt: null,
    gracePeriodWarningSentAt: null,
    appendCheckLog: [
      { status: "revoked", reason: "superseded", checkedAt: NOW.getTime() },
    ],
  });
  expect(result.notifications).toContainEqual({
    event: "notifyDomainSuperseded",
    domain: previousOwner,
  });
});

test("verified→verified recheck does not run the supersede sweep", async () => {
  vi.mocked(checkDkim).mockResolvedValue({ type: "success", value: "rec" });
  const result = await verifyDomain(
    { ...domain, status: "verified", verifiedAt: NOW },
    NOW,
  );
  expect(getVerifiedDomainsByName).not.toHaveBeenCalled();
  expect(result.notifications).toEqual([]);
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
