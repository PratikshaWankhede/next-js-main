import { db } from "@/db";
import { TATTOO_TYPES } from "@/db/collections";
import type { TattooTypeDoc } from "@/db/collections";
import { getSessionWithRole, requireAdmin, requireAuth } from "@/lib/rbac";
import { generateRandomUUID } from "@/helpers/generate-random-uuid";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const session = await getSessionWithRole();
  requireAuth(session);
  requireAdmin(session);

  const rows = await db
    .collection<TattooTypeDoc>(TATTOO_TYPES)
    .find({})
    .sort({ createdAt: -1 })
    .project({ id: 1, name: 1 })
    .toArray();

  return NextResponse.json({ tattooTypes: rows });
}

export async function POST(req: NextRequest) {
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
  const name = data.name;

  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const now = new Date();
  const created: TattooTypeDoc = {
    id: generateRandomUUID(),
    name: name.trim(),
    createdAt: now,
    updatedAt: now,
  };
  await db.collection(TATTOO_TYPES).insertOne(created);

  return NextResponse.json({ id: created.id, name: created.name });
}
