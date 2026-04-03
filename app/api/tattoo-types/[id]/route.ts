import { db } from "@/db";
import { TATTOO_TYPES } from "@/db/collections";
import type { TattooTypeDoc } from "@/db/collections";
import { getSessionWithRole, requireAdmin, requireAuth } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionWithRole();
  requireAuth(session);
  requireAdmin(session);

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data = body as Record<string, unknown>;
  const name = data.name;

  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const result = await db
    .collection<TattooTypeDoc>(TATTOO_TYPES)
    .findOneAndUpdate(
      { id },
      { $set: { name: name.trim(), updatedAt: new Date() } },
      { returnDocument: "after" },
    );

  if (!result.value) {
    return NextResponse.json(
      { error: "Tattoo type not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({ id: result.value.id, name: result.value.name });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionWithRole();
  requireAuth(session);
  requireAdmin(session);

  const { id } = await params;

  const result = await db.collection(TATTOO_TYPES).deleteOne({ id });

  if (result.deletedCount === 0) {
    return NextResponse.json(
      { error: "Tattoo type not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true });
}
