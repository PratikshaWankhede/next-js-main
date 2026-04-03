import { db } from "@/db";
import { LEAD_REASSIGNMENT_LOGS, LEADS, USER } from "@/db/collections";
import type {
  LeadDoc,
  LeadReassignmentLogDoc,
  RoleOwner,
  UserDoc,
} from "@/db/collections";
import { createNotification } from "@/lib/notifications/create-notification";
import { getSessionWithRole, requireAdmin, requireAuth } from "@/lib/rbac";
import { generateRandomUUID } from "@/helpers/generate-random-uuid";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionWithRole();
  requireAuth(session);
  requireAdmin(session);

  const { id } = await params;

  const lead = await db.collection<LeadDoc>(LEADS).findOne({ id });
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data = body as Record<string, unknown>;
  const toUserId = data.toUserId;
  const reason = data.reason;

  if (typeof toUserId !== "string" || !toUserId.trim()) {
    return NextResponse.json(
      { error: "toUserId is required" },
      { status: 400 },
    );
  }

  if (typeof reason !== "string" || !reason.trim()) {
    return NextResponse.json({ error: "Reason is required" }, { status: 400 });
  }

  const targetUser = await db
    .collection<UserDoc>(USER)
    .findOne({ id: toUserId.trim() });
  if (!targetUser) {
    return NextResponse.json(
      { error: "Target user not found" },
      { status: 400 },
    );
  }

  const fromUserId = lead.assignedUserId ?? session.user.id;
  const now = new Date();
  const targetRole = targetUser.role as string;
  const roleOwner: RoleOwner | null =
    targetRole === "follow_up_candidate"
      ? "follow_up_candidate"
      : targetRole === "sales"
        ? "sales"
        : null;

  await db
    .collection<LeadReassignmentLogDoc>(LEAD_REASSIGNMENT_LOGS)
    .insertOne({
      id: generateRandomUUID(),
      leadId: id,
      fromUserId,
      toUserId: targetUser.id,
      reason: String(reason).trim(),
      changedByAdminId: session.user.id,
      changedAt: now,
    });

  const leadUpdates: Record<string, unknown> = {
    assignedUserId: targetUser.id,
    updatedAt: now,
  };
  if (roleOwner !== null) {
    leadUpdates.roleOwner = roleOwner;
  }
  await db.collection(LEADS).updateOne({ id }, { $set: leadUpdates });
  const updated = {
    ...lead,
    ...leadUpdates,
    assignedUserId: targetUser.id,
    updatedAt: now,
  };

  if (fromUserId !== targetUser.id) {
    await createNotification({
      type: "reassigned",
      title: "Lead Reassigned",
      body: `${lead.name} reassigned from you`,
      leadId: id,
      targetUserIds: [fromUserId],
    });
    await createNotification({
      type: "reassigned",
      title: "Lead Reassigned",
      body: `${lead.name} assigned to you`,
      leadId: id,
      targetUserIds: [targetUser.id],
    });
  }

  return NextResponse.json(updated);
}
