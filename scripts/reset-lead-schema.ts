/**
 * Reset lead schema for clean migration.
 * Run if migration fails due to partial/conflicting schema.
 *
 * Usage: pnpm tsx scripts/reset-lead-schema.ts
 * Then: pnpm drizzle-kit migrate
 */

import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!);

async function reset() {
  console.log("Resetting lead schema...\n");

  await sql.unsafe(`DROP TABLE IF EXISTS "lead_stage_history" CASCADE`);
  console.log("Dropped lead_stage_history");

  await sql.unsafe(`DROP TABLE IF EXISTS "lead_reassignment_logs" CASCADE`);
  console.log("Dropped lead_reassignment_logs");

  await sql.unsafe(`DROP TABLE IF EXISTS "leads" CASCADE`);
  console.log("Dropped leads");

  await sql.unsafe(`DROP TYPE IF EXISTS "public"."lead_stage" CASCADE`);
  console.log("Dropped lead_stage enum");

  await sql.unsafe(`DROP TYPE IF EXISTS "public"."lead_source" CASCADE`);
  console.log("Dropped lead_source enum");

  console.log("\nReset complete. Run: pnpm drizzle-kit migrate");
}

reset()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Reset failed:", err);
    process.exit(1);
  });
