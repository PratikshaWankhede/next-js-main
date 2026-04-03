import { getSessionWithRole, requireAdmin, requireAuth } from "@/lib/rbac";
import {
  getFirstResponseSlaMinutes,
  setFirstResponseSlaMinutes,
  clampSlaMinutes,
} from "@/lib/sla-settings";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const session = await getSessionWithRole();
  requireAuth(session);

  const firstResponseSlaMinutes = await getFirstResponseSlaMinutes();
  return NextResponse.json({ firstResponseSlaMinutes });
}

export async function PATCH(req: NextRequest) {
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
  const raw = data.firstResponseSlaMinutes;

  if (raw === undefined || raw === null) {
    return NextResponse.json(
      { error: "firstResponseSlaMinutes is required" },
      { status: 400 }
    );
  }

  const minutes = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(minutes)) {
    return NextResponse.json(
      { error: "firstResponseSlaMinutes must be a number" },
      { status: 400 }
    );
  }

  const clamped = clampSlaMinutes(minutes);
  await setFirstResponseSlaMinutes(clamped);

  return NextResponse.json({ firstResponseSlaMinutes: clamped });
}
