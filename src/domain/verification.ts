import "server-only";
import {
  type DomainUpdate,
  getVerifiedDomainsByName,
  updateDomain,
} from "@/db/domains";
import { env } from "@/lib/env";
import type { ApiError } from "@/lib/errors";
import type { CheckLogEntry, PartialDomain } from "@/shared/domain";
import type { RequiredBy } from "@/shared/types";
import type { CheckDkimResult } from "./dkim";
import * as Dkim from "./dkim";
import type { Notification } from "./notifications";

// ponytail: unbounded jsonb growth otherwise; raise if the log needs history.
const CHECK_LOG_MAX_ENTRIES = 100;

const addMs = (date: Date, ms: number) => new Date(date.getTime() + ms);
const isPast = (date: Date, now: Date) => date.getTime() < now.getTime();

const failureReason = (
  error: ApiError,
): Extract<CheckLogEntry, { status: "failed" }>["reason"] => {
  if (error.isTagged("dkim/key_mismatch")) return "key_mismatch";
  if (error.isTagged("dkim/record_not_found")) return "record_not_found";
  if (error.isTagged("dkim/domain_not_found")) return "domain_not_found";
  return "unexpected_error";
};

export type VerificationEvent =
  | "notifyVerificationSucceeded"
  | "notifyVerificationFailed"
  | "notifyGracePeriodExpired"
  | "notifyGracePeriodWarning"
  | "notifyGracePeriodStarted"
  | "notifyDomainSuperseded";
export type Transition = {
  update: RequiredBy<DomainUpdate, "checkLog">;
  events?: VerificationEvent[];
};

/** True when anything was logged for this domain more recently than throttleMs. */
export const isCheckThrottled = (
  domain: PartialDomain,
  now: Date,
  throttleMs: number,
): boolean => {
  const lastActivityAt = domain.checkLog?.at(-1)?.checkedAt ?? 0;
  return now.getTime() - lastActivityAt < throttleMs;
};

export type VerifyAction = "start" | "restart" | "rotate" | "check";

/**
 * What a manual verify request should do for a domain in its current state:
 * - `start`: begin the first verification (not_started)
 * - `restart`: verify again with the existing keys — the record may simply
 *   have arrived late or come back (failed: expired / grace_period_expired)
 * - `rotate`: generate new keys before restarting — the name was taken over
 *   by another account, so the old record must never validate again
 *   (failed: superseded)
 * - `check`: already active (in_progress / verified); just run a check now
 */
export const verifyAction = (domain: PartialDomain): VerifyAction => {
  if (domain.status === "not_started") return "start";
  if (domain.status === "failed") {
    if (domain.statusReason === "superseded") return "rotate";
    return "restart";
  }
  return "check";
};

/**
 * Pure state machine for one DKIM check outcome. Returns null when the
 * domain's status doesn't participate in checks (not_started, failed).
 */
export const transition = (
  domain: PartialDomain,
  check: CheckDkimResult,
  now: Date,
): Transition | null => {
  if (domain.status === "in_progress") {
    if (check.type === "success") {
      return {
        update: {
          status: "verified",
          statusReason: null,
          verifiedAt: now,
          nextCheckAt: addMs(now, env.successRecheckMs),
          deadlineAt: null,
          gracePeriodStartedAt: null,
          gracePeriodWarningSentAt: null,
          checkLog: [{ status: "ok", checkedAt: now.getTime() }],
        },
        events: ["notifyVerificationSucceeded"],
      };
    }
    // Verification window expired: stop polling, the user has to retry.
    if (domain.deadlineAt && isPast(domain.deadlineAt, now)) {
      return {
        update: {
          status: "failed",
          statusReason: "expired",
          nextCheckAt: null,
          deadlineAt: null,
          gracePeriodStartedAt: null,
          gracePeriodWarningSentAt: null,
          verifiedAt: null,
          checkLog: [{ status: "expired", checkedAt: now.getTime() }],
        },
        events: ["notifyVerificationFailed"],
      };
    }
    // Check failed but the window is still open: log and retry.
    return {
      update: {
        status: "in_progress",
        statusReason: null,
        nextCheckAt: addMs(now, env.pendingRecheckMs),
        deadlineAt: domain.deadlineAt,
        gracePeriodStartedAt: null,
        gracePeriodWarningSentAt: null,
        verifiedAt: null,
        checkLog: [
          {
            status: "failed",
            checkedAt: now.getTime(),
            reason: failureReason(check.error),
          },
        ],
      },
    };
  }

  if (domain.status === "verified") {
    if (check.type === "success") {
      return {
        update: {
          status: "verified",
          statusReason: null,
          nextCheckAt: addMs(now, env.successRecheckMs),
          gracePeriodStartedAt: null,
          gracePeriodWarningSentAt: null,
          deadlineAt: null,
          checkLog: [{ status: "ok", checkedAt: now.getTime() }],
        },
      };
    }

    const failedEntry: CheckLogEntry = {
      status: "failed",
      checkedAt: now.getTime(),
      reason: failureReason(check.error),
    };

    if (domain.gracePeriodStartedAt) {
      // Grace period ran out: revoke.
      if (isPast(addMs(domain.gracePeriodStartedAt, env.gracePeriodMs), now)) {
        return {
          update: {
            status: "failed",
            statusReason: "grace_period_expired",
            nextCheckAt: null,
            gracePeriodStartedAt: null,
            gracePeriodWarningSentAt: null,
            verifiedAt: null,
            deadlineAt: null,
            checkLog: [failedEntry],
          },
          events: ["notifyGracePeriodExpired"],
        };
      }

      // Still inside the grace period; warn once past the warning threshold.
      const warnAt = addMs(
        domain.gracePeriodStartedAt,
        env.gracePeriodWarningMs,
      );
      const shouldWarn =
        isPast(warnAt, now) && domain.gracePeriodWarningSentAt === null;
      return {
        update: {
          status: "verified",
          statusReason: null,
          nextCheckAt: addMs(now, env.pendingRecheckMs),
          gracePeriodStartedAt: domain.gracePeriodStartedAt,
          gracePeriodWarningSentAt: shouldWarn
            ? now
            : domain.gracePeriodWarningSentAt,
          verifiedAt: domain.verifiedAt,
          deadlineAt: null,
          checkLog: [failedEntry],
        },
        events: shouldWarn ? ["notifyGracePeriodWarning"] : [],
      };
    }

    // First failure after being verified: start the grace period.
    return {
      update: {
        status: "verified",
        statusReason: null,
        nextCheckAt: addMs(now, env.pendingRecheckMs),
        verifiedAt: domain.verifiedAt,
        gracePeriodStartedAt: now,
        gracePeriodWarningSentAt: null,
        deadlineAt: null,
        checkLog: [failedEntry],
      },
      events: ["notifyGracePeriodStarted"],
    };
  }

  // not_started / failed: checks don't apply.
  return null;
};

const appendLog = (existing: CheckLogEntry[] | null, added: CheckLogEntry[]) =>
  [...(existing ?? []), ...added].slice(-CHECK_LOG_MAX_ENTRIES);

/**
 * A domain just got verified: any other account's verified copy of the same
 * name loses it. Revokes them and returns the notifications to send.
 */
const supersedeOthers = async (
  domain: PartialDomain,
  now: Date,
): Promise<Notification[]> => {
  const others = await getVerifiedDomainsByName(domain.name, domain.id);
  await Promise.all(
    others.map((other) =>
      updateDomain(other.id, {
        status: "failed",
        statusReason: "superseded",
        verifiedAt: null,
        nextCheckAt: null,
        deadlineAt: null,
        gracePeriodStartedAt: null,
        gracePeriodWarningSentAt: null,
        checkLog: appendLog(other.checkLog, [
          { status: "revoked", reason: "superseded", checkedAt: now.getTime() },
        ]),
      }),
    ),
  );
  return others.map((other) => ({
    event: "notifyDomainSuperseded",
    domain: other,
  }));
};

/**
 * Runs one check and persists the transition. Sends nothing: the resulting
 * notifications are returned so callers can batch them across domains.
 */
export const verifyDomain = async (
  domain: PartialDomain,
  now: Date,
): Promise<{ domain: PartialDomain; notifications: Notification[] }> => {
  const check = await Dkim.checkDkim({
    selector: domain.selector,
    domain: domain.name,
    publicKey: domain.publicKey,
  });

  const result = transition(domain, check, now);
  if (!result) return { domain, notifications: [] };

  const updated = await updateDomain(domain.id, {
    ...result.update,
    checkLog: appendLog(domain.checkLog, result.update.checkLog),
  });

  const notifications: Notification[] = (result.events ?? []).map((event) => ({
    event,
    domain,
  }));
  // A fresh verification takes the name over from any previous owner.
  if (result.events?.includes("notifyVerificationSucceeded")) {
    notifications.push(...(await supersedeOthers(domain, now)));
  }
  return { domain: updated ?? domain, notifications };
};
