import "server-only";
import type { Context } from "hono";
import type { Session } from "next-auth";
import { getDomainById } from "@/db/domains";

/** The uniform 404 for unknown and foreign domain ids alike. */
export const domainNotFound = (c: Context) =>
  c.json({ code: "domains/not_found", message: "Domain not found" }, 404);

/**
 * Fetch a domain the session owns. Null for unknown AND foreign ids alike —
 * handlers 404 both, so domain ids can't be probed.
 */
export const getOwnedDomain = async (session: Session, id: string) => {
  const domain = await getDomainById(id);
  if (!domain || domain.userId !== session.user.id) return null;
  return domain;
};
