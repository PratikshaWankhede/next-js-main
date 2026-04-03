import { db } from "@/db";
import { FOLLOW_UPS, LEADS } from "@/db/collections";
import { getSessionWithRole, requireAuth, requireAdmin } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";

function parseDateRange(from?: string | null, to?: string | null) {
  const now = new Date();
  const defaultTo = new Date(now);
  const defaultFrom = new Date(now);
  defaultFrom.setDate(defaultFrom.getDate() - 30);

  const fromDate = from ? new Date(from) : defaultFrom;
  const toDate = to ? new Date(to) : defaultTo;

  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) return null;
  if (fromDate > toDate) return null;

  return { from: fromDate, to: toDate };
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionWithRole();
    requireAuth(session);
    requireAdmin(session);

    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const range = parseDateRange(from, to);
    if (!range) {
      return NextResponse.json({
        totalFollowUps: 0,
        completed: 0,
        missed: 0,
        completionRate: 0,
        missRate: 0,
        avgFollowUpsPerLead: 0,
        leadsLostAfterMisses: 0,
        failedLeads: [],
      });
    }

    const match = {
      scheduledAt: { $gte: range.from, $lte: range.to },
    };

    const agg = await db
      .collection(FOLLOW_UPS)
      .aggregate<{
        total: number;
        completed: number;
        missed: number;
        leadCount: number;
      }>([
        { $match: match },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
            },
            missed: {
              $sum: { $cond: [{ $eq: ["$status", "missed"] }, 1, 0] },
            },
            leadCount: { $addToSet: "$leadId" },
          },
        },
        {
          $project: {
            total: 1,
            completed: 1,
            missed: 1,
            leadCount: { $size: "$leadCount" },
          },
        },
      ])
      .toArray();

    const row = agg[0];
    const totalFollowUps = row?.total ?? 0;
    const completed = row?.completed ?? 0;
    const missed = row?.missed ?? 0;
    const leadCount = row?.leadCount ?? 0;
    const completionRate =
      totalFollowUps > 0 ? Math.round((completed / totalFollowUps) * 100) : 0;
    const missRate =
      totalFollowUps > 0 ? Math.round((missed / totalFollowUps) * 100) : 0;
    const avgFollowUpsPerLead =
      leadCount > 0 ? Math.round((totalFollowUps / leadCount) * 10) / 10 : 0;

    const leadsWithFiveMissed = await db
      .collection(FOLLOW_UPS)
      .aggregate<{ _id: string; missedCount: number }>([
        {
          $group: {
            _id: "$leadId",
            missedCount: {
              $sum: { $cond: [{ $eq: ["$status", "missed"] }, 1, 0] },
            },
          },
        },
        { $match: { missedCount: { $gte: 5 } } },
      ])
      .toArray();

    const leadIds = leadsWithFiveMissed.map((r) => r._id);
    const lostLeads =
      leadIds.length > 0
        ? await db
            .collection(LEADS)
            .find({ id: { $in: leadIds }, stage: "lost" })
            .project({ id: 1, name: 1, stage: 1 })
            .toArray()
        : [];

    const failedLeads = lostLeads.map((l) => ({
      id: l.id,
      name: l.name,
      stage: l.stage,
    }));

    return NextResponse.json({
      totalFollowUps,
      completed,
      missed,
      completionRate,
      missRate,
      avgFollowUpsPerLead,
      leadsLostAfterMisses: failedLeads.length,
      failedLeads,
    });
  } catch (err) {
    if (err instanceof Response) throw err;
    return NextResponse.json(
      {
        totalFollowUps: 0,
        completed: 0,
        missed: 0,
        completionRate: 0,
        missRate: 0,
        avgFollowUpsPerLead: 0,
        leadsLostAfterMisses: 0,
        failedLeads: [],
      },
      { status: 500 },
    );
  }
}
