-- Better Auth admin plugin: add banned, ban_reason, ban_expires to user
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "banned" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "ban_reason" text;
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "ban_expires" timestamp;
--> statement-breakpoint
-- Better Auth admin plugin: add impersonated_by to session
ALTER TABLE "session" ADD COLUMN IF NOT EXISTS "impersonated_by" uuid REFERENCES "public"."user"("id");
