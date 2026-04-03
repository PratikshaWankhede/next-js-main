import { db } from "@/db";
import { USER } from "@/db/collections";
import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";

const bodySchema = z.object({
  email: z.string().email(),
  otp: z.string().regex(/^\d{6}$/),
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
  const otpHash = hashWithSecret(parsed.data.otp);

  const user = await db.collection(USER).findOne<{
    id: string;
    passwordResetOtpHash?: string;
    passwordResetOtpExpiresAt?: Date;
  }>({ email });

  if (!user?.id) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  if (!user.passwordResetOtpHash || !user.passwordResetOtpExpiresAt) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  if (user.passwordResetOtpExpiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "Code expired" }, { status: 400 });
  }

  if (user.passwordResetOtpHash !== otpHash) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  const resetTokenHash = hashWithSecret(resetToken);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await db.collection(USER).updateOne(
    { id: user.id },
    {
      $set: {
        passwordResetTokenHash: resetTokenHash,
        passwordResetTokenExpiresAt: expiresAt,
      },
      $unset: {
        passwordResetOtpHash: "",
        passwordResetOtpExpiresAt: "",
      },
    },
  );

  return NextResponse.json({ ok: true, resetToken });
}
