import { db } from "@/db";
import { LEADS } from "@/db/collections";
import { getSessionWithRole, requireAuth, requireAdmin } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";

const SOURCES = [
  "whatsapp",
  "instagram",
  "manual",
  "referral",
  "website",
] as const;

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
        channels: SOURCES.map((source) => ({
          source,
          leadsCreated: 0,
          conversionRate: 0,
          avgResponseTimeSeconds: null,
          slaBreachRate: 0,
        })),
      });
    }

    const agg = await db
      .collection(LEADS)
      .aggregate<{
        _id: string;
        leadsCreated: number;
        doneCount: number;
        avgResponseSeconds: number | null;
        breachedCount: number;
      }>([
        {
          $match: {
            createdAt: { $gte: range.from, $lte: range.to },
          },
        },
        {
          $group: {
            _id: "$source",
            leadsCreated: { $sum: 1 },
            doneCount: {
              $sum: { $cond: [{ $eq: ["$stage", "done"] }, 1, 0] },
            },
            avgResponseSeconds: {
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
            breachedCount: {
              $sum: { $cond: [{ $eq: ["$slaStatus", "breached"] }, 1, 0] },
            },
          },
        },
      ])
      .toArray();

    const bySource = new Map(
      agg.map((r) => [
        r._id,
        {
          leadsCreated: r.leadsCreated,
          doneCount: r.doneCount,
          avgResponseSeconds: r.avgResponseSeconds,
          breachedCount: r.breachedCount,
        },
      ]),
    );

    const channels = SOURCES.map((source) => {
      const row = bySource.get(source);
      const leadsCreated = row?.leadsCreated ?? 0;
      const doneCount = row?.doneCount ?? 0;
      const conversionRate =
        leadsCreated > 0 ? Math.round((doneCount / leadsCreated) * 100) : 0;
      const avgResponseTimeSeconds = row?.avgResponseSeconds ?? null;
      const breachedCount = row?.breachedCount ?? 0;
      const slaBreachRate =
        leadsCreated > 0 ? Math.round((breachedCount / leadsCreated) * 100) : 0;

      return {
        source,
        leadsCreated,
        conversionRate,
        avgResponseTimeSeconds,
        slaBreachRate,
      };
    });

    return NextResponse.json({ channels });
  } catch (err) {
    if (err instanceof Response) throw err;
    return NextResponse.json(
      {
        channels: SOURCES.map((source) => ({
          source,
          leadsCreated: 0,
          conversionRate: 0,
          avgResponseTimeSeconds: null,
          slaBreachRate: 0,
        })),
      },
      { status: 500 },
    );
  }
}
