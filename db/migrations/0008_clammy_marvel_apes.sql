DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_channel') THEN CREATE TYPE "public"."message_channel" AS ENUM('app', 'whatsapp', 'instagram'); END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_direction') THEN CREATE TYPE "public"."message_direction" AS ENUM('inbound', 'outbound'); END IF; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TYPE "public"."sender_role" ADD VALUE 'client'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
ALTER TABLE "chat_messages" ALTER COLUMN "sender_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "channel" "message_channel" DEFAULT 'app' NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "direction" "message_direction";--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "external_message_id" text;