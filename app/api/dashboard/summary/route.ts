/**
 * Dashboard metrics: role-scoped leads/follow-ups; optional ?range=7d|30d|90d, ?timezone=IANA, ?assignedUserId= (admin).
 * Recommended indexes: run `npm run mongo:indexes-dashboard`.
 */
import { db } from "@/db";
import { FOLLOW_UPS, LEADS, NOTIFICATIONS, USER } from "@/db/collections";
import type {
  AiScore,
  FollowUpDoc,
  LeadDoc,
  LeadStage,
  UserDoc,
} from "@/db/collections";
import { getDayBoundsUtc, isValidIanaTimeZone } from "@/lib/day-bounds-tz";
import {
  getSessionWithRole,
  requireAuth,
  type SessionWithRole,
} from "@/lib/rbac";
import { LEAD_SOURCES, LEAD_STAGES } from "@/features/leads/types/lead.types";
import { NextRequest, NextResponse } from "next/server";

const RANGE_DAYS: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };
const HOT_ORDER: Record<string, number> = { hot: 0, warm: 1, cold: 2 };

function notExitedFilter(): Record<string, unknown> {
  return {
    $or: [{ exitedFromCrmAt: null }, { exitedFromCrmAt: { $exists: false } }],
  };
}

/** Active pipeline: open work — not exited and stage not terminal for pipeline. */
function activePipelineStagesFilter(): Record<string, unknown> {
  return {
    stage: { $nin: ["done", "lost"] as LeadStage[] },
  };
}

function assignFilter(
  session: SessionWithRole,
  adminAssignedId: string | null,
): Record<string, unknown> {
  if (session.role === "sales" || session.role === "follow_up_candidate") {
    return { assignedUserId: session.user.id };
  }
  if (session.role === "admin" && adminAssignedId) {
    return { assignedUserId: adminAssignedId };
  }
  return {};
}

function followUpAssignFilter(
  session: SessionWithRole,
  adminAssignedId: string | null,
): Record<string, unknown> {
  if (session.role === "sales" || session.role === "follow_up_candidate") {
    return { assignedUserId: session.user.id };
  }
  if (session.role === "admin" && adminAssignedId) {
    return { assignedUserId: adminAssignedId };
  }
  return {};
}

export async function GET(req: NextRequest) {
  const session = await getSessionWithRole();
  requireAuth(session);

  const { searchParams } = new URL(req.url);
  const rangeParam = searchParams.get("range") ?? "7d";
  const rangeKey = RANGE_DAYS[rangeParam] !== undefined ? rangeParam : "7d";
  const rangeDays = RANGE_DAYS[rangeKey] ?? 7;

  const tzRaw = searchParams.get("timezone")?.trim();
  const timeZone = tzRaw && isValidIanaTimeZone(tzRaw) ? tzRaw : "UTC";

  const assignedParam = searchParams.get("assignedUserId")?.trim();
  if (assignedParam && session.role !== "admin") {
    return NextResponse.json(
      { error: "assignedUserId is only allowed for administrators" },
      { status: 400 },
    );
  }
  const adminAssignedId =
    session.role === "admin" && assignedParam ? assignedParam : null;

  const now = new Date();
  const rangeFrom = new Date(now.getTime() - rangeDays * 24 * 60 * 60 * 1000);

  const assign = assignFilter(session, adminAssignedId);
  const fuAssign = followUpAssignFilter(session, adminAssignedId);

  const exited = notExitedFilter();
  const periodMatch: Record<string, unknown> = {
    $and: [exited, assign, { createdAt: { $gte: rangeFrom, $lte: now } }],
  };

  const leadsCol = db.collection<LeadDoc>(LEADS);
  const fuCol = db.collection<FollowUpDoc>(FOLLOW_UPS);
  const notifCol = db.collection(NOTIFICATIONS);
  const userCol = db.collection<UserDoc>(USER);

  const { startUtc: todayStartUtc, endUtc: todayEndUtc } = getDayBoundsUtc(
    timeZone,
    now,
  );

  const fuBase: Record<string, unknown> = { ...fuAssign };
  const followUpsToday = await fuCol.countDocuments({
    ...fuBase,
    status: "pending",
    scheduledAt: { $gte: todayStartUtc, $lte: todayEndUtc },
  });

  const overdueFollowUps = await fuCol.countDocuments({
    ...fuBase,
    status: "pending",
    scheduledAt: { $lt: todayStartUtc },
  });

  const tomorrowStart = new Date(todayEndUtc.getTime() + 1);
  const upcomingFollowUps = await fuCol.countDocuments({
    ...fuBase,
    status: "pending",
    scheduledAt: { $gte: tomorrowStart },
  });

  const newLeadsMatch: Record<string, unknown> = {
    $and: [
      exited,
      assign,
      { createdAt: { $gte: todayStartUtc, $lte: todayEndUtc } },
    ],
  };
  const newLeadsToday = await leadsCol.countDocuments(newLeadsMatch);

  const hotCountMatch: Record<string, unknown> = {
    $and: [exited, assign, { aiScore: "hot" }],
  };
  const hotLeadsCount = await leadsCol.countDocuments(hotCountMatch);

  const lostOnly = await leadsCol.countDocuments({
    $and: [
      exited,
      assign,
      { createdAt: { $gte: rangeFrom, $lte: now } },
      { stage: "lost" },
    ],
  });
  const noShowOnly = await leadsCol.countDocuments({
    $and: [
      exited,
      assign,
      { createdAt: { $gte: rangeFrom, $lte: now } },
      { stage: "no_show" },
    ],
  });

  const facetResult = await leadsCol
    .aggregate<{
      byStage: { _id: string; c: number }[];
      bySource: { _id: string; c: number }[];
      conv: { total: number; booked: number; done: number }[];
    }>([
      { $match: periodMatch },
      {
        $facet: {
          byStage: [{ $group: { _id: "$stage", c: { $sum: 1 } } }],
          bySource: [{ $group: { _id: "$source", c: { $sum: 1 } } }],
          conv: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                booked: {
                  $sum: { $cond: [{ $eq: ["$stage", "booking"] }, 1, 0] },
                },
                done: {
                  $sum: { $cond: [{ $eq: ["$stage", "done"] }, 1, 0] },
                },
              },
            },
          ],
        },
      },
    ])
    .toArray();

  const fr = facetResult[0] ?? {
    byStage: [],
    bySource: [],
    conv: [],
  };

  const stageMap: Record<string, number> = {};
  for (const s of LEAD_STAGES) stageMap[s] = 0;
  for (const row of fr.byStage ?? []) {
    if (row._id) stageMap[row._id] = row.c;
  }
  const leadCountsByStage = LEAD_STAGES.map((stage) => ({
    stage,
    count: stageMap[stage] ?? 0,
  }));

  const sourceMap: Record<string, number> = {};
  for (const s of LEAD_SOURCES) sourceMap[s] = 0;
  for (const row of fr.bySource ?? []) {
    if (row._id) sourceMap[row._id] = row.c;
  }
  const leadCountsBySource = LEAD_SOURCES.map((source) => ({
    source,
    count: sourceMap[source] ?? 0,
  }));

  const convRow = fr.conv?.[0];
  const totalLeads = convRow?.total ?? 0;
  const booked = convRow?.booked ?? 0;
  const done = convRow?.done ?? 0;
  const conversionRate =
    totalLeads > 0 ? Math.round((done / totalLeads) * 1000) / 10 : 0;

  const activePipelineCount = await leadsCol.countDocuments({
    $and: [exited, assign, activePipelineStagesFilter()],
  });

  const hotDocs = await leadsCol
    .find({
      $and: [
        exited,
        assign,
        { aiScore: { $in: ["hot", "warm", "cold"] as AiScore[] } },
      ],
    })
    .project({ id: 1, name: 1, aiScore: 1, updatedAt: 1 })
    .toArray();

  hotDocs.sort((a, b) => {
    const ao = HOT_ORDER[a.aiScore ?? "cold"] ?? 3;
    const bo = HOT_ORDER[b.aiScore ?? "cold"] ?? 3;
    if (ao !== bo) return ao - bo;
    const at = a.updatedAt?.getTime() ?? 0;
    const bt = b.updatedAt?.getTime() ?? 0;
    return bt - at;
  });

  const hotLeads = hotDocs.slice(0, 10).map((l) => ({
    id: l.id,
    name: l.name,
    score: (l.aiScore ?? "cold") as string,
  }));

  const unreadNotifications = await notifCol.countDocuments({
    userId: session.user.id,
    isRead: false,
  });

  const topAssignees: {
    userId: string;
    name: string;
    totalLeads: number;
    conversionRate: number;
    followUpCompletionRate: number;
  }[] = [];

  if (session.role === "admin" && !adminAssignedId) {
    const agg = await leadsCol
      .aggregate<{
        _id: string;
        total: number;
        done: number;
      }>([
        { $match: periodMatch },
        {
          $match: {
            assignedUserId: { $nin: [null, ""] },
          },
        },
        {
          $group: {
            _id: "$assignedUserId",
            total: { $sum: 1 },
            done: { $sum: { $cond: [{ $eq: ["$stage", "done"] }, 1, 0] } },
          },
        },
        { $sort: { total: -1 } },
        { $limit: 30 },
      ])
      .toArray();

    const activeUsers = await userCol
      .find({
        banned: { $ne: true },
        id: { $in: agg.map((a) => a._id) },
      })
      .project({ id: 1, name: 1 })
      .toArray();
    const nameById = new Map(activeUsers.map((u) => [u.id, u.name]));

    for (const row of agg) {
      if (row.total === 0) continue;
      const uid = row._id;
      if (!nameById.has(uid)) continue;

      const convR =
        row.total > 0 ? Math.round((row.done / row.total) * 1000) / 10 : 0;

      const fuInRange = await fuCol
        .find({
          assignedUserId: uid,
          scheduledAt: { $gte: rangeFrom, $lte: now },
          status: { $in: ["completed", "missed"] },
        })
        .toArray();
      const completed = fuInRange.filter(
        (f) => f.status === "completed",
      ).length;
      const missed = fuInRange.filter((f) => f.status === "missed").length;
      const denom = completed + missed;
      const followUpCompletionRate =
        denom > 0 ? Math.round((completed / denom) * 1000) / 10 : 0;

      topAssignees.push({
        userId: uid,
        name: nameById.get(uid) ?? uid,
        totalLeads: row.total,
        conversionRate: convR,
        followUpCompletionRate,
      });
      if (topAssignees.length >= 10) break;
    }
  }

  const body = {
    kpis: {
      activePipelineCount,
    },
    todayActions: {
      followUpsToday,
      overdueFollowUps,
      newLeadsToday,
      hotLeads: hotLeadsCount,
    },
    conversion: {
      totalLeads,
      booked,
      done,
      conversionRate,
    },
    missedOpportunities: {
      lost: lostOnly,
      noShow: noShowOnly,
      total: lostOnly + noShowOnly,
    },
    leadCountsByStage,
    leadCountsBySource,
    hotLeads,
    followUps: {
      today: followUpsToday,
      overdue: overdueFollowUps,
      upcoming: upcomingFollowUps,
    },
    unreadNotifications,
    topAssignees,
  };

  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "private, max-age=30",
    },
  });
}
