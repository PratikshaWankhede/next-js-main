import "dotenv/config";
import { db } from "@/db";
import {
  ALERTS,
  FOLLOW_UPS,
  LEADS,
  NOTIFICATION_DELIVERIES,
  SLA_LOGS,
  USER,
} from "@/db/collections";
import type {
  AlertDoc,
  FollowUpDoc,
  LeadDoc,
  SlaLogDoc,
} from "@/db/collections";
import { createNotification } from "@/lib/notifications/create-notification";
import { getFirstResponseSlaMinutes } from "@/lib/sla-settings";
import { generateRandomUUID } from "@/helpers/generate-random-uuid";
import { subMinutes } from "date-fns";

export async function runSlaCron() {
  const now = new Date();
  const firstResponseSlaMinutes = await getFirstResponseSlaMinutes();
  const breachThreshold = subMinutes(now, firstResponseSlaMinutes);
  const leadsCol = db.collection<LeadDoc>(LEADS);
  const slaCol = db.collection<SlaLogDoc>(SLA_LOGS);
  const alertsCol = db.collection<AlertDoc>(ALERTS);
  const followUpsCol = db.collection<FollowUpDoc>(FOLLOW_UPS);
  const userCol = db.collection(USER);

  const breachedLeads = await leadsCol
    .find({
      slaStatus: "pending",
      firstResponseAt: null,
      createdAt: { $lt: breachThreshold },
    })
    .toArray();

  for (const lead of breachedLeads) {
    await leadsCol.updateOne(
      { id: lead.id },
      {
        $set: {
          slaStatus: "breached",
          slaBreachedAt: now,
          updatedAt: now,
        },
      },
    );

    await slaCol.insertOne({
      id: generateRandomUUID(),
      leadId: lead.id,
      followUpId: null,
      type: "first_response",
      breachedAt: now,
      createdAt: now,
    });

    await alertsCol.insertOne({
      id: generateRandomUUID(),
      type: "sla_breach",
      leadId: lead.id,
      message: `${lead.name}: No first response within ${firstResponseSlaMinutes} min`,
      isRead: false,
      createdAt: now,
    });

    const targetUserIds: string[] = [];
    if (lead.assignedUserId) targetUserIds.push(lead.assignedUserId);
    const admins = await userCol.find({ role: "admin" }).toArray();
    for (const a of admins) {
      const id = (a as { id?: string }).id;
      if (id && !targetUserIds.includes(id)) targetUserIds.push(id);
    }
    if (targetUserIds.length > 0) {
      await createNotification({
        type: "sla_breach",
        title: "SLA Breach",
        body: `${lead.name}: No first response within ${firstResponseSlaMinutes} min`,
        leadId: lead.id,
        targetUserIds,
      });
    }
  }

  if (breachedLeads.length > 0) {
    console.log(
      `[cron] Marked ${breachedLeads.length} leads for first-response SLA breach`,
    );
  }

  const missedFollowUps = await followUpsCol
    .find({ status: "missed" })
    .toArray();
  const deliveriesCol = db.collection(NOTIFICATION_DELIVERIES);
  let loggedCount = 0;

  for (const fu of missedFollowUps) {
    const existing = await slaCol.findOne({ followUpId: fu.id });
    if (existing) continue;

    await slaCol.insertOne({
      id: generateRandomUUID(),
      leadId: fu.leadId,
      followUpId: fu.id,
      type: "follow_up_missed",
      breachedAt: fu.scheduledAt,
      createdAt: now,
    });

    const lead = await leadsCol.findOne({ id: fu.leadId });
    const leadName = lead?.name ?? "Unknown";
    const scheduledStr = fu.scheduledAt.toISOString().slice(0, 10);

    await alertsCol.insertOne({
      id: generateRandomUUID(),
      type: "follow_up_missed",
      leadId: fu.leadId,
      message: `${leadName}: Follow-up missed on ${scheduledStr}`,
      isRead: false,
      createdAt: now,
    });
    loggedCount++;
  }

  if (loggedCount > 0) {
    console.log(`[cron] Logged ${loggedCount} follow-up SLA breaches`);
  }
}

runSlaCron()
  .then(() => {
    console.log("[cron] SLA cron completed");
    process.exit(0);
  })
  .catch((err) => {
    console.error("[cron] SLA cron failed:", err);
    process.exit(1);
  });
