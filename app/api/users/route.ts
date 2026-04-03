import { db } from "@/db";
import { USER } from "@/db/collections";
import type { UserDoc } from "@/db/collections";
import { generateRandomUUID } from "@/helpers/generate-random-uuid";
import { sendUserWelcomeEmail } from "@/lib/notifications/email";
import { getSessionWithRole, requireAdmin, requireAuth } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";

export async function GET(req: NextRequest) {
  const session = await getSessionWithRole();
  requireAuth(session);
  requireAdmin(session);

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(
    50,
    Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)),
  );
  const search = searchParams.get("search")?.trim();
  const roleFilter = searchParams.get("role");

  const offset = (page - 1) * limit;

  const filter: Record<string, unknown> = {};
  if (search && search.length > 0) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }
  if (
    roleFilter === "admin" ||
    roleFilter === "sales" ||
    roleFilter === "follow_up_candidate"
  ) {
    filter.role = roleFilter;
  }

  const userCol = db.collection<UserDoc>(USER);
  const [usersResult, total] = await Promise.all([
    userCol
      .find(filter)
      .sort({ name: 1 })
      .skip(offset)
      .limit(limit)
      .project({ id: 1, name: 1, email: 1, image: 1, role: 1, createdAt: 1 })
      .toArray(),
    userCol.countDocuments(filter),
  ]);

  return NextResponse.json({
    users: usersResult.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      image: u.image,
      role: u.role,
      createdAt: u.createdAt,
    })),
    total,
    page,
    limit,
  });
}

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["admin", "sales", "follow_up_candidate"]).default("sales"),
});

export async function POST(req: NextRequest) {
  const session = await getSessionWithRole();
  requireAuth(session);
  requireAdmin(session);

  const json = (await req.json().catch(() => null)) as unknown;
  const parsed = createUserSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const userCol = db.collection<UserDoc & { passwordHash?: string }>(USER);

  const existing = await userCol.findOne({ email });
  if (existing) {
    return NextResponse.json(
      { error: "A user with this email already exists" },
      { status: 409 },
    );
  }

  const now = new Date();
  const id = generateRandomUUID();
  const plainPassword = parsed.data.password;
  const passwordHash = await bcrypt.hash(plainPassword, 12);

  await userCol.insertOne({
    id,
    name: parsed.data.name,
    email,
    emailVerified: true,
    image: null,
    role: parsed.data.role,
    createdAt: now,
    updatedAt: now,
    passwordHash,
  } as unknown as UserDoc);
  // Best-effort: send welcome email with credentials.
  void sendUserWelcomeEmail({
    name: parsed.data.name,
    email,
    password: plainPassword,
  }).catch(() => {});

  return NextResponse.json({ ok: true, id }, { status: 201 });
}
