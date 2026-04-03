import { db } from "@/db";
import { LEADS, TATTOO_TYPES, USER } from "@/db/collections";
import type { LeadDoc, LeadSource, UserDoc } from "@/db/collections";
import { getSessionWithRole, requireAuth } from "@/lib/rbac";
import {
  LEAD_SOURCES,
  type LeadSource as LeadSourceType,
} from "@/features/leads/types/lead.types";
import { generateRandomUUID } from "@/helpers/generate-random-uuid";
import { deriveRevenueTag } from "@/lib/revenue-tag";
import type { RevenueTag } from "@/db/collections";
import { NextRequest, NextResponse } from "next/server";

const E164_REGEX = /^\+[1-9]\d{6,14}$/;

const createLeadSchema = {
  name: (v: unknown) => typeof v === "string" && v.trim().length > 0,
  phone: (v: unknown) => {
    if (typeof v !== "string") return false;
    const s = v.replace(/\s/g, "").trim();
    return s.length > 0 && E164_REGEX.test(s);
  },
  source: (v: unknown) =>
    typeof v === "string" && LEAD_SOURCES.includes(v as LeadSourceType),
};

export async function GET(req: NextRequest) {
  const session = await getSessionWithRole();
  requireAuth(session);

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(
    50,
    Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)),
  );
  const stage = searchParams.get("stage");
  const assignedUserId = searchParams.get("assignedUserId");
  const search = searchParams.get("search")?.trim();
  const source = searchParams.get("source");
  const createdFromStr = searchParams.get("createdFrom");
  const createdToStr = searchParams.get("createdTo");
  const sortByParam = searchParams.get("sortBy") ?? "createdAt";
  const sortDirRaw = searchParams.get("sortDir");
  const sortDirParam: "asc" | "desc" =
    sortDirRaw === "asc" || sortDirRaw === "desc"
      ? sortDirRaw
      : sortByParam === "createdAt"
        ? "desc"
        : "asc";

  const offset = (page - 1) * limit;
  const andParts: Record<string, unknown>[] = [
    {
      $or: [{ exitedFromCrmAt: null }, { exitedFromCrmAt: { $exists: false } }],
    },
  ];
  if (session.role === "sales" || session.role === "follow_up_candidate") {
    andParts.push({ assignedUserId: session.user.id });
  }
  if (stage) {
    andParts.push({ stage });
  }
  if (assignedUserId && session.role === "admin") {
    andParts.push({ assignedUserId });
  }
  if (source && LEAD_SOURCES.includes(source as LeadSourceType)) {
    andParts.push({ source });
  }
  if (search && search.length > 0) {
    andParts.push({
      $or: [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ],
    });
  }
  const createdRange: Record<string, Date> = {};
  if (createdFromStr) {
    const from = new Date(createdFromStr);
    if (!Number.isNaN(from.getTime())) {
      createdRange.$gte = from;
    }
  }
  if (createdToStr) {
    const to = new Date(createdToStr);
    if (!Number.isNaN(to.getTime())) {
      to.setHours(23, 59, 59, 999);
      createdRange.$lte = to;
    }
  }
  if (Object.keys(createdRange).length > 0) {
    andParts.push({ createdAt: createdRange });
  }
  const filter: Record<string, unknown> =
    andParts.length === 1 ? andParts[0] : { $and: andParts };

  const sortFieldMap: Record<string, keyof LeadDoc> = {
    name: "name",
    phone: "phone",
    source: "source",
    stage: "stage",
    createdAt: "createdAt",
  };
  const sortField: keyof LeadDoc = sortFieldMap[sortByParam] ?? "createdAt";
  const sortDirection = sortDirParam === "desc" ? -1 : 1;

  const leadsCol = db.collection<LeadDoc>(LEADS);
  const [leadsResult, total] = await Promise.all([
    leadsCol
      .find(filter)
      .sort({ [sortField]: sortDirection })
      .skip(offset)
      .limit(limit)
      .toArray(),
    leadsCol.countDocuments(filter),
  ]);

  const userIds = [
    ...new Set(
      leadsResult
        .map((l) => l.assignedUserId)
        .filter((id): id is string => id != null),
    ),
  ];
  const userMap = new Map<string, string>();
  if (userIds.length > 0) {
    const users = await db
      .collection<UserDoc>(USER)
      .find({ id: { $in: userIds } })
      .project({ id: 1, name: 1 })
      .toArray();
    for (const u of users) {
      userMap.set(u.id, u.name);
    }
  }

  return NextResponse.json({
    leads: leadsResult.map((l) => ({
      id: l.id,
      name: l.name,
      customName: l.customName ?? null,
      phone: l.phone,
      whatsappPhone: l.whatsappPhone ?? null,
      instagramUserId: l.instagramUserId ?? null,
      instagramUsername: l.instagramUsername ?? null,
      source: l.source,
      stage: l.stage,
      assignedUserId: l.assignedUserId ?? null,
      assignedUserName: l.assignedUserId
        ? (userMap.get(l.assignedUserId) ?? null)
        : null,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
      slaStatus: l.slaStatus,
      firstResponseAt: l.firstResponseAt ?? null,
      aiScore: l.aiScore ?? null,
      aiScoreReason: l.aiScoreReason ?? null,
      estimatedAmount: l.estimatedAmount ?? null,
      revenueTag: l.revenueTag ?? null,
      roleOwner: l.roleOwner ?? null,
    })),
    total,
    page,
    limit,
  });
}

export async function POST(req: NextRequest) {
  const session = await getSessionWithRole();
  requireAuth(session);
  if (session.role !== "admin") {
    return NextResponse.json(
      { error: "Only admins can create leads" },
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
  const name = data.name;
  const phone = data.phone;
  const source = data.source ?? "manual";
  const assignedUserId = data.assignedUserId as string | undefined;
  const tattooTypeId = data.tattooTypeId as string | undefined;
  const estimatedAmount = data.estimatedAmount as number | undefined;
  const revenueTag = data.revenueTag as RevenueTag | undefined;

  if (!createLeadSchema.name(name)) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!createLeadSchema.phone(phone)) {
    return NextResponse.json({ error: "Phone is required" }, { status: 400 });
  }
  if (!createLeadSchema.source(source)) {
    return NextResponse.json({ error: "Invalid source" }, { status: 400 });
  }

  const phoneStr = String(phone).replace(/\s/g, "").trim();
  const leadsCol = db.collection<LeadDoc>(LEADS);

  const existing = await leadsCol.findOne({ phone: phoneStr });
  if (existing) {
    return NextResponse.json(
      { error: "Phone number already exists" },
      { status: 409 },
    );
  }

  let finalAssignedUserId: string | null;
  if (session.role === "admin" && assignedUserId) {
    finalAssignedUserId = assignedUserId;
  } else {
    finalAssignedUserId = session.user.id;
  }

  let finalTattooTypeId: string | null = null;
  if (tattooTypeId) {
    const exists = await db
      .collection(TATTOO_TYPES)
      .findOne({ id: tattooTypeId });
    if (exists) finalTattooTypeId = tattooTypeId;
  }

  const finalEstimatedAmount =
    estimatedAmount != null && !Number.isNaN(Number(estimatedAmount))
      ? Number(estimatedAmount)
      : null;
  const finalRevenueTag =
    revenueTag && ["S", "A", "B", "C"].includes(revenueTag)
      ? revenueTag
      : finalEstimatedAmount != null
        ? deriveRevenueTag(finalEstimatedAmount)
        : null;

  const now = new Date();
  const created: LeadDoc = {
    id: generateRandomUUID(),
    name: String(name).trim(),
    phone: phoneStr,
    source: source as LeadSource,
    stage: "new",
    assignedUserId: finalAssignedUserId,
    createdAt: now,
    updatedAt: now,
    slaStatus: "pending",
    recoveryCycle: 0,
    tattooTypeId: finalTattooTypeId,
    ...(source === "whatsapp" && { whatsappPhone: phoneStr }),
    ...(finalEstimatedAmount != null && {
      estimatedAmount: finalEstimatedAmount,
    }),
    ...(finalRevenueTag && { revenueTag: finalRevenueTag }),
  };
  await leadsCol.insertOne(created);

  const { appendLeadTimelineEvent } = await import("@/lib/lead-timeline");
  await appendLeadTimelineEvent(created.id, "lead_created", {
    source: created.source,
  });

  return NextResponse.json(created);
}
