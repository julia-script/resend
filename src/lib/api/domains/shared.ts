import "server-only";
import type { Session } from "next-auth";
import { getDomainById } from "@/db/domains";

/**
 * Fetch a domain the session owns. Null for unknown AND foreign ids alike —
 * handlers 404 both, so domain ids can't be probed.
 */
export const getOwnedDomain = async (session: Session, id: string) => {
  const domain = await getDomainById(id);
  if (!domain || domain.userId !== session.user.id) return null;
  return domain;
};
