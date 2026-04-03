import { db } from "@/db";
import { getSessionWithRole, requireAuth } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";

const COLLECTION = "push_subscriptions";

type PushSubscriptionBody = {
  endpoint: string;
  keys?: {
    p256dh: string;
    auth: string;
  };
};

export async function POST(req: NextRequest) {
  const session = await getSessionWithRole();
  requireAuth(session);

  let body: PushSubscriptionBody;
  try {
    body = (await req.json()) as PushSubscriptionBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.endpoint || !body.keys?.p256dh || !body.keys.auth) {
    return NextResponse.json(
      { error: "Invalid subscription payload" },
      { status: 400 },
    );
  }

  const now = new Date();

  await db.collection(COLLECTION).updateOne(
    {
      userId: session.user.id,
      endpoint: body.endpoint,
    },
    {
      $set: {
        userId: session.user.id,
        endpoint: body.endpoint,
        keys: body.keys,
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true },
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getSessionWithRole();
  requireAuth(session);

  const { searchParams } = new URL(req.url);
  const endpoint = searchParams.get("endpoint");
  if (!endpoint) {
    return NextResponse.json(
      { error: "Missing endpoint query parameter" },
      { status: 400 },
    );
  }

  await db.collection(COLLECTION).deleteOne({
    userId: session.user.id,
    endpoint,
  });

  return NextResponse.json({ ok: true });
}
