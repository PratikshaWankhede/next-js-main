CREATE TYPE "public"."follow_up_status" AS ENUM('pending', 'completed', 'missed');--> statement-breakpoint
CREATE TABLE "follow_ups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"assigned_user_id" uuid NOT NULL,
	"scheduled_at" timestamp NOT NULL,
	"completed_at" timestamp,
	"status" "follow_up_status" DEFAULT 'pending' NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_assigned_user_id_user_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "follow_ups_assigned_scheduled_idx" ON "follow_ups" USING btree ("assigned_user_id","scheduled_at");--> statement-breakpoint
CREATE INDEX "follow_ups_lead_status_idx" ON "follow_ups" USING btree ("lead_id","status");