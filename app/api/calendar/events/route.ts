import { db } from "@/db";
import {
  FOLLOW_UPS,
  LEAD_STAGE_HISTORY,
  LEADS,
  SLA_LOGS,
} from "@/db/collections";
import type {
  FollowUpDoc,
  LeadDoc,
  LeadStageHistoryDoc,
  SlaLogDoc,
} from "@/db/collections";
import { getSessionWithRole, requireAuth } from "@/lib/rbac";
import { endOfDay, startOfDay } from "date-fns";
import { NextRequest, NextResponse } from "next/server";

export type CalendarEventType =
  | "follow-up"
  | "new_lead"
  | "stage_change"
  | "sla_breached"
  | "booking";

export interface CalendarEventResponse {
  id: string;
  type: CalendarEventType;
  date: string;
  title: string;
  leadId: string;
  leadName: string;
  status?: "pending" | "completed" | "missed";
  metadata?: Record<string, unknown>;
}

export async function GET(req: NextRequest) {
  const session = await getSessionWithRole();
  requireAuth(session);

  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  if (!fromParam || !toParam) {
    return NextResponse.json(
      { error: "from and to query params (ISO date) are required" },
      { status: 400 },
    );
  }

  const fromDate = startOfDay(new Date(fromParam));
  const toDate = endOfDay(new Date(toParam));

  const events: CalendarEventResponse[] = [];

  const leadFilter: Record<string, unknown> =
    session.role === "sales" || session.role === "follow_up_candidate"
      ? { assignedUserId: session.user.id }
      : {};

  const followUpFilter: Record<string, unknown> = {
    scheduledAt: { $gte: fromDate, $lte: toDate },
  };
  if (session.role === "sales" || session.role === "follow_up_candidate") {
    followUpFilter.assignedUserId = session.user.id;
  }

  const followUpsCol = db.collection<FollowUpDoc>(FOLLOW_UPS);
  const leadsCol = db.collection<LeadDoc>(LEADS);
  const followUpsResult = await followUpsCol
    .find(followUpFilter)
    .sort({ scheduledAt: 1 })
    .toArray();

  const followUpLeadIds = [...new Set(followUpsResult.map((r) => r.leadId))];
  const followUpLeads =
    followUpLeadIds.length > 0
      ? await leadsCol.find({ id: { $in: followUpLeadIds } }).toArray()
      : [];
  const followUpLeadMap = new Map(followUpLeads.map((l) => [l.id, l]));

  for (const r of followUpsResult) {
    const lead = followUpLeadMap.get(r.leadId);
    events.push({
      id: r.id,
      type: "follow-up",
      date: r.scheduledAt.toISOString(),
      title: `Follow-up: ${lead?.name ?? ""}`,
      leadId: r.leadId,
      leadName: lead?.name ?? "",
      status: r.status,
      metadata: {},
    });
  }

  const newLeadFilter: Record<string, unknown> = {
    createdAt: { $gte: fromDate, $lte: toDate },
    ...leadFilter,
  };
  const newLeadsResult = await leadsCol
    .find(newLeadFilter)
    .sort({ createdAt: 1 })
    .toArray();

  for (const r of newLeadsResult) {
    events.push({
      id: `lead-${r.id}`,
      type: "new_lead",
      date: r.createdAt.toISOString(),
      title: `New lead: ${r.name}`,
      leadId: r.id,
      leadName: r.name,
      metadata: {},
    });
  }

  const stageHistoryCol =
    db.collection<LeadStageHistoryDoc>(LEAD_STAGE_HISTORY);
  const stageHistoryResult = await stageHistoryCol
    .find({
      changedAt: { $gte: fromDate, $lte: toDate },
    })
    .sort({ changedAt: 1 })
    .toArray();

  const stageLeadIds = [...new Set(stageHistoryResult.map((r) => r.leadId))];
  const stageLeads =
    stageLeadIds.length > 0
      ? await leadsCol.find({ id: { $in: stageLeadIds } }).toArray()
      : [];
  const stageLeadMap = new Map(stageLeads.map((l) => [l.id, l]));

  for (const r of stageHistoryResult) {
    const lead = stageLeadMap.get(r.leadId);
    if (
        (session.role === "sales" || session.role === "follow_up_candidate") &&
        lead?.assignedUserId !== session.user.id
      ) {
      continue;
    }
    events.push({
      id: `stage-${r.id}`,
      type: "stage_change",
      date: r.changedAt.toISOString(),
      title: `Stage: ${lead?.name ?? ""} → ${r.toStage}`,
      leadId: r.leadId,
      leadName: lead?.name ?? "",
      metadata: { fromStage: r.fromStage, toStage: r.toStage },
    });
  }

  const slaCol = db.collection<SlaLogDoc>(SLA_LOGS);
  const slaResult = await slaCol
    .find({
      breachedAt: { $gte: fromDate, $lte: toDate },
    })
    .sort({ breachedAt: 1 })
    .toArray();

  const slaLeadIds = [...new Set(slaResult.map((r) => r.leadId))];
  const slaLeads =
    slaLeadIds.length > 0
      ? await leadsCol.find({ id: { $in: slaLeadIds } }).toArray()
      : [];
  const slaLeadMap = new Map(slaLeads.map((l) => [l.id, l]));

  for (const r of slaResult) {
    const lead = slaLeadMap.get(r.leadId);
    if (
        (session.role === "sales" || session.role === "follow_up_candidate") &&
        lead?.assignedUserId !== session.user.id
      ) {
      continue;
    }
    events.push({
      id: `sla-${r.id}`,
      type: "sla_breached",
      date: r.breachedAt.toISOString(),
      title: `SLA breached: ${lead?.name ?? ""}`,
      leadId: r.leadId,
      leadName: lead?.name ?? "",
      metadata: { slaType: r.type },
    });
  }

  // Booking events based on appointmentDate
  const bookingFilter: Record<string, unknown> = {
    appointmentDate: { $gte: fromDate, $lte: toDate },
    ...leadFilter,
  };
  const bookingLeads = await leadsCol
    .find(bookingFilter)
    .sort({ appointmentDate: 1 })
    .toArray();

  for (const lead of bookingLeads) {
    if (!lead.appointmentDate) continue;
    events.push({
      id: `booking-${lead.id}`,
      type: "booking",
      date: lead.appointmentDate.toISOString(),
      title: `Booking: ${lead.name}`,
      leadId: lead.id,
      leadName: lead.name,
      metadata: {
        appointmentDate: lead.appointmentDate,
        advanceAmount: lead.advanceAmount ?? null,
      },
    });
  }

  events.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  return NextResponse.json({ events });
}
