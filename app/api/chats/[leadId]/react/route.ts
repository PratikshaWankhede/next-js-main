import { db } from "@/db";
import { CHAT_CONVERSATIONS, CHAT_MESSAGES, LEADS } from "@/db/collections";
import type {
  ChatConversationDoc,
  ChatMessageDoc,
  LeadDoc,
} from "@/db/collections";
import { canAccessLead, getSessionWithRole, requireAuth } from "@/lib/rbac";
import { sendInstagramReaction } from "@/lib/integrations/instagram";
import { sendWhatsAppReaction } from "@/lib/integrations/whatsapp";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> },
) {
  const session = await getSessionWithRole();
  requireAuth(session);

  const { leadId } = await params;

  const lead = await db.collection<LeadDoc>(LEADS).findOne({ id: leadId });
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  if (!canAccessLead(session, lead)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data = body as Record<string, unknown>;
  const messageId = typeof data.messageId === "string" ? data.messageId : "";
  const emoji = typeof data.emoji === "string" ? data.emoji : "";

  if (!messageId) {
    return NextResponse.json(
      { error: "messageId is required" },
      { status: 400 },
    );
  }

  const conversation = (await db
    .collection<ChatConversationDoc>(CHAT_CONVERSATIONS)
    .findOne({ leadId })) as ChatConversationDoc | null;

  if (!conversation) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 },
    );
  }

  const message = (await db.collection<ChatMessageDoc>(CHAT_MESSAGES).findOne({
    id: messageId,
    conversationId: conversation.id,
  })) as ChatMessageDoc | null;

  if (!message) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  const externalMessageId = message.externalMessageId;
  const channel = message.channel;

  if (!externalMessageId) {
    return NextResponse.json(
      {
        error:
          "This message has no external ID; reactions can only be synced for WhatsApp or Instagram messages that came from the channel.",
      },
      { status: 400 },
    );
  }

  if (channel !== "whatsapp" && channel !== "instagram") {
    return NextResponse.json(
      {
        error:
          "Reactions are only supported for WhatsApp and Instagram messages.",
      },
      { status: 400 },
    );
  }

  if (channel === "whatsapp") {
    const whatsappPhone =
      lead.whatsappPhone ?? (lead.source === "whatsapp" ? lead.phone : null);

    if (!whatsappPhone) {
      return NextResponse.json(
        { error: "Lead has no WhatsApp phone configured" },
        { status: 400 },
      );
    }

    const waOk = await sendWhatsAppReaction({
      phone: whatsappPhone,
      messageId: externalMessageId,
      emoji,
    });

    if (!waOk) {
      return NextResponse.json(
        { error: "Failed to send reaction to WhatsApp" },
        { status: 502 },
      );
    }
  } else {
    const instagramUserId = lead.instagramUserId;
    if (!instagramUserId) {
      return NextResponse.json(
        { error: "Lead has no Instagram user ID configured" },
        { status: 400 },
      );
    }

    const igOk = await sendInstagramReaction({
      instagramUserId,
      messageId: externalMessageId,
      emoji,
    });

    if (!igOk) {
      return NextResponse.json(
        { error: "Failed to send reaction to Instagram" },
        { status: 502 },
      );
    }
  }

  const staffUserId = session.user.id;
  const existingReactions =
    (message as { reactions?: Array<{ emoji: string; userId: string }> })
      .reactions ?? [];
  const otherReactions = existingReactions.filter(
    (r) => r.userId !== staffUserId,
  );
  const newReactions = emoji
    ? [...otherReactions, { emoji, userId: staffUserId }]
    : otherReactions;

  await db.collection(CHAT_MESSAGES).updateOne(
    { id: messageId },
    {
      $set: {
        reactions: newReactions.length ? newReactions : [],
      },
    },
  );

  const wsUrl = process.env.WS_BROADCAST_URL || "http://localhost:3001";
  void fetch(`${wsUrl}/broadcast`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      leadId,
      messageReaction: { messageId, reactions: newReactions },
    }),
  }).catch(() => {});

  return NextResponse.json({ ok: true, reactions: newReactions });
}
