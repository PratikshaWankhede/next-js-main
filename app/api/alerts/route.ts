import { db } from "@/db";
import { ALERTS, LEADS } from "@/db/collections";
import type { AlertDoc, LeadDoc } from "@/db/collections";
import { getSessionWithRole, requireAuth, requireAdmin } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await getSessionWithRole();
  requireAuth(session);
  requireAdmin(session);

  const { searchParams } = new URL(req.url);
  const unread = searchParams.get("unread");
  const type = searchParams.get("type");

  const filter: Record<string, unknown> = {};
  if (unread === "true") filter.isRead = false;
  if (type === "sla_breach" || type === "follow_up_missed") filter.type = type;

  const alertsResult = await db
    .collection<AlertDoc>(ALERTS)
    .find(filter)
    .sort({ createdAt: -1 })
    .toArray();

  const leadIds = [...new Set(alertsResult.map((a) => a.leadId))];
  const leadsList =
    leadIds.length > 0
      ? await db
          .collection<LeadDoc>(LEADS)
          .find({ id: { $in: leadIds } })
          .toArray()
      : [];
  const leadMap = new Map(leadsList.map((l) => [l.id, l.name]));

  return NextResponse.json({
    alerts: alertsResult.map((a) => ({
      id: a.id,
      type: a.type,
      leadId: a.leadId,
      leadName: leadMap.get(a.leadId) ?? null,
      message: a.message,
      isRead: a.isRead,
      createdAt: a.createdAt,
    })),
  });
}
