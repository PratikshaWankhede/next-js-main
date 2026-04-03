-- Add website to lead_source enum
DO $$ BEGIN
  ALTER TYPE "public"."lead_source" ADD VALUE 'website';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
-- Create tattoo_types table
CREATE TABLE IF NOT EXISTS "tattoo_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tattoo_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
-- Add tattoo_type_id to leads
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "tattoo_type_id" uuid;
--> statement-breakpoint
-- Add FK for tattoo_type_id (skip if exists)
DO $$ BEGIN
  ALTER TABLE "leads" ADD CONSTRAINT "leads_tattoo_type_id_tattoo_types_id_fk" FOREIGN KEY ("tattoo_type_id") REFERENCES "public"."tattoo_types"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
