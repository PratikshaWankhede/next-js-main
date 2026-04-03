import { db } from "@/db";
import { FOLLOW_UPS, LEADS } from "@/db/collections";
import type { FollowUpDoc, LeadDoc } from "@/db/collections";
import { canAccessLead, getSessionWithRole, requireAuth } from "@/lib/rbac";
import { addDays, endOfDay, startOfDay } from "date-fns";
import { generateRandomUUID } from "@/helpers/generate-random-uuid";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await getSessionWithRole();
  requireAuth(session);

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as
    | "pending"
    | "completed"
    | "missed"
    | null;
  const scope = searchParams.get("scope") as
    | "today"
    | "overdue"
    | "upcoming"
    | null;
  const leadId = searchParams.get("leadId");
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  const filter: Record<string, unknown> = {};
  if (session.role === "sales" || session.role === "follow_up_candidate") {
    filter.assignedUserId = session.user.id;
  }
  if (status && ["pending", "completed", "missed"].includes(status)) {
    filter.status = status;
  }
  if (leadId) {
    filter.leadId = leadId;
  }

  const now = new Date();
  if (fromParam && toParam) {
    filter.scheduledAt = {
      $gte: startOfDay(new Date(fromParam)),
      $lte: endOfDay(new Date(toParam)),
    };
  } else if (scope === "today") {
    filter.scheduledAt = {
      $gte: startOfDay(now),
      $lte: endOfDay(now),
    };
  } else if (scope === "overdue") {
    filter.scheduledAt = { $lt: startOfDay(now) };
  } else if (scope === "upcoming") {
    filter.scheduledAt = { $gte: addDays(startOfDay(now), 1) };
  }

  const followUpsCol = db.collection<FollowUpDoc>(FOLLOW_UPS);
  const result = await followUpsCol
    .find(filter)
    .sort({ scheduledAt: 1 })
    .toArray();

  const leadIds = [...new Set(result.map((r) => r.leadId))];
  const leadsCol = db.collection<LeadDoc>(LEADS);
  const leadsList = await leadsCol.find({ id: { $in: leadIds } }).toArray();
  const leadMap = new Map(leadsList.map((l) => [l.id, l]));

  const followUpsWithLead = result.map((r) => {
    const lead = leadMap.get(r.leadId);
    return {
      id: r.id,
      leadId: r.leadId,
      assignedUserId: r.assignedUserId,
      scheduledAt: r.scheduledAt,
      completedAt: r.completedAt,
      status: r.status,
      note: r.note,
      createdAt: r.createdAt,
      lead: lead
        ? { id: lead.id, name: lead.name, phone: lead.phone, stage: lead.stage }
        : { id: r.leadId, name: "", phone: "", stage: "new" as const },
    };
  });

  return NextResponse.json({ followUps: followUpsWithLead });
}

export async function POST(req: NextRequest) {
  const session = await getSessionWithRole();
  requireAuth(session);

  let body: { leadId?: string; scheduledAt?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { leadId, scheduledAt, note } = body;

  if (!leadId || typeof leadId !== "string") {
    return NextResponse.json({ error: "leadId is required" }, { status: 400 });
  }

  if (!scheduledAt || typeof scheduledAt !== "string") {
    return NextResponse.json(
      { error: "scheduledAt is required (ISO date string)" },
      { status: 400 },
    );
  }

  const scheduledDate = new Date(scheduledAt);
  if (Number.isNaN(scheduledDate.getTime())) {
    return NextResponse.json(
      { error: "scheduledAt must be a valid date" },
      { status: 400 },
    );
  }

  const lead = await db.collection<LeadDoc>(LEADS).findOne({ id: leadId });
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  if (!canAccessLead(session, lead)) {
    return NextResponse.json(
      { error: "You do not have access to this lead" },
      { status: 403 },
    );
  }

  const now = new Date();
  const inserted: FollowUpDoc = {
    id: generateRandomUUID(),
    leadId,
    assignedUserId: session.user.id,
    scheduledAt: scheduledDate,
    status: "pending",
    note: note?.trim() || null,
    createdAt: now,
  };
  await db.collection(FOLLOW_UPS).insertOne(inserted);

  return NextResponse.json(inserted, { status: 201 });
}
