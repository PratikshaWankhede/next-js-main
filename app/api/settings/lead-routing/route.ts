import { db } from "@/db";
import {
  LEAD_ROUTING_RULES,
  USER,
  type LeadRoutingRuleDoc,
  type UserDoc,
} from "@/db/collections";
import { getSessionWithRole, requireAdmin, requireAuth } from "@/lib/rbac";
import { generateRandomUUID } from "@/helpers/generate-random-uuid";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const session = await getSessionWithRole();
  requireAuth(session);
  requireAdmin(session);

  const col = db.collection<LeadRoutingRuleDoc>(LEAD_ROUTING_RULES);
  const rules = await col.find({}).sort({ createdAt: -1 }).toArray();

  const userIds = Array.from(
    new Set(rules.map((r) => r.assignedUserId).filter(Boolean)),
  ) as string[];

  const userMap = new Map<string, Pick<UserDoc, "id" | "name" | "email">>();
  if (userIds.length > 0) {
    const users = await db
      .collection<UserDoc>(USER)
      .find({ id: { $in: userIds } })
      .project({ id: 1, name: 1, email: 1 })
      .toArray();
    for (const u of users) {
      userMap.set(u.id, { id: u.id, name: u.name, email: u.email });
    }
  }

  const result = rules.map((r) => ({
    id: r.id,
    source: r.source,
    whatsappPhoneNumberId: r.whatsappPhoneNumberId ?? null,
    instagramScope: r.instagramScope ?? null,
    assignedUserId: r.assignedUserId,
    user: userMap.get(r.assignedUserId) ?? null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));

  return NextResponse.json({ rules: result });
}

export async function POST(req: NextRequest) {
  const session = await getSessionWithRole();
  requireAuth(session);
  requireAdmin(session);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data = body as Record<string, unknown>;
  const source = data.source;
  const assignedUserId = data.assignedUserId;
  const whatsappPhoneNumberId = data.whatsappPhoneNumberId;

  if (source !== "whatsapp" && source !== "instagram") {
    return NextResponse.json({ error: "Invalid source" }, { status: 400 });
  }
  if (typeof assignedUserId !== "string" || !assignedUserId) {
    return NextResponse.json(
      { error: "assignedUserId is required" },
      { status: 400 },
    );
  }

  const userCol = db.collection<UserDoc>(USER);
  const user = await userCol.findOne({
    id: assignedUserId,
    role: "sales",
    $or: [{ banned: { $ne: true } }, { banned: { $exists: false } }],
  });
  if (!user) {
    return NextResponse.json(
      { error: "Assigned user must be an active sales user" },
      { status: 400 },
    );
  }

  let normalizedWhatsappPhoneNumberId: string | null = null;
  if (source === "whatsapp") {
    if (
      whatsappPhoneNumberId !== undefined &&
      whatsappPhoneNumberId !== null &&
      typeof whatsappPhoneNumberId !== "string"
    ) {
      return NextResponse.json(
        { error: "whatsappPhoneNumberId must be a string" },
        { status: 400 },
      );
    }
    normalizedWhatsappPhoneNumberId =
      typeof whatsappPhoneNumberId === "string" &&
      whatsappPhoneNumberId.trim().length > 0
        ? whatsappPhoneNumberId.trim()
        : null;
  }

  const col = db.collection<LeadRoutingRuleDoc>(LEAD_ROUTING_RULES);

  if (source === "whatsapp") {
    const existing = await col.findOne({
      source: "whatsapp",
      whatsappPhoneNumberId: normalizedWhatsappPhoneNumberId,
    });
    if (existing) {
      return NextResponse.json(
        { error: "A rule for this WhatsApp scope already exists" },
        { status: 409 },
      );
    }
  }

  if (source === "instagram") {
    const existing = await col.findOne({
      source: "instagram",
      $or: [
        { instagramScope: "default" },
        { instagramScope: { $exists: false } },
        { instagramScope: null },
      ],
    });
    if (existing) {
      return NextResponse.json(
        { error: "An Instagram routing rule already exists" },
        { status: 409 },
      );
    }
  }

  const now = new Date();
  const id = generateRandomUUID();

  const doc: LeadRoutingRuleDoc = {
    id,
    source,
    whatsappPhoneNumberId:
      source === "whatsapp" ? normalizedWhatsappPhoneNumberId : null,
    instagramScope: source === "instagram" ? "default" : null,
    assignedUserId,
    createdAt: now,
    updatedAt: now,
  };

  await col.insertOne(doc);

  return NextResponse.json(
    {
      id: doc.id,
      source: doc.source,
      whatsappPhoneNumberId: doc.whatsappPhoneNumberId,
      instagramScope: doc.instagramScope,
      assignedUserId: doc.assignedUserId,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    },
    { status: 201 },
  );
}

export async function DELETE(req: NextRequest) {
  const session = await getSessionWithRole();
  requireAuth(session);
  requireAdmin(session);

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const col = db.collection<LeadRoutingRuleDoc>(LEAD_ROUTING_RULES);
  const result = await col.deleteOne({ id });
  if (result.deletedCount === 0) {
    return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

