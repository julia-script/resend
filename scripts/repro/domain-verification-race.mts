/**
 * Reproduction: two accounts verifying the SAME domain name in a single cron
 * sweep can both flip to `verified` and then mutually revoke each other,
 * because the "only one account may hold a name verified" rule is enforced by
 * a read-then-write (`supersedeOthers`) with no database-level guarantee.
 *
 * It drives the REAL exposed entry point — the `/api/cron/verify` route handler
 * (`cronVerifyHandler`) — mounted on a bare Hono router. The handler, the DKIM
 * check, `verifyDomain`, `supersedeOthers` and every DB write are the shipped,
 * unmodified code. The only things faked are:
 *   - the DNS answer, supplied through the app's own `dnsMockRecord` / ENABLE_MOCK
 *     hook (so we don't need the mocks *page* or real DNS), and
 *   - the Resend email transport (unrelated to the race; see resend-stub.mjs).
 *
 * Run: see scripts/repro/run.sh
 */

// ---- env must be set before any "@/..." module (env.ts reads it at import) --
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Set DATABASE_URL before running (see run.sh).");
  process.exit(1);
}
process.env.NODE_ENV = "development"; // not "test": keep the real DATABASE_URL & timings
process.env.AUTH_SECRET = "repro-auth-secret";
process.env.AUTH_RESEND_KEY = "re_repro_placeholder";
process.env.ENCRYPTION_KEY = "0f".repeat(32);
process.env.CRON_SECRET = "repro-cron-secret";
process.env.ENABLE_MOCK = "true";

const TRIALS = Number(process.env.TRIALS ?? 200);

const { randomUUID } = await import("node:crypto");
const { OpenAPIHono } = await import("@hono/zod-openapi");
const { and, eq } = await import("drizzle-orm");

const { db } = await import("@/db/client");
const { users, domains } = await import("@/db/schema");
const { insertDomain } = await import("@/db/domains");
const { cronVerifyRoute, cronVerifyHandler } = await import(
  "@/lib/api/cron/verify"
);
const { sentBatches } = await import("./resend-stub.mjs");

// The real cron route + handler, mounted on a minimal router. This is exactly
// what src/lib/api/setup.ts registers for production; we skip the unrelated
// auth/docs wiring so the script runs as plain Node.
const app = new OpenAPIHono().basePath("/api");
app.openapi(cronVerifyRoute, cronVerifyHandler);

const CRON_HEADERS = { authorization: `Bearer ${process.env.CRON_SECRET}` };

type Outcome =
  | "BOTH_VERIFIED"
  | "BOTH_FAILED"
  | "SINGLE_OWNER"
  | "NEITHER_MOVED"
  | "OTHER";

const mockRecord = (publicKey: string) => ({
  type: "success" as const,
  value: [`v=DKIM1;k=rsa;p=${publicKey}`],
});

/** Arrange the precondition: two accounts each mid-verification for one name. */
const seedTrial = async () => {
  // "\bmock\b" in the name activates the app's own DNS mock path (isMockDomainName).
  const name = `mock-race-${randomUUID().slice(0, 8)}.example`;
  const now = new Date();
  const past = new Date(now.getTime() - 60_000);
  const future = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

  const seedOne = async (publicKey: string) => {
    const userId = randomUUID();
    await db
      .insert(users)
      .values({ id: userId, email: `${userId}@example.test` })
      .execute();
    const domain = await insertDomain({
      name,
      userId,
      selector: `sel-${publicKey}`,
      publicKey,
      privateKey: "REPRO-PRIVATE",
    });
    // Both accounts have "started verification": in_progress, due now, DNS present.
    await db
      .update(domains)
      .set({
        status: "in_progress",
        nextCheckAt: past,
        deadlineAt: future,
        dnsMockRecord: mockRecord(publicKey),
      })
      .where(eq(domains.id, domain.id))
      .execute();
    return { userId, id: domain.id };
  };

  const a = await seedOne("PUBKEYA");
  const b = await seedOne("PUBKEYB");
  return { name, a, b };
};

const statusOf = async (id: string) => {
  const [row] = await db
    .select({
      status: domains.status,
      statusReason: domains.statusReason,
      checkLog: domains.checkLog,
    })
    .from(domains)
    .where(eq(domains.id, id))
    .execute();
  return row;
};

// A domain that logged an "ok" entry this sweep DID reach `verified` — even if
// a later "revoked" entry in the same sweep shows it was superseded afterwards.
const reachedVerifiedThisSweep = (row: { checkLog: unknown }) =>
  Array.isArray(row.checkLog) &&
  row.checkLog.some((e: { status?: string }) => e?.status === "ok");

const classify = (sa: string, sb: string): Outcome => {
  if (sa === "verified" && sb === "verified") return "BOTH_VERIFIED";
  if (sa === "failed" && sb === "failed") return "BOTH_FAILED";
  if (
    (sa === "verified" && sb === "failed") ||
    (sa === "failed" && sb === "verified")
  )
    return "SINGLE_OWNER";
  if (sa === "in_progress" && sb === "in_progress") return "NEITHER_MOVED";
  return "OTHER";
};

const cleanup = async (userIds: string[]) => {
  for (const userId of userIds) {
    await db.delete(users).where(eq(users.id, userId)).execute(); // cascades to domain
  }
};

const tally: Record<Outcome, number> = {
  BOTH_VERIFIED: 0,
  BOTH_FAILED: 0,
  SINGLE_OWNER: 0,
  NEITHER_MOVED: 0,
  OTHER: 0,
};
let invariantViolations = 0; // sweeps that left != 1 verified owner for the name
let bothReachedVerified = 0; // sweeps where BOTH rows hit `verified` mid-sweep
const examples: Record<string, string> = {};

console.log(
  `Running ${TRIALS} concurrent cron sweeps (two accounts / one domain name each)...\n`,
);

for (let i = 0; i < TRIALS; i++) {
  const { name, a, b } = await seedTrial();

  // THE EXPOSED ENTRY POINT: one cron tick. The handler loads both due domains
  // and runs verifyDomain(a) and verifyDomain(b) concurrently in one sweep.
  const res = await app.request("/api/cron/verify", { headers: CRON_HEADERS });
  if (res.status !== 200) {
    console.error("cron returned", res.status, await res.text());
    process.exit(1);
  }

  const [ra, rb] = await Promise.all([statusOf(a.id), statusOf(b.id)]);
  const outcome = classify(ra.status, rb.status);
  tally[outcome]++;

  if (reachedVerifiedThisSweep(ra) && reachedVerifiedThisSweep(rb)) {
    bothReachedVerified++;
  }

  const verifiedCount = [ra.status, rb.status].filter(
    (s) => s === "verified",
  ).length;
  if (verifiedCount !== 1) {
    invariantViolations++;
    if (!examples[outcome]) {
      examples[outcome] =
        `name=${name} A=(${ra.status}/${ra.statusReason}) B=(${rb.status}/${rb.statusReason})`;
    }
  }

  await cleanup([a.userId, b.userId]);
}

console.log("Outcome distribution across", TRIALS, "sweeps:");
for (const [k, v] of Object.entries(tally)) {
  if (v > 0) {
    const pct = ((v / TRIALS) * 100).toFixed(1);
    console.log(`  ${k.padEnd(14)} ${String(v).padStart(4)}  (${pct}%)`);
  }
}
console.log(
  `\nSweeps where BOTH accounts reached \`verified\` in the same sweep ` +
    `(transient two-owner state): ${bothReachedVerified}/${TRIALS} ` +
    `(${((bothReachedVerified / TRIALS) * 100).toFixed(1)}%)`,
);
console.log(
  `Sweeps that broke the "exactly one verified owner" invariant at rest: ` +
    `${invariantViolations}/${TRIALS} (${((invariantViolations / TRIALS) * 100).toFixed(1)}%)`,
);
if (Object.keys(examples).length) {
  console.log("\nExample corrupted end-states:");
  for (const [k, v] of Object.entries(examples)) console.log(`  [${k}] ${v}`);
}
console.log(
  `\n"Domain superseded" email batches the race sent: ${sentBatches.length}`,
);

await (db as unknown as { $client: { end: () => Promise<void> } }).$client.end();
process.exit(0);
