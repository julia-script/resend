import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";
import {
  type CheckLogEntry,
  type DnsMockResponse,
  domainStatusReasonValues,
  domainStatusValues,
} from "@/shared/domain";

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
    providerAccountId: uuid("providerAccountId").notNull(),
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

export const domainStatus = pgEnum("domain_status", domainStatusValues);

export const domainStatusReason = pgEnum(
  "domain_status_reason",
  domainStatusReasonValues,
);

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

    gracePeriodStartedAt: timestamp("grace_period_started_at", {
      mode: "date",
    }),
    gracePeriodWarningSentAt: timestamp("grace_period_warning_sent_at", {
      mode: "date",
    }),

    status: domainStatus("status").notNull().default("not_started"),
    statusReason: domainStatusReason("status_reason"),
    // One jsonb holding the whole array (not jsonb[]): we always read/write it whole.
    checkLog: jsonb("check_log").$type<CheckLogEntry[]>().notNull().default([]),

    nextCheckAt: timestamp("next_check_at", { mode: "date" }),
    deadlineAt: timestamp("deadline_at", { mode: "date" }),
    verifiedAt: timestamp("verified_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    dnsMockRecord: jsonb("dns_mock_record")
      .$type<DnsMockResponse>()
      .notNull()
      .default({ type: "failure", error: "ENODATA" }),
  },
  (domain) => [
    unique().on(domain.userId, domain.name),
    index("domain_due_checks_idx").on(domain.status, domain.nextCheckAt),
  ],
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
