import { db } from "@/db";
import { LEADS } from "@/db/collections";
import { getSessionWithRole, requireAuth, requireAdmin } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";

const AI_SCORES = ["hot", "warm", "cold"] as const;

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
        byScore: AI_SCORES.map((score) => ({
          score,
          leadsCount: 0,
          conversionRate: 0,
          avgTimeToDoneSeconds: null,
        })),
        leadsWithAiUsage: 0,
        totalLeads: 0,
      });
    }

    const match = {
      createdAt: { $gte: range.from, $lte: range.to },
    };

    const agg = await db
      .collection(LEADS)
      .aggregate<{
        _id: string | null;
        leadsCount: number;
        doneCount: number;
      }>([
        { $match: match },
        {
          $group: {
            _id: "$aiScore",
            leadsCount: { $sum: 1 },
            doneCount: {
              $sum: { $cond: [{ $eq: ["$stage", "done"] }, 1, 0] },
            },
          },
        },
      ])
      .toArray();

    const total = await db.collection(LEADS).countDocuments(match);
    const leadsWithAiUsage = agg
      .filter((r) => r._id != null)
      .reduce((sum, r) => sum + r.leadsCount, 0);

    const byScoreMap = new Map(
      agg.map((r) => [
        r._id,
        { leadsCount: r.leadsCount, doneCount: r.doneCount },
      ]),
    );

    const byScore = AI_SCORES.map((score) => {
      const row = byScoreMap.get(score);
      const leadsCount = row?.leadsCount ?? 0;
      const doneCount = row?.doneCount ?? 0;
      const conversionRate =
        leadsCount > 0 ? Math.round((doneCount / leadsCount) * 100) : 0;

      return {
        score,
        leadsCount,
        conversionRate,
        avgTimeToDoneSeconds: null as number | null,
      };
    });

    return NextResponse.json({
      byScore,
      leadsWithAiUsage,
      totalLeads: total,
      aiUsagePct: total > 0 ? Math.round((leadsWithAiUsage / total) * 100) : 0,
    });
  } catch (err) {
    if (err instanceof Response) throw err;
    return NextResponse.json(
      {
        byScore: AI_SCORES.map((score) => ({
          score,
          leadsCount: 0,
          conversionRate: 0,
          avgTimeToDoneSeconds: null,
        })),
        leadsWithAiUsage: 0,
        totalLeads: 0,
      },
      { status: 500 },
    );
  }
}
