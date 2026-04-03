import { db } from "@/db";
import { LEADS } from "@/db/collections";
import { getSessionWithRole, requireAuth, requireAdmin } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";

const STAGE_ORDER = [
  "new",
  "contacted",
  "interested",
  "follow_up",
  "booking",
  "no_show",
  "done",
  "lost",
] as const;

function parseDateRange(from?: string | null, to?: string | null) {
  const now = new Date();
  const defaultTo = new Date(now);
  const defaultFrom = new Date(now);
  defaultFrom.setDate(defaultFrom.getDate() - 30);

  const fromDate = from ? new Date(from) : defaultFrom;
  const toDate = to ? new Date(to) : defaultTo;

  if (isNaN(fromDate.getTime())) return null;
  if (isNaN(toDate.getTime())) return null;
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
        stages: STAGE_ORDER.map((stage) => ({ stage, count: 0 })),
        conversionRates: {},
      });
    }

    const stageCounts = await db
      .collection(LEADS)
      .aggregate<{ _id: string; count: number }>([
        {
          $match: {
            createdAt: { $gte: range.from, $lte: range.to },
          },
        },
        { $group: { _id: "$stage", count: { $sum: 1 } } },
      ])
      .toArray();

    const countByStage: Record<string, number> = {};
    for (const s of STAGE_ORDER) {
      countByStage[s] = 0;
    }
    for (const row of stageCounts) {
      countByStage[row._id] = row.count;
    }

    const stages = STAGE_ORDER.map((stage) => ({
      stage,
      count: countByStage[stage] ?? 0,
    }));

    const newCount = countByStage.new ?? 0;
    const contactedCount = countByStage.contacted ?? 0;
    const interestedCount = countByStage.interested ?? 0;
    const followUpCount = countByStage.follow_up ?? 0;
    const bookingCount = countByStage.booking ?? 0;
    const doneCount = countByStage.done ?? 0;

    const conversionRates: Record<string, number> = {};
    if (newCount > 0) {
      conversionRates.contacted = Math.round((contactedCount / newCount) * 100);
    }
    if (contactedCount > 0) {
      conversionRates.interested = Math.round(
        (interestedCount / contactedCount) * 100,
      );
    }
    if (interestedCount > 0) {
      conversionRates.follow_up = Math.round(
        (followUpCount / interestedCount) * 100,
      );
      conversionRates.booking = Math.round(
        (bookingCount / interestedCount) * 100,
      );
      conversionRates.done = Math.round((doneCount / interestedCount) * 100);
    }

    return NextResponse.json({
      stages,
      conversionRates,
    });
  } catch (err) {
    if (err instanceof Response) throw err;
    return NextResponse.json(
      {
        stages: STAGE_ORDER.map((stage) => ({ stage, count: 0 })),
        conversionRates: {},
      },
      { status: 500 },
    );
  }
}
