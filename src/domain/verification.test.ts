import { describe, expect, test } from "vitest";
import { env } from "@/lib/env";
import { ApiError } from "@/lib/errors";
import type { PartialDomain } from "@/shared/domain";
import type { CheckDkimResult } from "./dkim";
import { isCheckThrottled, transition, verifyAction } from "./verification";

const {
  gracePeriodMs: GRACE_PERIOD,
  gracePeriodWarningMs: GRACE_PERIOD_WARNING,
  pendingRecheckMs: PENDING_RECHECK_INTERVAL,
  successRecheckMs: SUCCESS_RECHECK_INTERVAL,
} = env;

const NOW = new Date("2026-07-05T12:00:00Z");
const minutes = (n: number) => n * 60 * 1000;

const makeDomain = (overrides: Partial<PartialDomain> = {}): PartialDomain => ({
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
  deadlineAt: new Date(NOW.getTime() + minutes(60)),
  verifiedAt: null,
  createdAt: new Date(NOW.getTime() - minutes(120)),
  updatedAt: new Date(NOW.getTime() - minutes(1)),
  dnsMockRecord: null,
  ...overrides,
});

const ok: CheckDkimResult = { type: "success", value: "v=DKIM1; p=PUBKEY" };
const fail = (code = "dkim/record_not_found"): CheckDkimResult => ({
  type: "failure",
  error: new ApiError({ code, message: code }),
});

describe("in_progress", () => {
  test("success → verified, schedules daily recheck, notifies", () => {
    const t = transition(makeDomain(), ok, NOW);
    expect(t?.update).toMatchObject({
      status: "verified",
      statusReason: null,
      verifiedAt: NOW,
      deadlineAt: null,
      nextCheckAt: new Date(NOW.getTime() + SUCCESS_RECHECK_INTERVAL),
      appendCheckLog: [{ status: "ok", checkedAt: NOW.getTime() }],
    });
    expect(t?.events).toEqual(["notifyVerificationSucceeded"]);
  });

  test("failure before deadline → stays in_progress, retries in a minute", () => {
    const t = transition(makeDomain(), fail(), NOW);
    expect(t?.update).toMatchObject({
      status: "in_progress",
      nextCheckAt: new Date(NOW.getTime() + PENDING_RECHECK_INTERVAL),
      appendCheckLog: [
        {
          status: "failed",
          reason: "record_not_found",
          checkedAt: NOW.getTime(),
        },
      ],
    });
    expect(t?.events).toBeUndefined();
  });

  test("failure keeps the existing deadline", () => {
    const deadlineAt = new Date(NOW.getTime() + minutes(30));
    const t = transition(makeDomain({ deadlineAt }), fail(), NOW);
    expect(t?.update.deadlineAt).toEqual(deadlineAt);
  });

  test("failure past deadline → failed/expired, polling stops", () => {
    const t = transition(
      makeDomain({ deadlineAt: new Date(NOW.getTime() - minutes(1)) }),
      fail(),
      NOW,
    );
    expect(t?.update).toMatchObject({
      status: "failed",
      statusReason: "expired",
      nextCheckAt: null,
      appendCheckLog: [{ status: "expired", checkedAt: NOW.getTime() }],
    });
    expect(t?.events).toEqual(["notifyVerificationFailed"]);
  });

  test("failure with no deadline → keeps retrying", () => {
    const t = transition(makeDomain({ deadlineAt: null }), fail(), NOW);
    expect(t?.update.status).toBe("in_progress");
  });

  test("maps dkim error codes to log reasons", () => {
    const reason = (code: string) => {
      const t = transition(makeDomain(), fail(code), NOW);
      const entry = t?.update.appendCheckLog[0];
      return entry?.status === "failed" ? entry.reason : undefined;
    };
    expect(reason("dkim/key_mismatch")).toBe("key_mismatch");
    expect(reason("dkim/record_not_found")).toBe("record_not_found");
    expect(reason("dkim/domain_not_found")).toBe("domain_not_found");
    expect(reason("dns/SERVFAIL")).toBe("unexpected_error");
  });
});

describe("verified", () => {
  const verified = (overrides: Partial<PartialDomain> = {}) =>
    makeDomain({
      status: "verified",
      verifiedAt: new Date(NOW.getTime() - minutes(600)),
      deadlineAt: null,
      ...overrides,
    });

  test("success → stays verified, clears grace period state", () => {
    const t = transition(
      verified({
        gracePeriodStartedAt: new Date(NOW.getTime() - minutes(10)),
        gracePeriodWarningSentAt: new Date(NOW.getTime() - minutes(5)),
      }),
      ok,
      NOW,
    );
    expect(t?.update).toMatchObject({
      status: "verified",
      gracePeriodStartedAt: null,
      gracePeriodWarningSentAt: null,
      nextCheckAt: new Date(NOW.getTime() + SUCCESS_RECHECK_INTERVAL),
    });
    expect(t?.events).toBeUndefined();
  });

  test("first failure → starts grace period, stays verified, notifies", () => {
    const t = transition(verified(), fail(), NOW);
    expect(t?.update).toMatchObject({
      status: "verified",
      gracePeriodStartedAt: NOW,
      gracePeriodWarningSentAt: null,
      nextCheckAt: new Date(NOW.getTime() + PENDING_RECHECK_INTERVAL),
    });
    expect(t?.events).toEqual(["notifyGracePeriodStarted"]);
  });

  test("failure inside grace period before warning threshold → no event, start unchanged", () => {
    const start = new Date(NOW.getTime() - minutes(5));
    const t = transition(
      verified({ gracePeriodStartedAt: start }),
      fail(),
      NOW,
    );
    expect(t?.update).toMatchObject({
      status: "verified",
      gracePeriodStartedAt: start,
      gracePeriodWarningSentAt: null,
    });
    expect(t?.events).toEqual([]);
  });

  test("failure past warning threshold → warns once and records it", () => {
    const start = new Date(NOW.getTime() - GRACE_PERIOD_WARNING - minutes(1));
    const t = transition(
      verified({ gracePeriodStartedAt: start }),
      fail(),
      NOW,
    );
    expect(t?.update).toMatchObject({
      gracePeriodStartedAt: start, // must NOT reset, or the grace period never ends
      gracePeriodWarningSentAt: NOW,
    });
    expect(t?.events).toEqual(["notifyGracePeriodWarning"]);
  });

  test("failure past warning threshold with warning already sent → no repeat", () => {
    const start = new Date(NOW.getTime() - GRACE_PERIOD_WARNING - minutes(1));
    const sentAt = new Date(NOW.getTime() - minutes(1));
    const t = transition(
      verified({
        gracePeriodStartedAt: start,
        gracePeriodWarningSentAt: sentAt,
      }),
      fail(),
      NOW,
    );
    expect(t?.update.gracePeriodWarningSentAt).toEqual(sentAt);
    expect(t?.events).toEqual([]);
  });

  test("failure past grace period → failed/grace_period_expired, notifies", () => {
    const start = new Date(NOW.getTime() - GRACE_PERIOD - minutes(1));
    const t = transition(
      verified({ gracePeriodStartedAt: start }),
      fail(),
      NOW,
    );
    expect(t?.update).toMatchObject({
      status: "failed",
      statusReason: "grace_period_expired",
      nextCheckAt: null,
      verifiedAt: null,
      gracePeriodStartedAt: null,
      gracePeriodWarningSentAt: null,
    });
    expect(t?.events).toEqual(["notifyGracePeriodExpired"]);
  });
});

describe("verifyAction", () => {
  test("not_started → start", () => {
    expect(verifyAction(makeDomain({ status: "not_started" }))).toBe("start");
  });

  test("in_progress and verified → check (incl. during grace period)", () => {
    expect(verifyAction(makeDomain({ status: "in_progress" }))).toBe("check");
    expect(verifyAction(makeDomain({ status: "verified" }))).toBe("check");
    expect(
      verifyAction(
        makeDomain({ status: "verified", gracePeriodStartedAt: NOW }),
      ),
    ).toBe("check");
  });

  test("failed with recoverable reasons → restart with existing keys", () => {
    for (const statusReason of [
      "expired",
      "grace_period_expired",
      "canceled",
    ] as const) {
      expect(verifyAction(makeDomain({ status: "failed", statusReason }))).toBe(
        "restart",
      );
    }
  });

  test("failed/superseded → rotate keys first", () => {
    expect(
      verifyAction(
        makeDomain({ status: "failed", statusReason: "superseded" }),
      ),
    ).toBe("rotate");
  });
});

describe("isCheckThrottled", () => {
  const THROTTLE = 30_000;

  test("empty log → not throttled", () => {
    expect(isCheckThrottled(makeDomain({ checkLog: [] }), NOW, THROTTLE)).toBe(
      false,
    );
  });

  test("fresh entry (any kind) → throttled", () => {
    const log = [
      { status: "rotated", checkedAt: NOW.getTime() - 5_000 } as const,
    ];
    expect(isCheckThrottled(makeDomain({ checkLog: log }), NOW, THROTTLE)).toBe(
      true,
    );
  });

  test("stale entry → not throttled", () => {
    const log = [
      { status: "ok", checkedAt: NOW.getTime() - THROTTLE - 1 } as const,
    ];
    expect(isCheckThrottled(makeDomain({ checkLog: log }), NOW, THROTTLE)).toBe(
      false,
    );
  });
});

describe("terminal statuses", () => {
  test("not_started and failed don't transition", () => {
    expect(
      transition(makeDomain({ status: "not_started" }), ok, NOW),
    ).toBeNull();
    expect(
      transition(makeDomain({ status: "failed" }), fail(), NOW),
    ).toBeNull();
  });
});

describe("boundary semantics (isPast is strict <)", () => {
  test("success after the deadline still verifies — success is checked first", () => {
    const t = transition(
      makeDomain({ deadlineAt: new Date(NOW.getTime() - minutes(60)) }),
      ok,
      NOW,
    );
    expect(t?.update.status).toBe("verified");
  });

  test("failure at exactly the deadline instant → still in_progress", () => {
    const t = transition(makeDomain({ deadlineAt: NOW }), fail(), NOW);
    expect(t?.update.status).toBe("in_progress");
  });

  test("failure at exactly grace-period end → still in grace, not revoked", () => {
    const start = new Date(NOW.getTime() - GRACE_PERIOD);
    const t = transition(
      makeDomain({
        status: "verified",
        verifiedAt: new Date(NOW.getTime() - minutes(600)),
        deadlineAt: null,
        gracePeriodStartedAt: start,
      }),
      fail(),
      NOW,
    );
    expect(t?.update.status).toBe("verified");
  });

  test("failure at exactly the warning threshold → no warning yet", () => {
    const start = new Date(NOW.getTime() - GRACE_PERIOD_WARNING);
    const t = transition(
      makeDomain({
        status: "verified",
        verifiedAt: new Date(NOW.getTime() - minutes(600)),
        deadlineAt: null,
        gracePeriodStartedAt: start,
      }),
      fail(),
      NOW,
    );
    expect(t?.update.gracePeriodWarningSentAt).toBeNull();
    expect(t?.events).toEqual([]);
  });

  test("grace-period branches preserve the original verifiedAt", () => {
    const verifiedAt = new Date(NOW.getTime() - minutes(600));
    const started = transition(
      makeDomain({ status: "verified", verifiedAt, deadlineAt: null }),
      fail(),
      NOW,
    );
    expect(started?.update.verifiedAt).toEqual(verifiedAt);

    const inGrace = transition(
      makeDomain({
        status: "verified",
        verifiedAt,
        deadlineAt: null,
        gracePeriodStartedAt: new Date(NOW.getTime() - minutes(5)),
      }),
      fail(),
      NOW,
    );
    expect(inGrace?.update.verifiedAt).toEqual(verifiedAt);
  });
});
