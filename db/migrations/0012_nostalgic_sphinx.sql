DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_score') THEN CREATE TYPE "public"."ai_score" AS ENUM('hot', 'warm', 'cold'); END IF; END $$;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "ai_summary" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "ai_summary_updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "ai_score" "ai_score";--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "ai_score_reason" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "ai_score_updated_at" timestamp;