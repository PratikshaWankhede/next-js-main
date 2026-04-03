import { db } from "@/db";
import {
  CHAT_CONVERSATIONS,
  CHAT_MESSAGES,
  CHAT_UPLOADS,
  INSTAGRAM_WEBHOOK_LOGS,
  USER,
} from "@/db/collections";
import type {
  ChatAttachmentType,
  ChatConversationDoc,
  ChatMessageDoc,
  ChatUploadDoc,
  InstagramWebhookLogDoc,
} from "@/db/collections";
import { regenerateLeadSummary } from "@/lib/ai/lead-summary";
import { createNotification } from "@/lib/notifications/create-notification";
import {
  appendAccessTokenToMetaCdnUrl,
  collectInstagramCdnFetchTokenCandidates,
} from "@/lib/instagram-env-tokens";
import { enrichLeadInstagramProfile } from "@/lib/instagram-lead-profile";
import { needsInstagramProfileEnrichment } from "@/lib/lead-display-name";
import { resolveLeadFromInboundMessage } from "@/lib/lead-resolver";
import { uploadChatFile } from "@/lib/storage/s3";
import { generateRandomUUID } from "@/helpers/generate-random-uuid";
import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.INSTAGRAM_VERIFY_TOKEN;
  if (
    mode === "subscribe" &&
    verifyToken &&
    token === verifyToken &&
    challenge
  ) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

function verifyInstagramSignature(
  rawBody: string,
  signature: string,
  secret: string,
): boolean {
  if (!signature.startsWith("sha256=")) return false;
  const expected =
    "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
  if (expected.length !== signature.length) return false;
  try {
    return timingSafeEqual(
      Buffer.from(expected, "utf8"),
      Buffer.from(signature, "utf8"),
    );
  } catch {
    return false;
  }
}

function attachmentTypeFromMime(mime?: string | null): ChatAttachmentType {
  if (!mime) return "file";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return "file";
}

/**
 * Meta CDN URLs (lookaside.fbsbx.com) require a valid access_token. `IGAA…` user tokens often fail;
 * try Page tokens first, then optional WhatsApp Page token — see collectInstagramCdnFetchTokenCandidates.
 */
async function fetchInstagramCdnAttachment(
  url: string,
): Promise<Response | null> {
  const candidates = collectInstagramCdnFetchTokenCandidates();
  if (candidates.length === 0) {
    console.error(
      "[Instagram] Media download: no token — set INSTAGRAM_ACCESS_TOKEN or INSTAGRAM_PAGE_ACCESS_TOKEN",
    );
    return null;
  }
  for (const { token, source } of candidates) {
    const withQuery = appendAccessTokenToMetaCdnUrl(url, token);
    let res = await fetch(withQuery);
    if (res.ok) return res;
    console.error(
      "[Instagram] Media download failed:",
      res.status,
      res.statusText,
      `source=${source}`,
    );
    if (res.status === 401 || res.status === 403) {
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) return res;
      console.error(
        "[Instagram] Media Bearer retry failed:",
        res.status,
        `source=${source}`,
      );
    }
  }
  return null;
}

function attachmentTypeFromInstagramPayload(
  igType: string | undefined,
  mime?: string | null,
): ChatAttachmentType {
  const t = (igType ?? "").toLowerCase();
  if (t === "image") return "image";
  if (t === "video") return "video";
  if (t === "ig_reel") return "video";
  if (t === "ig_post" || t === "share") {
    if (mime?.startsWith("video/")) return "video";
    if (mime?.startsWith("image/")) return "image";
    return "image";
  }
  return attachmentTypeFromMime(mime);
}

async function saveInstagramMediaToS3AndDb(params: {
  url: string;
  mimeTypeHint?: string | null;
  filenameHint?: string | null;
  instagramAttachmentType?: string | null;
}): Promise<{
  attachmentUrl: string;
  attachmentType: ChatAttachmentType;
} | null> {
  try {
    const fileRes = await fetchInstagramCdnAttachment(params.url);
    if (!fileRes?.ok) {
      return null;
    }
    const arrayBuffer = await fileRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType =
      fileRes.headers.get("content-type") ||
      params.mimeTypeHint ||
      "application/octet-stream";
    const filename =
      params.filenameHint ??
      `instagram-${Date.now()}`.replace(/[^a-zA-Z0-9._-]/g, "_");

    const uploaded = await uploadChatFile({
      buffer,
      contentType,
      filename,
    });

    const uploadId = generateRandomUUID();
    const uploadDoc: ChatUploadDoc = {
      id: uploadId,
      contentType,
      filename,
      createdAt: new Date(),
      s3Bucket: uploaded.bucket,
      s3Key: uploaded.key,
      size: uploaded.size,
    };
    await db.collection<ChatUploadDoc>(CHAT_UPLOADS).insertOne(uploadDoc);

    const attachmentUrl = `/api/uploads/${uploadId}`;
    const attachmentType = attachmentTypeFromInstagramPayload(
      params.instagramAttachmentType ?? undefined,
      contentType,
    );

    return { attachmentUrl, attachmentType };
  } catch (err) {
    console.error("[Instagram] Failed to save media to S3:", err);
    return null;
  }
}

async function resolveReplyToMessageId(
  conversationId: string,
  replyToMid?: string | null,
): Promise<string | null> {
  const trimmedMid = replyToMid?.trim();
  if (!trimmedMid) return null;

  const replyTarget = await db
    .collection<ChatMessageDoc>(CHAT_MESSAGES)
    .findOne(
      {
        conversationId,
        externalMessageId: trimmedMid,
      },
      {
        projection: { id: 1 },
      },
    );

  return replyTarget?.id ?? null;
}

export async function POST(req: NextRequest) {
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  if (appSecret) {
    const signature = req.headers.get("x-hub-signature-256");
    if (
      !signature ||
      !verifyInstagramSignature(rawBody, signature, appSecret)
    ) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let body: unknown;
  try {
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    process.env.INSTAGRAM_WEBHOOK_LOGS_ENABLED === "true" ||
    process.env.INSTAGRAM_WEBHOOK_LOGS_ENABLED === "1"
  ) {
    const webhookLogCol = db.collection<InstagramWebhookLogDoc>(
      INSTAGRAM_WEBHOOK_LOGS,
    );
    const logDoc: InstagramWebhookLogDoc = {
      id: generateRandomUUID(),
      receivedAt: new Date(),
      payload: body,
    };
    void webhookLogCol.insertOne(logDoc).catch(() => {});
  }

  const raw = Array.isArray(body) ? body[0] : body;
  const data = raw as {
    object?: string;
    entry?: unknown[];
    field?: string;
    value?: {
      sender?: { id: string };
      message?: { mid: string; text?: string };
    };
  };

  type MessageEvent = {
    sender: { id: string; username?: string };
    /** Present on echoes: the Instagram-scoped id of the customer who received your message. */
    recipient?: { id: string };
    message: {
      mid: string;
      text?: string;
      attachments?: unknown;
      /** Meta echoes your own outbound DMs (Instagram app, etc.); sender is the business account. */
      is_echo?: boolean;
    };
  };

  type InstagramReactionEvent = {
    sender: { id: string };
    reaction: {
      mid: string;
      emoji?: string;
      action?: string;
      reaction?: string;
    };
  };

  const messageEvents: MessageEvent[] = [];
  const reactionEvents: InstagramReactionEvent[] = [];

  if (
    data.field === "messages" &&
    data.value?.sender?.id &&
    data.value?.message
  ) {
    messageEvents.push({
      sender: data.value.sender as { id: string; username?: string },
      message: data.value.message,
    });
  } else if (data.object === "instagram" && Array.isArray(data.entry)) {
    for (const entry of data.entry as Array<{
      messaging?: unknown[];
      changes?: Array<{ field?: string; value?: MessageEvent }>;
    }>) {
      if (Array.isArray(entry.changes)) {
        for (const change of entry.changes) {
          if (
            change.field === "messages" &&
            change.value?.sender?.id &&
            change.value?.message
          ) {
            messageEvents.push(change.value);
          }
        }
      } else if (Array.isArray(entry.messaging)) {
        for (const raw of entry.messaging) {
          const event = raw as {
            sender?: { id: string; username?: string };
            message?: MessageEvent["message"];
            reaction?: InstagramReactionEvent["reaction"];
          };
          if (event.sender?.id && event.reaction?.mid) {
            reactionEvents.push({
              sender: event.sender,
              reaction: event.reaction,
            });
          }
          if (event.sender?.id && event.message) {
            messageEvents.push({
              sender: event.sender,
              recipient: (event as { recipient?: { id: string } }).recipient,
              message: event.message,
            });
          }
        }
      }
    }
  }

  const convCol = db.collection<ChatConversationDoc>(CHAT_CONVERSATIONS);
  const msgCol = db.collection<ChatMessageDoc>(CHAT_MESSAGES);

  for (const rev of reactionEvents) {
    const targetMid = rev.reaction.mid;
    const emoji = rev.reaction.emoji ?? "";
    const action = rev.reaction.action;
    const isUnreact = action === "unreact" || !emoji;

    const targetMsg = (await msgCol.findOne({
      externalMessageId: targetMid,
    })) as ChatMessageDoc | null;
    if (!targetMsg) continue;

    const conversation = (await convCol.findOne({
      id: targetMsg.conversationId,
    })) as ChatConversationDoc | null;
    if (!conversation) continue;

    const existingReactions =
      (targetMsg as { reactions?: Array<{ emoji: string; userId: string }> })
        .reactions ?? [];
    const otherReactions = existingReactions.filter(
      (r) => r.userId !== "client",
    );
    const newReactions = isUnreact
      ? otherReactions
      : [...otherReactions, { emoji, userId: "client" }];

    await msgCol.updateOne(
      { id: targetMsg.id },
      { $set: { reactions: newReactions } },
    );
  }

  if (messageEvents.length === 0) {
    return NextResponse.json({ ok: true });
  }

  const instagramBusinessAccountId =
    process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID?.trim() ?? null;

  type InstagramAttachment = {
    type?: string;
    mime_type?: string;
    payload?: { url?: string };
  };

  for (const event of messageEvents) {
    const sender = event.sender;
    const message = event.message;
    const recipient = event.recipient;

    const text = typeof message.text === "string" ? message.text : "";

    const attachments = Array.isArray(
      (message as { attachments?: InstagramAttachment[] }).attachments,
    )
      ? ((message as { attachments?: InstagramAttachment[] }).attachments ?? [])
      : [];

    let attachmentUrl: string | null = null;
    let attachmentType: ChatAttachmentType | null = null;

    if (attachments.length > 0) {
      for (const att of attachments) {
        const mediaUrl = att.payload?.url;
        if (!mediaUrl) continue;
        const saved = await saveInstagramMediaToS3AndDb({
          url: mediaUrl,
          mimeTypeHint: att.mime_type,
          filenameHint: null,
          instagramAttachmentType: att.type ?? null,
        });
        if (saved) {
          attachmentUrl = saved.attachmentUrl;
          attachmentType = saved.attachmentType;
          break;
        }
      }
    }

    const hadAttachmentAttempt = attachments.length > 0;
    const attachmentFailed = hadAttachmentAttempt && !attachmentUrl;
    if (!sender?.id) continue;
    if (!text && !attachmentUrl && !attachmentFailed) continue;

    let content = text;
    if (!content && attachmentFailed) {
      content =
        "[Image — could not download from Instagram. Use a Facebook Page access token (INSTAGRAM_PAGE_ACCESS_TOKEN) or check server logs.]";
    }

    /** Your reply from the Instagram app (or any client) — Meta sends is_echo; sender is the business id, customer is recipient. */
    const isBusinessOutbound =
      message.is_echo === true ||
      (Boolean(instagramBusinessAccountId) &&
        sender.id === instagramBusinessAccountId);

    if (isBusinessOutbound) {
      if (!recipient?.id) {
        continue;
      }

      const instagramUserId = recipient.id;
      const externalMessageId =
        message.mid ??
        `ig-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const lead = await resolveLeadFromInboundMessage({
        instagramUserId,
        instagramUsername: undefined,
        source: "instagram",
        instagramScope: "default",
      });

      let conversation: ChatConversationDoc | null = (await convCol.findOne({
        leadId: lead.id,
      })) as ChatConversationDoc | null;
      if (!conversation) {
        const created: ChatConversationDoc = {
          id: generateRandomUUID(),
          leadId: lead.id,
          createdAt: new Date(),
        };
        await convCol.insertOne(created);
        conversation = created;
      }

      const existingEcho = await msgCol.findOne({
        conversationId: conversation.id,
        externalMessageId,
      });
      if (existingEcho) {
        continue;
      }

      const replyToMessageId = await resolveReplyToMessageId(
        conversation.id,
        (
          message as {
            reply_to?: { mid?: string | null };
          }
        ).reply_to?.mid ?? null,
      );

      const echoRow: ChatMessageDoc = {
        id: generateRandomUUID(),
        conversationId: conversation.id,
        senderId: null,
        senderRole: "admin",
        content,
        createdAt: new Date(),
        channel: "instagram",
        direction: "outbound",
        externalMessageId,
        ...(attachmentUrl && { attachmentUrl }),
        ...(attachmentType && { attachmentType }),
        ...(replyToMessageId && { replyToMessageId }),
      };
      await msgCol.insertOne(echoRow);

      const wsUrl = process.env.WS_BROADCAST_URL || "http://localhost:3001";
      void fetch(`${wsUrl}/broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          message: {
            id: echoRow.id,
            content: echoRow.content,
            createdAt: echoRow.createdAt,
            senderId: echoRow.senderId,
            senderRole: echoRow.senderRole,
            channel: echoRow.channel,
            direction: echoRow.direction,
            attachmentUrl: echoRow.attachmentUrl,
            attachmentType: echoRow.attachmentType,
          },
        }),
      }).catch(() => {});

      continue;
    }

    const instagramUserId = sender.id;
    const instagramUsername = sender.username ?? undefined;
    const externalMessageId =
      message.mid ?? `ig-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    let lead = await resolveLeadFromInboundMessage({
      instagramUserId,
      instagramUsername,
      source: "instagram",
      instagramScope: "default",
    });

    if (needsInstagramProfileEnrichment(lead)) {
      const enriched = await enrichLeadInstagramProfile(lead.id);
      if (enriched) lead = enriched;
    }

    let conversation: ChatConversationDoc | null = (await convCol.findOne({
      leadId: lead.id,
    })) as ChatConversationDoc | null;
    if (!conversation) {
      const created: ChatConversationDoc = {
        id: generateRandomUUID(),
        leadId: lead.id,
        createdAt: new Date(),
      };
      await convCol.insertOne(created);
      conversation = created;
    }

    const existing = await msgCol.findOne({
      conversationId: conversation.id,
      externalMessageId,
    });
    if (existing) continue;

    const replyToMessageId = await resolveReplyToMessageId(
      conversation.id,
      (
        message as {
          reply_to?: { mid?: string | null };
        }
      ).reply_to?.mid ?? null,
    );

    const messageRow: ChatMessageDoc = {
      id: generateRandomUUID(),
      conversationId: conversation.id,
      senderId: null,
      senderRole: "client",
      content,
      createdAt: new Date(),
      channel: "instagram",
      direction: "inbound",
      externalMessageId,
      ...(attachmentUrl && { attachmentUrl }),
      ...(attachmentType && { attachmentType }),
      ...(replyToMessageId && { replyToMessageId }),
    };
    await msgCol.insertOne(messageRow);

    const wsUrl = process.env.WS_BROADCAST_URL || "http://localhost:3001";
    void fetch(`${wsUrl}/broadcast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId: lead.id,
        message: {
          id: messageRow.id,
          content: messageRow.content,
          createdAt: messageRow.createdAt,
          senderId: messageRow.senderId,
          senderRole: messageRow.senderRole,
          channel: messageRow.channel,
          direction: messageRow.direction,
          attachmentUrl: messageRow.attachmentUrl,
          attachmentType: messageRow.attachmentType,
        },
      }),
    }).catch(() => {});

    const targetUserIds: string[] = [];
    if (lead.assignedUserId && typeof lead.assignedUserId === "string") {
      targetUserIds.push(lead.assignedUserId);
    } else {
      const admins = await db
        .collection(USER)
        .find({ role: "admin" })
        .toArray();
      for (const a of admins) {
        const id = (a as { id?: string }).id;
        if (id) targetUserIds.push(id);
      }
    }
    if (targetUserIds.length > 0) {
      await createNotification({
        type: "new_inbound",
        title: "New Client Message",
        body: `${lead.name} (Instagram)`,
        leadId: lead.id,
        targetUserIds,
      });
    }

    void regenerateLeadSummary(lead.id).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
