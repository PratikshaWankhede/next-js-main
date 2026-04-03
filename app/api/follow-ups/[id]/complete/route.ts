import { db } from "@/db";
import { FOLLOW_UPS } from "@/db/collections";
import type { FollowUpDoc } from "@/db/collections";
import { getSessionWithRole, requireAuth } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionWithRole();
  requireAuth(session);

  const { id } = await params;

  const followUp = await db.collection<FollowUpDoc>(FOLLOW_UPS).findOne({ id });
  if (!followUp) {
    return NextResponse.json({ error: "Follow-up not found" }, { status: 404 });
  }

  if (
    (session.role === "sales" || session.role === "follow_up_candidate") &&
    followUp.assignedUserId !== session.user.id
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (followUp.status !== "pending") {
    return NextResponse.json(
      { error: "Follow-up is not pending" },
      { status: 400 },
    );
  }

  let note = followUp.note ?? null;
  try {
    const body = (await req.json()) as { note?: string };
    if (typeof body.note === "string") {
      note = body.note.trim() || null;
    }
  } catch {
    // ignore invalid body
  }

  const now = new Date();
  await db.collection(FOLLOW_UPS).updateOne(
    { id },
    {
      $set: {
        status: "completed",
        completedAt: now,
        note,
      },
    },
  );
  const updated = {
    ...followUp,
    status: "completed" as const,
    completedAt: now,
    note,
  };

  return NextResponse.json(updated);
}
