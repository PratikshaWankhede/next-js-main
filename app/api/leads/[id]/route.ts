import { db } from "@/db";
import {
  LEAD_COMMENTS,
  LEAD_STAGE_HISTORY,
  LEAD_TIMELINE,
  LEADS,
  USER,
} from "@/db/collections";
import type {
  LeadCommentDoc,
  LeadDoc,
  LeadStageHistoryDoc,
  LeadTimelineDoc,
  UserDoc,
} from "@/db/collections";
import { canAccessLead, getSessionWithRole, requireAuth } from "@/lib/rbac";
import {
  LEAD_SOURCES,
  type LeadSource,
} from "@/features/leads/types/lead.types";
import type { ReviewStatus, RevenueTag } from "@/db/collections";
import { deriveRevenueTag } from "@/lib/revenue-tag";
import { NextRequest, NextResponse } from "next/server";

const REVIEW_STATUSES: ReviewStatus[] = [
  "not_started",
  "review_sent",
  "review_submitted",
  "reminder_1",
  "reminder_2",
  "closed",
];
const REVENUE_TAGS: RevenueTag[] = ["S", "A", "B", "C"];

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionWithRole();
  requireAuth(session);

  const { id } = await params;

  const lead = await db.collection<LeadDoc>(LEADS).findOne({ id });
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }
  if (lead.exitedFromCrmAt) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  if (!canAccessLead(session, lead)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [stageHistory, timeline, comments] = await Promise.all([
    db
      .collection<LeadStageHistoryDoc>(LEAD_STAGE_HISTORY)
      .find({ leadId: id })
      .sort({ changedAt: 1 })
      .toArray(),
    db
      .collection<LeadTimelineDoc>(LEAD_TIMELINE)
      .find({ leadId: id })
      .sort({ createdAt: 1 })
      .toArray(),
    db
      .collection<LeadCommentDoc>(LEAD_COMMENTS)
      .find({ leadId: id })
      .sort({ createdAt: -1 })
      .toArray(),
  ]);

  const userIds = new Set<string>();
  if (lead.assignedUserId) userIds.add(lead.assignedUserId);
  for (const item of timeline) {
    if (item.userId) userIds.add(item.userId);
  }
  for (const comment of comments) {
    userIds.add(comment.createdByUserId);
  }

  const users = userIds.size
    ? await db
        .collection<UserDoc>(USER)
        .find({ id: { $in: Array.from(userIds) } })
        .toArray()
    : [];
  const usersById = new Map(users.map((user) => [user.id, user]));

  const assignedUserDoc = lead.assignedUserId
    ? (usersById.get(lead.assignedUserId) ?? null)
    : null;
  const assignedUser = assignedUserDoc
    ? {
        id: assignedUserDoc.id,
        name: assignedUserDoc.name,
        email: assignedUserDoc.email,
      }
    : null;

  const leadComments = comments.map((comment) => {
    const author = usersById.get(comment.createdByUserId);
    return {
      ...comment,
      author: author
        ? {
            id: author.id,
            name: author.name,
            email: author.email,
            role: author.role,
          }
        : {
            id: comment.createdByUserId,
            name: "Unknown user",
            email: "",
            role: comment.createdByRole,
          },
    };
  });

  const timelineWithActors = timeline.map((item) => {
    const actor = item.userId ? usersById.get(item.userId) : null;
    return {
      ...item,
      actor: actor
        ? {
            id: actor.id,
            name: actor.name,
            email: actor.email,
            role: actor.role,
          }
        : null,
    };
  });

  return NextResponse.json({
    ...lead,
    stageHistory,
    timeline: timelineWithActors,
    comments: leadComments,
    assignedUser,
  });
}

const patchSchema = {
  name: (v: unknown) => typeof v === "string" && v.trim().length > 0,
  customName: (v: unknown) => typeof v === "string" && v.trim().length > 0,
  source: (v: unknown) =>
    typeof v === "string" && LEAD_SOURCES.includes(v as LeadSource),
};

export async function PATCH(
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
  const now = new Date();
  const updates: Record<string, unknown> = { updatedAt: now };

  if (data.name !== undefined) {
    if (!patchSchema.name(data.name)) {
      return NextResponse.json(
        { error: "Name must be a non-empty string" },
        { status: 400 },
      );
    }
    updates.name = String(data.name).trim();
  }

  if (data.customName !== undefined) {
    if (data.customName === null || data.customName === "") {
      updates.customName = null;
    } else if (!patchSchema.customName(data.customName)) {
      return NextResponse.json(
        { error: "Custom name must be a non-empty string" },
        { status: 400 },
      );
    } else {
      updates.customName = String(data.customName).trim();
    }
  }

  if (data.source !== undefined) {
    if (!patchSchema.source(data.source)) {
      return NextResponse.json({ error: "Invalid source" }, { status: 400 });
    }
    updates.source = data.source as LeadSource;
  }

  if (data.estimatedAmount !== undefined) {
    const val = data.estimatedAmount;
    if (val === null) {
      updates.estimatedAmount = null;
    } else if (typeof val === "number" && !Number.isNaN(val)) {
      updates.estimatedAmount = val;
      if (data.revenueTag === undefined && updates.revenueTag === undefined) {
        updates.revenueTag = deriveRevenueTag(val);
      }
    }
  }

  if (data.revenueTag !== undefined) {
    if (
      typeof data.revenueTag === "string" &&
      REVENUE_TAGS.includes(data.revenueTag as RevenueTag)
    ) {
      updates.revenueTag = data.revenueTag as RevenueTag;
    } else if (data.revenueTag === null) {
      updates.revenueTag = null;
    }
  }

  if (data.reviewStatus !== undefined) {
    if (
      typeof data.reviewStatus === "string" &&
      REVIEW_STATUSES.includes(data.reviewStatus as ReviewStatus)
    ) {
      updates.reviewStatus = data.reviewStatus as ReviewStatus;
    } else if (data.reviewStatus === null) {
      updates.reviewStatus = null;
    }
  }

  if (data.noShowFollowUpUntil !== undefined) {
    if (data.noShowFollowUpUntil === null || data.noShowFollowUpUntil === "") {
      updates.noShowFollowUpUntil = null;
    } else if (typeof data.noShowFollowUpUntil === "string") {
      const parsed = new Date(data.noShowFollowUpUntil);
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json(
          { error: "noShowFollowUpUntil must be a valid ISO date string" },
          { status: 400 },
        );
      }
      updates.noShowFollowUpUntil = parsed;
    }
  }

  if (Object.keys(updates).length === 1) {
    return NextResponse.json(lead);
  }

  await db.collection(LEADS).updateOne({ id }, { $set: updates });
  const updated = { ...lead, ...updates };
  return NextResponse.json(updated);
}
