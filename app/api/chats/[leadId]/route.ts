import { db } from "@/db";
import {
  CHAT_CONVERSATIONS,
  CHAT_MESSAGES,
  INSTAGRAM_WEBHOOK_LOGS,
  LEADS,
} from "@/db/collections";
import type {
  ChatConversationDoc,
  ChatMessageDoc,
  InstagramWebhookLogDoc,
  LeadDoc,
} from "@/db/collections";
import { canAccessLead, getSessionWithRole, requireAuth } from "@/lib/rbac";
import { generateRandomUUID } from "@/helpers/generate-random-uuid";
import { normalizeChatAttachmentUrl } from "@/lib/chat-attachment-url";
import { NextRequest, NextResponse } from "next/server";

function getInstagramReplyMidMap(logs: InstagramWebhookLogDoc[]) {
  const replyMidByMessageMid = new Map<string, string>();

  for (const log of logs) {
    const payload = log.payload as
      | {
          entry?: Array<{
            messaging?: Array<{
              message?: {
                mid?: string;
                reply_to?: { mid?: string | null };
              };
            }>;
          }>;
        }
      | undefined;

    for (const entry of payload?.entry ?? []) {
      for (const event of entry.messaging ?? []) {
        const messageMid = event.message?.mid?.trim();
        const replyMid = event.message?.reply_to?.mid?.trim();
        if (messageMid && replyMid) {
          replyMidByMessageMid.set(messageMid, replyMid);
        }
      }
    }
  }

  return replyMidByMessageMid;
}

export async function GET(
  _req: NextRequest,
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

  let conversation: ChatConversationDoc | null = (await db
    .collection<ChatConversationDoc>(CHAT_CONVERSATIONS)
    .findOne({ leadId })) as ChatConversationDoc | null;

  if (!conversation) {
    const created: ChatConversationDoc = {
      id: generateRandomUUID(),
      leadId,
      createdAt: new Date(),
    };
    await db.collection(CHAT_CONVERSATIONS).insertOne(created);
    conversation = created;
  }

  const rawMessages = await db
    .collection<ChatMessageDoc>(CHAT_MESSAGES)
    .find({ conversationId: conversation.id })
    .sort({ createdAt: 1 })
    .project({
      id: 1,
      content: 1,
      createdAt: 1,
      senderId: 1,
      senderRole: 1,
      channel: 1,
      direction: 1,
      attachmentUrl: 1,
      attachmentType: 1,
      externalMessageId: 1,
      reactions: 1,
      replyToMessageId: 1,
    })
    .toArray();

  const missingInstagramReplyLinks = rawMessages.filter((m) => {
    const message = m as ChatMessageDoc;
    return (
      message.channel === "instagram" &&
      !message.replyToMessageId &&
      !!message.externalMessageId
    );
  });

  if (missingInstagramReplyLinks.length > 0) {
    const instagramLogs = await db
      .collection<InstagramWebhookLogDoc>(INSTAGRAM_WEBHOOK_LOGS)
      .find({})
      .sort({ receivedAt: -1 })
      .limit(500)
      .toArray();

    const replyMidByMessageMid = getInstagramReplyMidMap(instagramLogs);
    const messageIdByExternalMid = new Map<string, string>();
    for (const msg of rawMessages) {
      const externalMid = (msg as ChatMessageDoc).externalMessageId?.trim();
      if (externalMid) {
        messageIdByExternalMid.set(externalMid, msg.id);
      }
    }

    const recoveredReplyLinks = missingInstagramReplyLinks
      .map((msg) => {
        const externalMid = (msg as ChatMessageDoc).externalMessageId?.trim();
        if (!externalMid) return null;

        const replyMid = replyMidByMessageMid.get(externalMid);
        if (!replyMid) return null;

        const replyToMessageId = messageIdByExternalMid.get(replyMid);
        if (!replyToMessageId) return null;

        return { id: msg.id, replyToMessageId };
      })
      .filter(
        (value): value is { id: string; replyToMessageId: string } =>
          value != null,
      );

    if (recoveredReplyLinks.length > 0) {
      await Promise.all(
        recoveredReplyLinks.map(({ id, replyToMessageId }) =>
          db
            .collection<ChatMessageDoc>(CHAT_MESSAGES)
            .updateOne({ id }, { $set: { replyToMessageId } }),
        ),
      );

      for (const { id, replyToMessageId } of recoveredReplyLinks) {
        const target = rawMessages.find((msg) => msg.id === id);
        if (target) {
          (target as ChatMessageDoc).replyToMessageId = replyToMessageId;
        }
      }
    }
  }

  const replyToIds = rawMessages
    .map((m) => (m as { replyToMessageId?: string }).replyToMessageId)
    .filter((id): id is string => !!id);
  const replyToMap = new Map<
    string,
    { content: string; senderRole: string; attachmentType?: string }
  >();
  if (replyToIds.length > 0) {
    const replyToDocs = await db
      .collection<ChatMessageDoc>(CHAT_MESSAGES)
      .find({ id: { $in: replyToIds } })
      .project({ id: 1, content: 1, senderRole: 1, attachmentType: 1 })
      .toArray();
    for (const doc of replyToDocs) {
      replyToMap.set(doc.id, {
        content: doc.content || "",
        senderRole: doc.senderRole,
        attachmentType: doc.attachmentType ?? undefined,
      });
    }
  }

  const messages = rawMessages.map((m) => {
    const base = { ...m };
    const att = (m as { attachmentUrl?: string | null }).attachmentUrl;
    if (att != null && String(att).trim() !== "") {
      (base as Record<string, unknown>).attachmentUrl =
        normalizeChatAttachmentUrl(att) ?? att;
    }
    const replyId = (m as { replyToMessageId?: string }).replyToMessageId;
    if (replyId) {
      const ref = replyToMap.get(replyId);
      (base as Record<string, unknown>).replyTo = ref
        ? {
            id: replyId,
            content: ref.content.slice(0, 100),
            senderRole: ref.senderRole,
            attachmentType: ref.attachmentType,
          }
        : { id: replyId };
    }
    return base;
  });

  return NextResponse.json({
    conversationId: conversation.id,
    leadId,
    messages,
  });
}
