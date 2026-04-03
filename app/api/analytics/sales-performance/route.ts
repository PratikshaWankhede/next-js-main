import { db } from "@/db";
import { FOLLOW_UPS, LEADS, SLA_LOGS, USER } from "@/db/collections";
import { getSessionWithRole, requireAuth, requireAdmin } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_req: NextRequest) {
  try {
    const session = await getSessionWithRole();
    requireAuth(session);
    requireAdmin(session);

    const assignedUserIds = await db
      .collection(LEADS)
      .distinct("assignedUserId", { assignedUserId: { $ne: null } });

    const userIds = assignedUserIds.filter((id): id is string => id != null);
    if (userIds.length === 0) {
      return NextResponse.json({ users: [] });
    }

    const usersList = await db
      .collection(USER)
      .find({ id: { $in: userIds } })
      .project({ id: 1, name: 1 })
      .toArray();
    const userMap = new Map(
      usersList.map((u) => [
        (u as { id: string }).id,
        (u as { name: string }).name,
      ]),
    );

    const leadsAgg = await db
      .collection(LEADS)
      .aggregate<{
        _id: string;
        leadsAssigned: number;
        doneCount: number;
        avgResponseSeconds: number | null;
        totalAdvance: number;
      }>([
        { $match: { assignedUserId: { $ne: null } } },
        {
          $group: {
            _id: "$assignedUserId",
            leadsAssigned: { $sum: 1 },
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
            totalAdvance: {
              $sum: {
                $cond: [
                  { $eq: ["$stage", "done"] },
                  { $ifNull: ["$advanceAmount", 0] },
                  0,
                ],
              },
            },
          },
        },
      ])
      .toArray();

    const slaAgg = await db
      .collection(SLA_LOGS)
      .aggregate<{ _id: string; slaBreaches: number }>([
        { $group: { _id: "$leadId", count: { $sum: 1 } } },
        {
          $lookup: {
            from: "leads",
            localField: "_id",
            foreignField: "id",
            as: "lead",
          },
        },
        { $unwind: "$lead" },
        {
          $group: {
            _id: "$lead.assignedUserId",
            slaBreaches: { $sum: "$count" },
          },
        },
      ])
      .toArray();

    const followUpAgg = await db
      .collection(FOLLOW_UPS)
      .aggregate<{
        _id: string;
        total: number;
        missed: number;
      }>([
        {
          $group: {
            _id: "$assignedUserId",
            total: { $sum: 1 },
            missed: {
              $sum: { $cond: [{ $eq: ["$status", "missed"] }, 1, 0] },
            },
          },
        },
      ])
      .toArray();

    const leadsMap = new Map(
      leadsAgg.map((r) => [
        r._id,
        {
          leadsAssigned: r.leadsAssigned,
          doneCount: r.doneCount,
          avgResponseSeconds: r.avgResponseSeconds,
          totalAdvance: r.totalAdvance,
        },
      ]),
    );
    const slaMap = new Map(slaAgg.map((r) => [r._id, r.slaBreaches]));
    const followUpMap = new Map(
      followUpAgg.map((r) => [r._id, { total: r.total, missed: r.missed }]),
    );

    const users = userIds.map((userId) => {
      const leadStats = leadsMap.get(userId);
      const leadsAssigned = leadStats?.leadsAssigned ?? 0;
      const doneCount = leadStats?.doneCount ?? 0;
      const conversionRate =
        leadsAssigned > 0 ? Math.round((doneCount / leadsAssigned) * 100) : 0;
      const avgResponseTimeSeconds = leadStats?.avgResponseSeconds ?? null;
      const revenueAdvance = leadStats?.totalAdvance ?? 0;
      const slaBreaches = slaMap.get(userId) ?? 0;
      const fu = followUpMap.get(userId);
      const followUpTotal = fu?.total ?? 0;
      const followUpMissed = fu?.missed ?? 0;
      const followUpMissRate =
        followUpTotal > 0
          ? Math.round((followUpMissed / followUpTotal) * 100)
          : 0;

      return {
        userId,
        name: userMap.get(userId) ?? null,
        leadsAssigned,
        doneCount,
        conversionRate,
        avgResponseTimeSeconds,
        revenueAdvance,
        slaBreaches,
        followUpTotal,
        followUpMissed,
        followUpMissRate,
      };
    });

    users.sort((a, b) => b.conversionRate - a.conversionRate);

    return NextResponse.json({
      users: users.map((u) => ({
        userId: u.userId,
        name: u.name,
        leadsAssigned: u.leadsAssigned,
        conversionRate: u.conversionRate,
        avgResponseTime:
          u.avgResponseTimeSeconds != null
            ? Math.round(u.avgResponseTimeSeconds)
            : null,
        revenueAdvance: u.revenueAdvance,
        slaBreaches: u.slaBreaches,
        followUpMissRate: u.followUpMissRate,
      })),
    });
  } catch (err) {
    if (err instanceof Response) throw err;
    return NextResponse.json({ users: [] }, { status: 500 });
  }
}
