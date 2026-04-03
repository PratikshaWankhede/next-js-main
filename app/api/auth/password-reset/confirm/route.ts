import { db } from "@/db";
import { USER } from "@/db/collections";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";

const bodySchema = z.object({
  email: z.string().email(),
  resetToken: z.string().min(32),
  password: z.string().min(8),
});

function hashWithSecret(value: string) {
  const secret = process.env.AUTH_SECRET ?? "dev-secret";
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

export async function POST(req: Request) {
  const json = (await req.json().catch(() => null)) as unknown;
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const resetTokenHash = hashWithSecret(parsed.data.resetToken);

  const user = await db.collection(USER).findOne<{
    id: string;
    passwordResetTokenHash?: string;
    passwordResetTokenExpiresAt?: Date;
  }>({ email });

  if (!user?.id) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  if (!user.passwordResetTokenHash || !user.passwordResetTokenExpiresAt) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  if (user.passwordResetTokenExpiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "Token expired" }, { status: 400 });
  }

  if (user.passwordResetTokenHash !== resetTokenHash) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  await db.collection(USER).updateOne(
    { id: user.id },
    {
      $set: { passwordHash },
      $unset: {
        passwordResetTokenHash: "",
        passwordResetTokenExpiresAt: "",
      },
    },
  );

  return NextResponse.json({ ok: true });
}
