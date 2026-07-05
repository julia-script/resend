import "server-only";
import { chunk, compact, uniq } from "lodash-es";
import { Resend } from "resend";
import type { PartialDomain } from "@/shared/domain";
import { getUserEmails } from "@/db/users";
import { env } from "@/lib/env";
import type { VerificationEvent } from "./verification";

const resend = new Resend(env.authResendKey);
const FROM = env.notificationsFrom;
const BATCH_LIMIT = 100; // Resend batch API maximum

export type Notification = {
  event: VerificationEvent;
  domain: PartialDomain;
};

type Template = (domain: PartialDomain) => { subject: string; text: string };

// notifyGracePeriodStarted is intentionally absent: a single bad ping isn't
// worth an email — the user only hears about it at the warning threshold.
const templates: Partial<Record<VerificationEvent, Template>> = {
  notifyVerificationSucceeded: (d) => ({
    subject: `${d.name} is verified`,
    text: `Your domain ${d.name} passed DKIM verification and is ready to send email.`,
  }),
  notifyVerificationFailed: (d) => ({
    subject: `Verification for ${d.name} expired`,
    text: `We couldn't find the DKIM record for ${d.name} within the verification window, so verification was stopped.\n\nCheck that the TXT record is in place, then restart verification from your dashboard.`,
  }),
  notifyGracePeriodWarning: (d) => ({
    subject: `Action needed: DKIM record for ${d.name} is failing`,
    text: `The DKIM record for your verified domain ${d.name} has stopped resolving. If it isn't restored before the grace period ends, the domain will be unverified and sending will stop.\n\nPlease check your DNS settings.`,
  }),
  notifyDomainSuperseded: (d) => ({
    subject: `${d.name} was verified by another account`,
    text: `Another account has verified ownership of ${d.name}, so your verification has been revoked and sending from it was stopped.\n\nIf this is unexpected, re-add your DKIM record and verify the domain again from your dashboard.`,
  }),
  notifyGracePeriodExpired: (d) => ({
    subject: `${d.name} is no longer verified`,
    text: `The DKIM record for ${d.name} stayed unresolvable through the whole grace period, so the domain has been unverified and can no longer send email.\n\nYou can re-add the record and verify again from your dashboard.`,
  }),
};

/** Send all notifications from a check run in as few API calls as possible. */
export const dispatchNotifications = async (
  notifications: Notification[],
): Promise<void> => {
  const withTemplate = compact(
    notifications.map(({ event, domain }) => {
      const template = templates[event];
      return template && { domain, ...template(domain) };
    }),
  );
  if (withTemplate.length === 0) return;

  const emails = await getUserEmails(
    uniq(withTemplate.map(({ domain }) => domain.userId)),
  );
  const payloads = compact(
    withTemplate.map(({ domain, subject, text }) => {
      const to = emails.get(domain.userId);
      return to && { from: FROM, to: [to], subject, text };
    }),
  );

  for (const batch of chunk(payloads, BATCH_LIMIT)) {
    const { error } = await resend.batch.send(batch);
    // Email failures must not fail the check run; the state is already saved.
    if (error) {
      console.error("notification batch send failed", error);
    }
  }
};
