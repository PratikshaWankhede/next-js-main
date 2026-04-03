import "dotenv/config";
import { db } from "@/db";
import { FOLLOW_UPS, LEAD_STAGE_HISTORY, LEADS, USER } from "@/db/collections";
import type { FollowUpDoc, LeadDoc } from "@/db/collections";
import { createNotification } from "@/lib/notifications/create-notification";
import { appendLeadTimelineEvent } from "@/lib/lead-timeline";
import { generateRandomUUID } from "@/helpers/generate-random-uuid";

export async function runFollowUpCron() {
  const now = new Date();
  const followUpsCol = db.collection<FollowUpDoc>(FOLLOW_UPS);
  const leadsCol = db.collection<LeadDoc>(LEADS);

  const toMarkMissed = await followUpsCol
    .find({ status: "pending", scheduledAt: { $lt: now } })
    .toArray();

  if (toMarkMissed.length > 0) {
    await followUpsCol.updateMany(
      { status: "pending", scheduledAt: { $lt: now } },
      { $set: { status: "missed" } },
    );
  }

  const missedList = toMarkMissed;

  for (const fu of missedList) {
    if (fu.assignedUserId) {
      const lead = await leadsCol.findOne({ id: fu.leadId });
      const leadName = lead?.name ?? "Unknown";
      const scheduledStr = fu.scheduledAt.toISOString().slice(0, 10);
      await createNotification({
        type: "follow_up_missed",
        title: "Follow-up Missed",
        body: `${leadName}: Follow-up missed on ${scheduledStr}`,
        leadId: fu.leadId,
        targetUserIds: [fu.assignedUserId],
      });
    }
  }

  if (missedList.length > 0) {
    console.log(`[cron] Marked ${missedList.length} follow-ups as missed`);
  }

  const leadsWithFiveMissed = await followUpsCol
    .aggregate<{
      _id: string;
    }>([{ $match: { status: "missed" } }, { $group: { _id: "$leadId", count: { $sum: 1 }, missed: { $sum: { $cond: [{ $eq: ["$status", "missed"] }, 1, 0] } } } }, { $match: { count: 5, missed: 5 } }])
    .toArray();

  let movedCount = 0;
  for (const row of leadsWithFiveMissed) {
    const leadId = row._id;
    const lead = await leadsCol.findOne({ id: leadId });
    if (!lead || lead.stage === "done") continue;

    let changedByUserId = lead.assignedUserId ?? null;
    if (!changedByUserId) {
      const adminUser = await db.collection(USER).findOne({ role: "admin" });
      changedByUserId = adminUser?.id ?? null;
    }
    if (!changedByUserId) continue;

    await db.collection(LEAD_STAGE_HISTORY).insertOne({
      id: generateRandomUUID(),
      leadId: lead.id,
      fromStage: lead.stage,
      toStage: "lost",
      changedByUserId,
      changedAt: now,
    });

    const lostCount = (lead.lostCount ?? 0) + 1;
    const recoveryCycle = (lead.recoveryCycle ?? 0) + 1;
    const stageUpdates: Record<string, unknown> = {
      stage: "lost",
      lostAt: now,
      lostCount,
      recoveryCycle,
      updatedAt: now,
    };
    if (lostCount >= 2) {
      stageUpdates.exitedFromCrmAt = now;
      await appendLeadTimelineEvent(lead.id, "exited_crm", {
        reason: "five_missed_follow_ups",
        lostCount,
      });
    }
    await leadsCol.updateOne({ id: lead.id }, { $set: stageUpdates });
    movedCount++;
  }

  if (movedCount > 0) {
    console.log(`[cron] Auto-moved ${movedCount} leads to LOST`);
  }
}

runFollowUpCron()
  .then(() => {
    console.log("[cron] Follow-up cron completed");
    process.exit(0);
  })
  .catch((err) => {
    console.error("[cron] Follow-up cron failed:", err);
    process.exit(1);
  });
