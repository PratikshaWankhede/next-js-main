CREATE TYPE "public"."sla_status" AS ENUM('pending', 'met', 'breached');--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "first_response_at" timestamp;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "sla_breached_at" timestamp;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "sla_status" "sla_status" DEFAULT 'pending' NOT NULL;