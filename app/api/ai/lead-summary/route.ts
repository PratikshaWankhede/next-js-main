import { regenerateLeadSummary } from "@/lib/ai/lead-summary";
import { checkRateLimit } from "@/lib/ai/rate-limit";
import { canAccessLead, getSessionWithRole, requireAuth } from "@/lib/rbac";
import { db } from "@/db";
import { LEADS } from "@/db/collections";
import type { LeadDoc } from "@/db/collections";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const session = await getSessionWithRole();
  requireAuth(session);

  if (!checkRateLimit(session.user.id)) {
    return NextResponse.json({
      summary: "",
      error: "Rate limit exceeded. Try again in a minute.",
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data = body as { leadId?: string };
  const leadId = data.leadId;

  if (typeof leadId !== "string" || !leadId.trim()) {
    return NextResponse.json({ error: "leadId is required" }, { status: 400 });
  }

  const lead = await db.collection<LeadDoc>(LEADS).findOne({ id: leadId });
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  if (!canAccessLead(session, lead)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const summary = await regenerateLeadSummary(leadId);
    return NextResponse.json({ summary });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "AI request failed. Check your API key.";
    return NextResponse.json({ summary: "", error: message });
  }
}
