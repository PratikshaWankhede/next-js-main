import { db } from "@/db";
import { LEADS, USER } from "@/db/collections";
import type { UserDoc } from "@/db/collections";
import { getSessionWithRole, requireAdmin, requireAuth } from "@/lib/rbac";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(["admin", "sales"]).optional(),
  password: z.string().min(8).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionWithRole();
  requireAuth(session);
  requireAdmin(session);

  const { id } = await params;
  const json = (await req.json().catch(() => null)) as unknown;
  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof parsed.data.name === "string") updates.name = parsed.data.name;
  if (typeof parsed.data.email === "string")
    updates.email = parsed.data.email.toLowerCase();
  if (typeof parsed.data.role === "string") updates.role = parsed.data.role;
  if (typeof parsed.data.password === "string") {
    updates.passwordHash = await bcrypt.hash(parsed.data.password, 12);
  }

  if (Object.keys(updates).length === 1) {
    return NextResponse.json({ error: "No changes provided" }, { status: 400 });
  }

  const userCol = db.collection<UserDoc & { passwordHash?: string }>(USER);

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

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionWithRole();
  requireAuth(session);
  requireAdmin(session);

  const { id } = await params;

  if (session.user.id === id) {
    return NextResponse.json(
      { error: "You cannot delete your own account" },
      { status: 400 },
    );
  }

  await Promise.all([
    db
      .collection(LEADS)
      .updateMany(
        { assignedUserId: id },
        { $set: { assignedUserId: null, updatedAt: new Date() } },
      ),
    db.collection(USER).deleteOne({ id }),
  ]);

  return NextResponse.json({ ok: true });
}
