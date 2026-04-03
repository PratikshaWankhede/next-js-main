import { db } from "@/db";
import { FOLLOW_UPS, LEAD_STAGE_HISTORY, LEADS, USER } from "@/db/collections";
import type {
  FollowUpDoc,
  LeadDoc,
  LeadStageHistoryDoc,
  UserDoc,
} from "@/db/collections";
import { sendBookingMessageForLead } from "@/lib/booking-messages";
import { canAccessLead, getSessionWithRole, requireAuth } from "@/lib/rbac";
import {
  isValidStageTransition,
  type LeadStage,
} from "@/features/leads/types/lead.types";
import { getLeastLoadedSalesUserId } from "@/lib/lead-resolver";
import { appendLeadTimelineEvent } from "@/lib/lead-timeline";
import { addDays, addHours } from "date-fns";
import { generateRandomUUID } from "@/helpers/generate-random-uuid";
import { NextRequest, NextResponse } from "next/server";

const VALID_STAGES: LeadStage[] = [
  "new",
  "contacted",
  "interested",
  "rnr",
  "follow_up",
  "booking",
  "no_show",
  "done",
  "lost",
];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionWithRole();
  requireAuth(session);

  const { id } = await params;

  const lead = await db.collection<LeadDoc>(LEADS).findOne({ id });
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  if (!canAccessLead(session, lead)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data = body as Record<string, unknown>;
  const toStage = data.toStage;

  if (
    typeof toStage !== "string" ||
    !VALID_STAGES.includes(toStage as LeadStage)
  ) {
    return NextResponse.json({ error: "Invalid toStage" }, { status: 400 });
  }

  const currentStage = lead.stage as LeadStage;
  const targetStage = toStage as LeadStage;
  const finalStage = targetStage === "rnr" ? "follow_up" : targetStage;

  if (!isValidStageTransition(currentStage, targetStage)) {
    return NextResponse.json(
      { error: "Invalid stage transition - cannot skip stages" },
      { status: 400 },
    );
  }

  if (currentStage === targetStage) {
    return NextResponse.json(lead);
  }

  const now = new Date();
  await db.collection<LeadStageHistoryDoc>(LEAD_STAGE_HISTORY).insertOne({
    id: generateRandomUUID(),
    leadId: id,
    fromStage: currentStage,
    toStage: targetStage,
    changedByUserId: session.user.id,
    changedAt: now,
  });

  const stageUpdates: Record<string, unknown> = {
    stage: finalStage,
    updatedAt: now,
  };
  if (targetStage === "lost") {
    const lostCount = (lead.lostCount ?? 0) + 1;
    const recoveryCycle = (lead.recoveryCycle ?? 0) + 1;
    stageUpdates.lostAt = now;
    stageUpdates.lostCount = lostCount;
    stageUpdates.recoveryCycle = recoveryCycle;
    if (typeof data.lostReason === "string" && data.lostReason.trim() !== "") {
      stageUpdates.lostReason = data.lostReason.trim();
    }
    if (lostCount >= 2) {
      stageUpdates.exitedFromCrmAt = now;
    }
  }
  if (finalStage === "done") {
    stageUpdates.doneAt = now;
    if (lead.reviewStatus == null) {
      stageUpdates.reviewStatus = "not_started";
    }
  }
  if (finalStage === "no_show") {
    stageUpdates.isNoShow = true;
    stageUpdates.noShowAt = now;
    stageUpdates.noShowCount = (lead.noShowCount ?? 0) + 1;
  }

  await db.collection(LEADS).updateOne({ id }, { $set: stageUpdates });
  let updated: LeadDoc = {
    ...lead,
    ...stageUpdates,
    stage: finalStage,
    updatedAt: now,
  } as LeadDoc;

  // FC → Booking: reassign to original Sales (or least-loaded sales)
  if (finalStage === "booking" && lead.roleOwner === "follow_up_candidate") {
    let newAssignedUserId: string | null = null;
    const previousId = lead.previousAssignedUserId;
    if (previousId) {
      const prevUser = await db
        .collection<UserDoc>(USER)
        .findOne({ id: previousId, role: "sales" });
      if (prevUser) newAssignedUserId = prevUser.id;
    }
    if (!newAssignedUserId) {
      newAssignedUserId = await getLeastLoadedSalesUserId();
    }
    if (newAssignedUserId) {
      const reassignUpdates: Record<string, unknown> = {
        assignedUserId: newAssignedUserId,
        roleOwner: "sales",
        previousAssignedUserId: null,
        updatedAt: now,
      };
      await db.collection(LEADS).updateOne({ id }, { $set: reassignUpdates });
      updated = {
        ...updated,
        ...reassignUpdates,
        assignedUserId: newAssignedUserId,
        roleOwner: "sales",
        previousAssignedUserId: null,
      } as LeadDoc;
      await appendLeadTimelineEvent(
        id,
        "reassigned_to_sales",
        {
          fromUserId: lead.assignedUserId,
          toUserId: newAssignedUserId,
        },
        session.user.id,
      );
    }
  }

  await appendLeadTimelineEvent(
    id,
    "stage_changed",
    {
      fromStage: currentStage,
      toStage: targetStage,
    },
    session.user.id,
  );

  if (targetStage === "rnr") {
    await db.collection<LeadStageHistoryDoc>(LEAD_STAGE_HISTORY).insertOne({
      id: generateRandomUUID(),
      leadId: id,
      fromStage: "rnr",
      toStage: "follow_up",
      changedByUserId: session.user.id,
      changedAt: now,
    });

    await appendLeadTimelineEvent(
      id,
      "stage_changed",
      {
        fromStage: "rnr",
        toStage: "follow_up",
      },
      session.user.id,
    );
  }

  // When marked Done: send review request immediately (best-effort)
  if (finalStage === "done") {
    const shouldSendReview =
      !updated.bookingReviewSentAt &&
      (updated.reviewStatus === "not_started" || updated.reviewStatus == null);
    if (shouldSendReview) {
      try {
        const sent = await sendBookingMessageForLead(updated, "review", {
          triggeredByUserId: session.user.id,
          triggeredByRole: session.role === "admin" ? "admin" : "sales",
        });
        if (sent) {
          await db.collection(LEADS).updateOne(
            { id },
            {
              $set: {
                bookingReviewSentAt: now,
                reviewStatus: "review_sent",
                updatedAt: now,
              },
            },
          );
          updated = {
            ...updated,
            bookingReviewSentAt: now,
            reviewStatus: "review_sent",
            updatedAt: now,
          } as LeadDoc;
        }
      } catch {
        // Don't fail the stage change if review message fails
      }
    }
  }

  // Create follow-ups when moving to follow_up using the selected base datetime:
  // first follow-up at +6 hours, then +1 day, +3 days, +5 days.
  if (finalStage === "follow_up" && lead.assignedUserId) {
    const pendingCount = await db
      .collection(FOLLOW_UPS)
      .countDocuments({ leadId: id, status: "pending" });
    if (pendingCount === 0) {
      const followUpStartAt =
        typeof data.followUpStartAt === "string" ? data.followUpStartAt : "";
      const baseDate = new Date(followUpStartAt);
      if (!followUpStartAt || Number.isNaN(baseDate.getTime())) {
        return NextResponse.json(
          { error: "followUpStartAt is required for follow-up scheduling" },
          { status: 400 },
        );
      }

      const scheduleDates = [
        addHours(baseDate, 6),
        addDays(baseDate, 1),
        addDays(baseDate, 3),
        addDays(baseDate, 5),
      ];
      const followUpDocs: FollowUpDoc[] = scheduleDates.map((scheduledAt) => ({
        id: generateRandomUUID(),
        leadId: id,
        assignedUserId: lead.assignedUserId!,
        scheduledAt,
        status: "pending",
        createdAt: now,
      }));
      await db.collection(FOLLOW_UPS).insertMany(followUpDocs);
    }
  }

  return NextResponse.json(updated);
}
