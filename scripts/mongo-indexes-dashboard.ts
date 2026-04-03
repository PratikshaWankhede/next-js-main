/**
 * Creates indexes recommended for GET /api/dashboard/summary aggregations.
 * Run: npx tsx scripts/mongo-indexes-dashboard.ts
 */
import "dotenv/config";
import { MongoClient } from "mongodb";
import { FOLLOW_UPS, LEADS } from "../db/collections";

const uri = process.env.MONGODB_URI!;
if (!uri) {
  console.error("MONGODB_URI is not set");
  process.exit(1);
}

const client = new MongoClient(uri);

async function main() {
  await client.connect();
  const db = client.db();

  const leads = db.collection(LEADS);
  const fus = db.collection(FOLLOW_UPS);

  await leads.createIndex(
    { assignedUserId: 1, createdAt: -1 },
    { name: "dashboard_leads_assign_created" },
  );
  await leads.createIndex(
    { stage: 1, createdAt: -1 },
    { name: "dashboard_leads_stage_created" },
  );
  await leads.createIndex(
    { aiScore: 1, updatedAt: -1 },
    { name: "dashboard_leads_aiscore_updated" },
  );
  await leads.createIndex(
    { exitedFromCrmAt: 1, assignedUserId: 1 },
    { name: "dashboard_leads_exited_assign" },
  );

  await fus.createIndex(
    { assignedUserId: 1, scheduledAt: 1, status: 1 },
    { name: "dashboard_fu_assign_sched_status" },
  );

  console.log("Dashboard indexes ensured.");
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
