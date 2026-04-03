import { db } from "@/db";
import {
  CHAT_CONVERSATIONS,
  CHAT_MESSAGES,
  CHAT_UPLOADS,
  LEADS,
  USER,
  WHATSAPP_NUMBERS,
  WHATSAPP_WEBHOOK_LOGS,
} from "@/db/collections";
import type {
  ChatAttachmentType,
  ChatConversationDoc,
  ChatMessageDoc,
  ChatUploadDoc,
  WhatsAppBusinessNumberDoc,
  WhatsAppWebhookLogDoc,
} from "@/db/collections";
import { regenerateLeadSummary } from "@/lib/ai/lead-summary";
import { createNotification } from "@/lib/notifications/create-notification";
import { resolveLeadFromInboundMessage } from "@/lib/lead-resolver";
import { uploadChatFile } from "@/lib/storage/s3";
import { generateRandomUUID } from "@/helpers/generate-random-uuid";
import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("0") ? `+${digits.slice(1)}` : `+${digits}`;
}

function attachmentTypeFromMime(mime?: string | null): ChatAttachmentType {
  if (!mime) return "file";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return "file";
}

async function saveWhatsAppMediaToS3AndDb(params: {
  mediaId: string;
  mimeTypeHint?: string | null;
  filenameHint?: string | null;
}): Promise<{
  attachmentUrl: string;
  attachmentType: ChatAttachmentType;
} | null> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) {
    console.warn(
      "[WhatsApp] Missing WHATSAPP_ACCESS_TOKEN, cannot download media.",
    );
    return null;
  }

  try {
    const metaRes = await fetch(
      `https://graph.facebook.com/v22.0/${encodeURIComponent(params.mediaId)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    if (!metaRes.ok) {
      console.error(
        "[WhatsApp] Media metadata fetch failed:",
        metaRes.status,
        metaRes.statusText,
      );
      return null;
    }
    const meta = (await metaRes.json()) as {
      url?: string;
      mime_type?: string;
      file_size?: number;
      filename?: string;
    };
    if (!meta.url) {
      console.warn("[WhatsApp] Media metadata has no url field.");
      return null;
    }

    const fileRes = await fetch(meta.url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!fileRes.ok) {
      console.error(
        "[WhatsApp] Media download failed:",
        fileRes.status,
        fileRes.statusText,
      );
      return null;
    }
    const arrayBuffer = await fileRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType =
      fileRes.headers.get("content-type") ||
      meta.mime_type ||
      params.mimeTypeHint ||
      "application/octet-stream";
    const filename =
      meta.filename ??
      params.filenameHint ??
      `whatsapp-${params.mediaId}`.replace(/[^a-zA-Z0-9._-]/g, "_");

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
    const attachmentType = attachmentTypeFromMime(contentType);

    return { attachmentUrl, attachmentType };
  } catch (err) {
    console.error("[WhatsApp] Failed to save media to S3:", err);
    return null;
  }
}

function verifyWhatsAppSignature(
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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
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

export async function POST(req: NextRequest) {
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const appSecret = process.env.WHATSAPP_APP_SECRET;
  const skipVerification =
    process.env.WHATSAPP_SKIP_SIGNATURE_VERIFICATION === "true" ||
    process.env.WHATSAPP_SKIP_SIGNATURE_VERIFICATION === "1";

  if (appSecret && !skipVerification) {
    const signature = req.headers.get("x-hub-signature-256");
    if (!signature || !verifyWhatsAppSignature(rawBody, signature, appSecret)) {
      // Debug: help diagnose 401s (remove or reduce in production)
      console.warn("[WhatsApp] Signature verification failed:", {
        hasSignature: !!signature,
        rawBodyLength: rawBody?.length ?? 0,
        rawBodyPreview: rawBody?.slice(0, 80) ?? "(empty)",
      });
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
    process.env.WHATSAPP_WEBHOOK_LOGS_ENABLED === "true" ||
    process.env.WHATSAPP_WEBHOOK_LOGS_ENABLED === "1"
  ) {
    const webhookLogCol = db.collection<WhatsAppWebhookLogDoc>(
      WHATSAPP_WEBHOOK_LOGS,
    );
    const logDoc: WhatsAppWebhookLogDoc = {
      id: generateRandomUUID(),
      receivedAt: new Date(),
      payload: body,
    };
    void webhookLogCol.insertOne(logDoc).catch(() => {});
  }

  const data = body as {
    object?: string;
    entry?: Array<{
      changes?: Array<{
        value?: {
          metadata?: {
            phone_number_id?: string;
            display_phone_number?: string;
          };
          contacts?: Array<{
            profile?: { name?: string };
            wa_id?: string;
          }>;
          messages?: Array<{
            from: string;
            id: string;
            type?: string;
            text?: { body: string };
            // Media payloads are loosely typed; we access them via `any`.
          }>;
        };
      }>;
    }>;
  };
  if (
    data.object !== "whatsapp_business_account" ||
    !Array.isArray(data.entry)
  ) {
    return NextResponse.json({ ok: true });
  }

  const convCol = db.collection<ChatConversationDoc>(CHAT_CONVERSATIONS);
  const msgCol = db.collection<ChatMessageDoc>(CHAT_MESSAGES);
  const numbersCol = db.collection<WhatsAppBusinessNumberDoc>(WHATSAPP_NUMBERS);

  for (const entry of data.entry) {
    const changes = entry.changes ?? [];
    for (const change of changes) {
      const value = change.value;
      const messages = value?.messages ?? [];
      const metadata = value?.metadata;
      const contacts = value?.contacts ?? [];
      const whatsappPhoneNumberId = metadata?.phone_number_id;
      const displayPhoneNumber = metadata?.display_phone_number;

      if (whatsappPhoneNumberId && displayPhoneNumber) {
        const now = new Date();
        await numbersCol.updateOne(
          { phoneNumberId: whatsappPhoneNumberId },
          {
            $set: {
              phoneNumberId: whatsappPhoneNumberId,
              displayPhoneNumber,
              updatedAt: now,
            },
            $setOnInsert: {
              id: generateRandomUUID(),
              createdAt: now,
            },
          },
          { upsert: true },
        );
      }
      type WhatsAppMediaPayload = {
        id?: string;
        mime_type?: string;
        filename?: string;
      };

      type WhatsAppMessage = {
        from: string;
        id: string;
        type?: string;
        text?: { body: string };
        image?: WhatsAppMediaPayload;
        video?: WhatsAppMediaPayload;
        document?: WhatsAppMediaPayload;
        caption?: string;
        reaction?: { message_id?: string; emoji?: string };
        context?: { id?: string };
      };

      for (const msg of messages) {
        const waMsg = msg as WhatsAppMessage;
        const msgType = waMsg.type ?? "text";

        if (msgType === "reaction") {
          const reaction = waMsg.reaction;
          const targetMessageId = reaction?.message_id;
          const emoji = reaction?.emoji ?? "";
          if (!targetMessageId) continue;

          const targetMsg = (await msgCol.findOne({
            externalMessageId: targetMessageId,
          })) as ChatMessageDoc | null;
          if (!targetMsg) continue;

          const conversation = (await convCol.findOne({
            id: targetMsg.conversationId,
          })) as ChatConversationDoc | null;
          if (!conversation) continue;

          const lead = (await db
            .collection(LEADS)
            .findOne({ id: conversation.leadId })) as { id: string } | null;
          if (!lead) continue;

          const existingReactions =
            (
              targetMsg as {
                reactions?: Array<{ emoji: string; userId: string }>;
              }
            ).reactions ?? [];
          const otherReactions = existingReactions.filter(
            (r) => r.userId !== "client",
          );
          const newReactions = emoji
            ? [...otherReactions, { emoji, userId: "client" }]
            : otherReactions;

          await msgCol.updateOne(
            { id: targetMsg.id },
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
              leadId: lead.id,
              messageReaction: {
                messageId: targetMsg.id,
                reactions: newReactions,
              },
            }),
          }).catch(() => {});
          continue;
        }

        let content = "";
        let attachmentUrl: string | null = null;
        let attachmentType: ChatAttachmentType | null = null;

        if (msgType === "text" && waMsg.text?.body) {
          content = waMsg.text.body;
        } else if (
          msgType === "image" ||
          msgType === "video" ||
          msgType === "document"
        ) {
          let media: WhatsAppMediaPayload | undefined;
          if (msgType === "image") media = waMsg.image;
          if (msgType === "video") media = waMsg.video;
          if (msgType === "document") media = waMsg.document;
          const mediaId = media?.id;
          if (!mediaId) continue;

          const caption =
            typeof waMsg.caption === "string" ? waMsg.caption : "";
          const saved = await saveWhatsAppMediaToS3AndDb({
            mediaId,
            mimeTypeHint: media?.mime_type,
            filenameHint: media?.filename ?? null,
          });
          if (!saved) continue;
          attachmentUrl = saved.attachmentUrl;
          attachmentType = saved.attachmentType;
          content = caption;
        } else {
          // Unsupported message type for now.
          continue;
        }

        const phone = normalizePhone(msg.from);
        const externalMessageId = msg.id;

        let replyToMessageId: string | null = null;
        const contextId = waMsg.context?.id;
        if (contextId) {
          const refMsg = (await msgCol.findOne({
            externalMessageId: contextId,
          })) as { id: string } | null;
          if (refMsg) replyToMessageId = refMsg.id;
        }

        const contact = contacts.find(
          (c) => c.wa_id === msg.from || c.wa_id === phone,
        );
        const contactName = contact?.profile?.name?.trim();

        const lead = await resolveLeadFromInboundMessage({
          whatsappPhone: phone,
          whatsappContactName: contactName,
          whatsappPhoneNumberId,
          source: "whatsapp",
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

        const existing = await msgCol.findOne({
          conversationId: conversation.id,
          externalMessageId,
        });
        if (existing) continue;

        const message: ChatMessageDoc = {
          id: generateRandomUUID(),
          conversationId: conversation.id,
          senderId: null,
          senderRole: "client",
          content,
          createdAt: new Date(),
          channel: "whatsapp",
          direction: "inbound",
          externalMessageId,
          ...(attachmentUrl && { attachmentUrl }),
          ...(attachmentType && { attachmentType }),
          ...(replyToMessageId && { replyToMessageId }),
        };
        await msgCol.insertOne(message);

        const wsUrl = process.env.WS_BROADCAST_URL || "http://localhost:3001";
        void fetch(`${wsUrl}/broadcast`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            leadId: lead.id,
            message: {
              id: message.id,
              content: message.content,
              createdAt: message.createdAt,
              senderId: message.senderId,
              senderRole: message.senderRole,
              channel: message.channel,
              direction: message.direction,
              attachmentUrl: message.attachmentUrl,
              attachmentType: message.attachmentType,
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
            body: `${lead.name} (WhatsApp)`,
            leadId: lead.id,
            targetUserIds,
          });
        }

        void regenerateLeadSummary(lead.id).catch(() => {});
      }
    }
  }

  return NextResponse.json({ ok: true });
}
