import { db } from "@/db";
import {
  WHATSAPP_NUMBERS,
  type WhatsAppBusinessNumberDoc,
} from "@/db/collections";
import { getSessionWithRole, requireAdmin, requireAuth } from "@/lib/rbac";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getSessionWithRole();
  requireAuth(session);
  requireAdmin(session);

  const col = db.collection<WhatsAppBusinessNumberDoc>(WHATSAPP_NUMBERS);
  const numbers = await col
    .find({})
    .sort({ displayPhoneNumber: 1 })
    .project({
      _id: 0,
      phoneNumberId: 1,
      displayPhoneNumber: 1,
    })
    .toArray();

  return NextResponse.json({ numbers });
}

