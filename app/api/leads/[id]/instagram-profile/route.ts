import { db } from "@/db";
import { LEADS } from "@/db/collections";
import type { LeadDoc } from "@/db/collections";
import { enrichLeadInstagramProfile } from "@/lib/instagram-lead-profile";
import { canAccessLead, getSessionWithRole, requireAuth } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
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

  if (lead.source !== "instagram" || !lead.instagramUserId) {
    return NextResponse.json(
      { error: "Not an Instagram lead" },
      { status: 400 },
    );
  }

  const updated = await enrichLeadInstagramProfile(id);
  if (!updated) {
    return NextResponse.json(
      { ok: false, reason: "no_update" },
      { status: 200 },
    );
  }

  const changed =
    updated.name !== lead.name ||
    updated.instagramUsername !== lead.instagramUsername;

  return NextResponse.json({
    ok: true,
    updated: changed,
    lead: {
      id: updated.id,
      name: updated.name,
      instagramUsername: updated.instagramUsername ?? null,
    },
  });
}
