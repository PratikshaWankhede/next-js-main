import { db } from "@/db";
import { NOTIFICATIONS } from "@/db/collections";
import type { NotificationDoc } from "@/db/collections";
import { getSessionWithRole, requireAuth } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionWithRole();
  requireAuth(session);

  const { id } = await params;

  const notification = await db
    .collection<NotificationDoc>(NOTIFICATIONS)
    .findOne({ id, userId: session.user.id });

  if (!notification) {
    return NextResponse.json(
      { error: "Notification not found" },
      { status: 404 },
    );
  }

  await db
    .collection(NOTIFICATIONS)
    .updateOne({ id, userId: session.user.id }, { $set: { isRead: true } });
  const updated = { ...notification, isRead: true };

  return NextResponse.json(updated);
}
