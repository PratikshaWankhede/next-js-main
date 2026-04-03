DO $$ BEGIN ALTER TABLE "leads" DROP CONSTRAINT "leads_assigned_user_id_user_id_fk"; EXCEPTION WHEN undefined_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "follow_ups" DROP CONSTRAINT "follow_ups_assigned_user_id_user_id_fk"; EXCEPTION WHEN undefined_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "leads" ADD CONSTRAINT "leads_assigned_user_id_user_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_assigned_user_id_user_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;