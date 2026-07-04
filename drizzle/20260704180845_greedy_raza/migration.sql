CREATE TYPE "check_outcome" AS ENUM('verified', 'not_found', 'value_mismatch', 'wrong_host', 'no_delegation', 'dns_error');--> statement-breakpoint
CREATE TYPE "check_trigger" AS ENUM('cron', 'manual', 'page_load');--> statement-breakpoint
CREATE TYPE "domain_status" AS ENUM('not_started', 'pending', 'verified', 'failed', 'temporary_failure');--> statement-breakpoint
CREATE TYPE "domain_status_reason" AS ENUM('window_expired', 'revoked_after_grace');--> statement-breakpoint
CREATE TABLE "account" (
	"userId" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" uuid NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text
);
--> statement-breakpoint
CREATE TABLE "authenticator" (
	"credentialID" uuid NOT NULL UNIQUE,
	"userId" uuid NOT NULL,
	"providerAccountId" uuid NOT NULL,
	"credentialPublicKey" text NOT NULL,
	"counter" integer NOT NULL,
	"credentialDeviceType" text NOT NULL,
	"credentialBackedUp" boolean NOT NULL,
	"transports" text
);
--> statement-breakpoint
CREATE TABLE "check" (
	"id" uuid PRIMARY KEY,
	"domain_id" uuid NOT NULL,
	"record_purpose" text DEFAULT 'dkim' NOT NULL,
	"checked_at" timestamp DEFAULT now() NOT NULL,
	"trigger" "check_trigger" NOT NULL,
	"outcome" "check_outcome" NOT NULL,
	"nameservers_queried" text[],
	"found_value" text,
	"caused_transition" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "domain" (
	"id" uuid PRIMARY KEY,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"selector" text NOT NULL,
	"public_key" text NOT NULL,
	"private_key_encrypted" text NOT NULL,
	"status" "domain_status" DEFAULT 'not_started'::"domain_status" NOT NULL,
	"status_reason" "domain_status_reason",
	"next_check_at" timestamp,
	"deadline_at" timestamp,
	"verified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "domain_user_id_name_unique" UNIQUE("user_id","name")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sessionToken" text PRIMARY KEY,
	"userId" uuid NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY,
	"name" text,
	"email" text UNIQUE,
	"emailVerified" timestamp,
	"image" text
);
--> statement-breakpoint
CREATE TABLE "verificationToken" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE INDEX "check_timeline_idx" ON "check" ("domain_id","checked_at");--> statement-breakpoint
CREATE INDEX "domain_due_checks_idx" ON "domain" ("status","next_check_at");--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "authenticator" ADD CONSTRAINT "authenticator_userId_user_id_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "check" ADD CONSTRAINT "check_domain_id_domain_id_fkey" FOREIGN KEY ("domain_id") REFERENCES "domain"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "domain" ADD CONSTRAINT "domain_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE;