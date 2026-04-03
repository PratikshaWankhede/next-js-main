import { db } from "@/db";
import { USER } from "@/db/collections";
import type { UserDoc } from "@/db/collections";
import { getSessionWithRole, requireAuth } from "@/lib/rbac";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
});

export async function GET() {
  const session = await getSessionWithRole();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    user: session.user,
    role: session.role,
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getSessionWithRole();
  requireAuth(session);

  const json = (await req.json().catch(() => null)) as unknown;
  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof parsed.data.name === "string") updates.name = parsed.data.name;
  if (typeof parsed.data.email === "string")
    updates.email = parsed.data.email.toLowerCase();
  if (typeof parsed.data.password === "string") {
    updates.passwordHash = await bcrypt.hash(parsed.data.password, 12);
  }

  if (Object.keys(updates).length === 1) {
    return NextResponse.json({ error: "No changes provided" }, { status: 400 });
  }

  const userCol = db.collection<UserDoc & { passwordHash?: string }>(USER);
  const id = session.user.id;

  if (typeof updates.email === "string") {
    const existing = await userCol.findOne({
      email: updates.email,
      id: { $ne: id },
    });
    if (existing) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 409 },
      );
    }
  }

  const res = await userCol.updateOne({ id }, { $set: updates });
  if (!res.matchedCount) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
