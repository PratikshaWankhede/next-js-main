CREATE TYPE "public"."sla_log_type" AS ENUM('first_response', 'follow_up_missed');--> statement-breakpoint
CREATE TABLE "sla_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"follow_up_id" uuid,
	"type" "sla_log_type" NOT NULL,
	"breached_at" timestamp NOT NULL,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sla_logs" ADD CONSTRAINT "sla_logs_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sla_logs" ADD CONSTRAINT "sla_logs_follow_up_id_follow_ups_id_fk" FOREIGN KEY ("follow_up_id") REFERENCES "public"."follow_ups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sla_logs_lead_type_idx" ON "sla_logs" USING btree ("lead_id","type");