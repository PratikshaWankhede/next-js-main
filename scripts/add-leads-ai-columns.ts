import postgres from "postgres";
import "dotenv/config";

const sql = postgres(process.env.DATABASE_URL!);

async function syncMissingColumns() {
  try {
    // Create ai_score enum if it doesn't exist
    await sql.unsafe(`
      DO $$ BEGIN
        CREATE TYPE "public"."ai_score" AS ENUM('hot', 'warm', 'cold');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    console.log("Ensured ai_score enum exists.");

    // Add missing columns to leads table
    await sql`ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "ai_summary" text`;
    await sql`ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "ai_summary_updated_at" timestamp`;
    await sql`ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "ai_score" "ai_score"`;
    await sql`ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "ai_score_reason" text`;
    await sql`ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "ai_score_updated_at" timestamp`;
    console.log("Leads table: AI columns OK.");

    // Add missing columns to notifications table
    await sql.unsafe(`
      ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "body" text NOT NULL DEFAULT '';
    `);
    await sql.unsafe(`
      ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "lead_id" uuid REFERENCES "leads"("id");
    `);
    console.log("Notifications table: body, lead_id OK.");

    // Create message_channel and message_direction enums for chat_messages
    await sql.unsafe(`
      DO $$ BEGIN
        CREATE TYPE "public"."message_channel" AS ENUM('app', 'whatsapp', 'instagram');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await sql.unsafe(`
      DO $$ BEGIN
        CREATE TYPE "public"."message_direction" AS ENUM('inbound', 'outbound');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await sql.unsafe(`ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "direction" "message_direction"`);
    await sql.unsafe(`ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "external_message_id" text`);
    await sql.unsafe(`ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "channel" "message_channel"`);
    console.log("Chat messages table: channel, direction, external_message_id OK.");

    console.log("Successfully synced all missing columns.");
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

syncMissingColumns();
