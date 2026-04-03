import { db } from "@/db";
import { LEADS, SLA_LOGS } from "@/db/collections";
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
    const userId = searchParams.get("userId");

    const range = parseDateRange(from, to);
    if (!range) {
      return NextResponse.json({
        totalLeads: 0,
        slaMet: 0,
        slaBreached: 0,
        slaMetPct: 0,
        slaBreachedPct: 0,
        avgResponseDelaySeconds: null,
        breachesPerDay: [],
      });
    }

    const leadMatch: Record<string, unknown> = {
      createdAt: { $gte: range.from, $lte: range.to },
    };
    if (userId) leadMatch.assignedUserId = userId;

    const leadsAgg = await db
      .collection(LEADS)
      .aggregate<{
        total: number;
        slaMet: number;
        slaBreached: number;
        avgDelay: number | null;
      }>([
        { $match: leadMatch },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            slaMet: { $sum: { $cond: [{ $eq: ["$slaStatus", "met"] }, 1, 0] } },
            slaBreached: {
              $sum: { $cond: [{ $eq: ["$slaStatus", "breached"] }, 1, 0] },
            },
            avgDelay: {
              $avg: {
                $cond: [
                  { $ne: ["$firstResponseAt", null] },
                  {
                    $divide: [
                      { $subtract: ["$firstResponseAt", "$createdAt"] },
                      1000,
                    ],
                  },
                  null,
                ],
              },
            },
          },
        },
      ])
      .toArray();

    const agg = leadsAgg[0];
    const totalLeads = agg?.total ?? 0;
    const slaMet = agg?.slaMet ?? 0;
    const slaBreached = agg?.slaBreached ?? 0;
    const slaMetPct =
      totalLeads > 0 ? Math.round((slaMet / totalLeads) * 100) : 0;
    const slaBreachedPct =
      totalLeads > 0 ? Math.round((slaBreached / totalLeads) * 100) : 0;
    const avgResponseDelaySeconds = agg?.avgDelay ?? null;

    const breachMatch: Record<string, unknown> = {
      breachedAt: { $gte: range.from, $lte: range.to },
    };
    if (userId) {
      const leadIdsWithUser = await db
        .collection(LEADS)
        .find({ assignedUserId: userId })
        .project({ id: 1 })
        .toArray();
      const ids = leadIdsWithUser.map((l) => l.id);
      if (ids.length === 0) {
        return NextResponse.json({
          totalLeads,
          slaMet,
          slaBreached,
          slaMetPct,
          slaBreachedPct,
          avgResponseDelaySeconds,
          breachesPerDay: [],
        });
      }
      breachMatch.leadId = { $in: ids };
    }

    const breachesPerDayRows = await db
      .collection(SLA_LOGS)
      .aggregate<{ _id: string; count: number }>([
        { $match: breachMatch },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$breachedAt" },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .toArray();

    const breachesPerDay = breachesPerDayRows.map((r) => ({
      date: r._id,
      count: r.count,
    }));

    return NextResponse.json({
      totalLeads,
      slaMet,
      slaBreached,
      slaMetPct,
      slaBreachedPct,
      avgResponseDelaySeconds,
      breachesPerDay,
    });
  } catch (err) {
    if (err instanceof Response) throw err;
    return NextResponse.json(
      {
        totalLeads: 0,
        slaMet: 0,
        slaBreached: 0,
        slaMetPct: 0,
        slaBreachedPct: 0,
        avgResponseDelaySeconds: null,
        breachesPerDay: [],
      },
      { status: 500 },
    );
  }
}
