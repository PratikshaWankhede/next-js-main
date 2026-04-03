import { db } from "@/db";
import { LEADS } from "@/db/collections";
import type { LeadDoc } from "@/db/collections";
import {
  canAccessLead,
  getSessionWithRole,
  requireAuth,
} from "@/lib/rbac";
import { sendBookingMessageForLead } from "@/lib/booking-messages";
import { appendLeadTimelineEvent } from "@/lib/lead-timeline";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionWithRole();
  requireAuth(session);

  const { id } = await params;

  const leadsCol = db.collection<LeadDoc>(LEADS);
  const lead = await leadsCol.findOne({ id });

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  if (!canAccessLead(session, lead)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (lead.exitedFromCrmAt) {
    return NextResponse.json(
      { error: "Lead has been exited from CRM and cannot be booked" },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data = body as {
    appointmentDate?: string;
    advanceAmount?: number;
    artistName?: string;
  };

  if (!data.appointmentDate || typeof data.appointmentDate !== "string") {
    return NextResponse.json(
      { error: "appointmentDate (ISO string) is required" },
      { status: 400 },
    );
  }

  const appointmentDate = new Date(data.appointmentDate);
  if (Number.isNaN(appointmentDate.getTime())) {
    return NextResponse.json(
      { error: "appointmentDate must be a valid ISO date string" },
      { status: 400 },
    );
  }

  if (
    data.advanceAmount === undefined ||
    typeof data.advanceAmount !== "number" ||
    Number.isNaN(data.advanceAmount) ||
    data.advanceAmount < 0
  ) {
    return NextResponse.json(
      { error: "advanceAmount must be a non-negative number" },
      { status: 400 },
    );
  }

  const artistName =
    typeof data.artistName === "string" && data.artistName.trim().length > 0
      ? data.artistName.trim()
      : null;

  const now = new Date();

  const updates: Partial<LeadDoc> = {
    appointmentDate,
    advanceAmount: data.advanceAmount,
    artistName,
    updatedAt: now,
  };

  const isReschedule = Boolean(lead.isNoShow);
  if (lead.isNoShow) {
    updates.isNoShow = false;
    updates.noShowAt = null;
  }

  // Infer booking channel for reporting purposes.
  if (lead.whatsappPhone || lead.source === "whatsapp") {
    updates.bookingChannel = "whatsapp";
  } else if (lead.instagramUserId || lead.source === "instagram") {
    updates.bookingChannel = "instagram";
  } else {
    updates.bookingChannel = "manual";
  }

  // Save booking only; do not auto-move to done. User selects "done" or "lost" from Change stage dropdown.
  await leadsCol.updateOne({ id: lead.id }, { $set: updates });
  const updated: LeadDoc = {
    ...lead,
    ...updates,
  };

  await appendLeadTimelineEvent(
    lead.id,
    isReschedule ? "reschedule" : lead.appointmentDate ? "booking_updated" : "booking_created",
    {
      appointmentDate: appointmentDate.toISOString(),
      ...(isReschedule && { wasNoShow: true }),
    },
    session.user.id,
  );

  // Best-effort: send booking confirmation via WhatsApp / Instagram if possible.
  try {
    const sent = await sendBookingMessageForLead(updated, "confirmation", {
      triggeredByUserId: session.user.id,
      triggeredByRole: session.role === "admin" ? "admin" : "sales",
    });
    if (sent) {
      await leadsCol.updateOne(
        { id: lead.id },
        { $set: { bookingConfirmationSentAt: now } },
      );
    }
  } catch {
    // Swallow errors to avoid breaking the main booking flow.
  }

  return NextResponse.json(updated);
}

