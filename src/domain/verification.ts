import {
  type DomainUpdate,
  getVerifiedDomainsByName,
  updateDomain,
} from "@/db/domains";
import type { CheckLogEntry, PartialDomain } from "@/db/validationschemas";
import type { ApiError } from "@/lib/api/helpers";
import * as Dkim from "./dkim";
import type { CheckDkimResult } from "./dkim";
import type { Notification } from "./notifications";

const DAY_IN_MS = 1000 * 60 * 60 * 24;
const MINUTE_IN_MS = 1000 * 60;

export const PENDING_RECHECK_INTERVAL = MINUTE_IN_MS;
export const SUCCESS_RECHECK_INTERVAL = DAY_IN_MS;
export const GRACE_PERIOD = DAY_IN_MS;
export const GRACE_PERIOD_WARNING = MINUTE_IN_MS * 60;
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

type RequiredBy<T, K extends keyof T> = Required<Pick<T, K>> & Omit<T, K>;
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
          nextCheckAt: addMs(now, SUCCESS_RECHECK_INTERVAL),
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
        nextCheckAt: addMs(now, PENDING_RECHECK_INTERVAL),
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
          nextCheckAt: addMs(now, SUCCESS_RECHECK_INTERVAL),
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
      if (isPast(addMs(domain.gracePeriodStartedAt, GRACE_PERIOD), now)) {
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
      const warnAt = addMs(domain.gracePeriodStartedAt, GRACE_PERIOD_WARNING);
      const shouldWarn =
        isPast(warnAt, now) && domain.gracePeriodWarningSentAt === null;
      return {
        update: {
          status: "verified",
          statusReason: null,
          nextCheckAt: addMs(now, PENDING_RECHECK_INTERVAL),
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
        nextCheckAt: addMs(now, PENDING_RECHECK_INTERVAL),
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
