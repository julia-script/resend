import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
// import postgres from "postgres";
import { Redacted } from "effect";
import type { AdapterAccountType } from "next-auth/adapters";
import { env } from "@/lib/env";

// import { env } from "@/lib/env";

// const pool = postgres(Redacted.value(env.databaseUrl), { max: 1 });

const dbUrl = Redacted.value(env.databaseUrl);
export const db = drizzle(dbUrl);

export const users = pgTable("user", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
});

export const accounts = pgTable(
  "account",
  {
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    {
      compoundKey: primaryKey({
        columns: [account.provider, account.providerAccountId],
      }),
    },
  ],
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: uuid("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (verificationToken) => [
    {
      compositePk: primaryKey({
        columns: [verificationToken.identifier, verificationToken.token],
      }),
    },
  ],
);

export const domainStatus = pgEnum("domain_status", [
  "not_started",
  "pending",
  "verified",
  "failed",
  "temporary_failure",
]);

export const domainStatusReason = pgEnum("domain_status_reason", [
  "window_expired",
  "revoked_after_grace",
]);

export const checkTrigger = pgEnum("check_trigger", [
  "cron",
  "manual",
  "page_load",
]);

export const checkOutcome = pgEnum("check_outcome", [
  "verified",
  "not_found",
  "value_mismatch",
  "wrong_host",
  "no_delegation",
  "dns_error",
]);

export const domains = pgTable(
  "domain",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    selector: text("selector").notNull(),
    publicKey: text("public_key").notNull(),
    privateKeyEncrypted: text("private_key_encrypted").notNull(),
    status: domainStatus("status").notNull().default("not_started"),
    statusReason: domainStatusReason("status_reason"),
    nextCheckAt: timestamp("next_check_at", { mode: "date" }),
    deadlineAt: timestamp("deadline_at", { mode: "date" }),
    verifiedAt: timestamp("verified_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (domain) => [
    unique().on(domain.userId, domain.name),
    index("domain_due_checks_idx").on(domain.status, domain.nextCheckAt),
  ],
);

export const checks = pgTable(
  "check",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    domainId: uuid("domain_id")
      .notNull()
      .references(() => domains.id, { onDelete: "cascade" }),
    recordPurpose: text("record_purpose").notNull().default("dkim"),
    checkedAt: timestamp("checked_at", { mode: "date" }).notNull().defaultNow(),
    trigger: checkTrigger("trigger").notNull(),
    outcome: checkOutcome("outcome").notNull(),
    nameserversQueried: text("nameservers_queried").array(),
    foundValue: text("found_value"),
    causedTransition: boolean("caused_transition").notNull().default(false),
  },
  (check) => [index("check_timeline_idx").on(check.domainId, check.checkedAt)],
);

export const authenticators = pgTable(
  "authenticator",
  {
    credentialID: uuid("credentialID").notNull().unique(),
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    providerAccountId: uuid("providerAccountId").notNull(),
    credentialPublicKey: text("credentialPublicKey").notNull(),
    counter: integer("counter").notNull(),
    credentialDeviceType: text("credentialDeviceType").notNull(),
    credentialBackedUp: boolean("credentialBackedUp").notNull(),
    transports: text("transports"),
  },
  (authenticator) => [
    {
      compositePK: primaryKey({
        columns: [authenticator.userId, authenticator.credentialID],
      }),
    },
  ],
);
