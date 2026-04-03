import { db } from "@/db";
import { NOTIFICATION_PREFERENCES } from "@/db/collections";
import type { NotificationPreferenceDoc } from "@/db/collections";
import { getSessionWithRole, requireAuth } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";

const TYPES = [
  "sla_breach",
  "follow_up_missed",
  "new_inbound",
  "reassigned",
] as const;
const CHANNELS = ["in_app", "email", "whatsapp"] as const;

export async function GET(_req: NextRequest) {
  const session = await getSessionWithRole();
  requireAuth(session);

  const prefs = await db
    .collection<NotificationPreferenceDoc>(NOTIFICATION_PREFERENCES)
    .find({ userId: session.user.id })
    .toArray();

  const map: Record<string, Record<string, boolean>> = {};
  for (const t of TYPES) {
    map[t] = {};
    for (const c of CHANNELS) {
      const p = prefs.find((x) => x.type === t && x.channel === c);
      map[t][c] = p?.enabled ?? c === "in_app";
    }
  }

  return NextResponse.json({ preferences: map });
}

export async function PUT(req: NextRequest) {
  const session = await getSessionWithRole();
  requireAuth(session);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data = body as Record<string, Record<string, boolean>>;
  const preferences = data.preferences;

  if (!preferences || typeof preferences !== "object") {
    return NextResponse.json(
      { error: "preferences object required" },
      { status: 400 },
    );
  }

  const col = db.collection(NOTIFICATION_PREFERENCES);
  for (const type of TYPES) {
    const row = preferences[type];
    if (!row || typeof row !== "object") continue;

    for (const channel of CHANNELS) {
      const enabled = row[channel];
      if (typeof enabled !== "boolean") continue;

      const effectiveEnabled =
        type === "sla_breach" &&
        channel === "in_app" &&
        session.role !== "admin"
          ? true
          : enabled;

      await col.updateOne(
        {
          userId: session.user.id,
          channel,
          type,
        },
        { $set: { enabled: effectiveEnabled } },
        { upsert: true },
      );
    }
  }

  const prefs = await col.find({ userId: session.user.id }).toArray();
  const map: Record<string, Record<string, boolean>> = {};
  for (const t of TYPES) {
    map[t] = {};
    for (const c of CHANNELS) {
      const p = prefs.find((x) => x.type === t && x.channel === c);
      map[t][c] = p?.enabled ?? c === "in_app";
    }
  }

  return NextResponse.json({ preferences: map });
}
