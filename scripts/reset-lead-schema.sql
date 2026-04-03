-- Reset lead schema for clean migration
-- Run this if migration fails due to partial/conflicting schema
-- Usage: psql $DATABASE_URL -f scripts/reset-lead-schema.sql

-- Drop tables (order matters due to FKs)
DROP TABLE IF EXISTS "lead_stage_history" CASCADE;
DROP TABLE IF EXISTS "lead_reassignment_logs" CASCADE;
DROP TABLE IF EXISTS "leads" CASCADE;

-- Drop enums
DROP TYPE IF EXISTS "public"."lead_stage" CASCADE;
DROP TYPE IF EXISTS "public"."lead_source" CASCADE;
