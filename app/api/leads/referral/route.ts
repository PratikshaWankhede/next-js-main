import { db } from "@/db";
import { LEADS } from "@/db/collections";
import type { LeadDoc } from "@/db/collections";
import { canAccessLead, getSessionWithRole, requireAuth } from "@/lib/rbac";
import { generateRandomUUID } from "@/helpers/generate-random-uuid";
import { NextRequest, NextResponse } from "next/server";

const E164_REGEX = /^\+[1-9]\d{6,14}$/;

function normalizePhone(phone: string): string {
  const s = String(phone).replace(/\s/g, "").trim();
  return s.startsWith("+") ? s : `+${s}`;
}

export async function POST(req: NextRequest) {
  const session = await getSessionWithRole();
  requireAuth(session);

  if (
    session.role !== "admin" &&
    session.role !== "sales" &&
    session.role !== "follow_up_candidate"
  ) {
    return NextResponse.json(
      { error: "Only admin, sales, or follow-up candidate can create referral leads" },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data = body as Record<string, unknown>;
  const parentLeadId = data.parentLeadId;
  const name = data.name;
  const phone = data.phone;

  if (typeof parentLeadId !== "string" || !parentLeadId.trim()) {
    return NextResponse.json(
      { error: "parentLeadId is required" },
      { status: 400 },
    );
  }
  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (typeof phone !== "string" || !phone.trim()) {
    return NextResponse.json({ error: "phone is required" }, { status: 400 });
  }

  const phoneStr = normalizePhone(phone);
  if (!E164_REGEX.test(phoneStr)) {
    return NextResponse.json(
      { error: "phone must be a valid E.164 number" },
      { status: 400 },
    );
  }

  const leadsCol = db.collection<LeadDoc>(LEADS);
  const parent = await leadsCol.findOne({ id: parentLeadId.trim() });
  if (!parent) {
    return NextResponse.json({ error: "Parent lead not found" }, { status: 404 });
  }
  if (parent.exitedFromCrmAt) {
    return NextResponse.json({ error: "Parent lead not found" }, { status: 404 });
  }
  if (!canAccessLead(session, parent)) {
    return NextResponse.json(
      { error: "You do not have access to this lead" },
      { status: 403 },
    );
  }
  if (parent.referralGenerated) {
    return NextResponse.json(
      { error: "A referral has already been created for this lead" },
      { status: 400 },
    );
  }

  const existing = await leadsCol.findOne({ phone: phoneStr });
  if (existing) {
    return NextResponse.json(
      { error: "Phone number already exists" },
      { status: 409 },
    );
  }

  const now = new Date();
  const roleOwner =
    session.role === "sales"
      ? ("sales" as const)
      : session.role === "follow_up_candidate"
        ? ("follow_up_candidate" as const)
        : null;
  const newLead: LeadDoc = {
    id: generateRandomUUID(),
    name: name.trim(),
    phone: phoneStr,
    source: "referral",
    stage: "new",
    assignedUserId: session.user.id,
    createdAt: now,
    updatedAt: now,
    slaStatus: "pending",
    recoveryCycle: 0,
    parentLeadId: parent.id,
    ...(roleOwner && { roleOwner }),
  };
  await leadsCol.insertOne(newLead);

  const { appendLeadTimelineEvent } = await import("@/lib/lead-timeline");
  await appendLeadTimelineEvent(newLead.id, "lead_created", {
    source: "referral",
    parentLeadId: parent.id,
  });

  await leadsCol.updateOne(
    { id: parent.id },
    {
      $set: {
        referralGenerated: true,
        referralLeadId: newLead.id,
        updatedAt: now,
      },
    },
  );

  return NextResponse.json(newLead, { status: 201 });
}
