CREATE TABLE "dns_mock_records" (
	"id" uuid PRIMARY KEY NOT NULL,
	"domain_name" text NOT NULL,
	"record_response" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "dns_mock_records_domain_name_unique" UNIQUE("domain_name")
);
--> statement-breakpoint
DROP TABLE IF EXISTS "check" CASCADE;--> statement-breakpoint
ALTER TABLE "domain" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "domain" ALTER COLUMN "status" SET DEFAULT 'not_started'::text;--> statement-breakpoint
DROP TYPE "public"."domain_status";--> statement-breakpoint
CREATE TYPE "public"."domain_status" AS ENUM('not_started', 'in_progress', 'verified', 'failed');--> statement-breakpoint
ALTER TABLE "domain" ALTER COLUMN "status" SET DEFAULT 'not_started'::"public"."domain_status";--> statement-breakpoint
ALTER TABLE "domain" ALTER COLUMN "status" SET DATA TYPE "public"."domain_status" USING "status"::"public"."domain_status";--> statement-breakpoint
ALTER TABLE "domain" ALTER COLUMN "status_reason" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."domain_status_reason";--> statement-breakpoint
CREATE TYPE "public"."domain_status_reason" AS ENUM('expired', 'canceled', 'superseded', 'grace_period_expired');--> statement-breakpoint
ALTER TABLE "domain" ALTER COLUMN "status_reason" SET DATA TYPE "public"."domain_status_reason" USING "status_reason"::"public"."domain_status_reason";--> statement-breakpoint
ALTER TABLE "domain" ADD COLUMN IF NOT EXISTS "grace_period_started_at" timestamp;--> statement-breakpoint
ALTER TABLE "domain" ADD COLUMN IF NOT EXISTS "grace_period_warning_sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "domain" ADD COLUMN IF NOT EXISTS "check_log" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
DROP TYPE IF EXISTS "public"."check_outcome";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."check_trigger";