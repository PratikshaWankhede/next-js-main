import { db } from "@/db";
import { NOTIFICATIONS } from "@/db/collections";
import type { NotificationDoc } from "@/db/collections";
import { getSessionWithRole, requireAuth } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";

const VALID_TYPES = [
  "sla_breach",
  "follow_up_missed",
  "new_inbound",
  "reassigned",
] as const;

export async function GET(req: NextRequest) {
  const session = await getSessionWithRole();
  requireAuth(session);

  const { searchParams } = new URL(req.url);
  const unread = searchParams.get("unread");
  const type = searchParams.get("type");
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 50, 100) : 50;

  const filter: Record<string, unknown> = { userId: session.user.id };
  if (unread === "true") filter.isRead = false;
  if (type && VALID_TYPES.includes(type as (typeof VALID_TYPES)[number])) {
    filter.type = type;
  }

  const result = await db
    .collection<NotificationDoc>(NOTIFICATIONS)
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();

  return NextResponse.json({ notifications: result });
}
