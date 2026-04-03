import { db } from "@/db";
import {
  CHAT_CONVERSATIONS,
  CHAT_MESSAGES,
  CHAT_UPLOADS,
  LEAD_STAGE_HISTORY,
  LEADS,
} from "@/db/collections";
import type {
  ChatConversationDoc,
  ChatMessageDoc,
  ChatUploadDoc,
  LeadDoc,
} from "@/db/collections";
import type { ChatAttachmentType } from "@/db/collections";
import { canAccessLead, getSessionWithRole, requireAuth } from "@/lib/rbac";
import type { LeadStage } from "@/features/leads/types/lead.types";
import { sendInstagramMessage } from "@/lib/integrations/instagram";
import {
  sendWhatsAppMessage,
  uploadWhatsAppMedia,
} from "@/lib/integrations/whatsapp";
import { uploadChatFile } from "@/lib/storage/s3";
import { generateRandomUUID } from "@/helpers/generate-random-uuid";
import { publicUploadUrlForMeta } from "@/lib/chat-attachment-url";
import { NextRequest, NextResponse } from "next/server";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function attachmentTypeFromMime(mime: string): ChatAttachmentType {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return "file";
}

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

  const contentType = req.headers.get("content-type") || "";
  let content: string;
  let channel: "app" | "whatsapp" | "instagram";
  let replyToMessageId: string | null = null;
  let attachmentUrl: string | null = null;
  let attachmentType: ChatAttachmentType | null = null;
  let whatsappMediaId: string | null = null;
  /** In-memory file for Instagram → Meta Attachment Upload API (avoids blank media from URL fetch). */
  let outboundFileBuffer: Buffer | null = null;
  let outboundFileMime: string | null = null;
  let outboundFileName: string | null = null;

  const leadWhatsAppPhone =
    lead.whatsappPhone ?? (lead.source === "whatsapp" ? lead.phone : null);

  if (contentType.includes("multipart/form-data")) {
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
    }
    const contentVal = formData.get("content");
    content = typeof contentVal === "string" ? contentVal.trim() : "";
    const channelRaw = formData.get("channel");
    const ch =
      channelRaw === "whatsapp" || channelRaw === "instagram"
        ? channelRaw
        : "app";
    channel = ch;
    const replyVal = formData.get("replyToMessageId");
    replyToMessageId =
      typeof replyVal === "string" && replyVal.trim() ? replyVal.trim() : null;

    const file = formData.get("file");
    if (file && file instanceof File && file.size > 0) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: "File too large (max 10MB)" },
          { status: 400 },
        );
      }
      const uploadId = generateRandomUUID();
      const buffer = Buffer.from(await file.arrayBuffer());
      outboundFileBuffer = buffer;
      outboundFileMime = file.type;
      outboundFileName = file.name || null;

      let uploaded;
      try {
        uploaded = await uploadChatFile({
          buffer,
          contentType: file.type,
          filename: file.name || null,
        });
      } catch {
        return NextResponse.json(
          { error: "Failed to upload file to storage" },
          { status: 502 },
        );
      }

      const uploadDoc: ChatUploadDoc = {
        id: uploadId,
        contentType: file.type,
        filename: file.name || null,
        createdAt: new Date(),
        s3Bucket: uploaded.bucket,
        s3Key: uploaded.key,
        size: uploaded.size,
      };
      await db.collection<ChatUploadDoc>(CHAT_UPLOADS).insertOne(uploadDoc);
      attachmentType = attachmentTypeFromMime(file.type);

      // Same-origin path so chat images work in every environment (avoid localhost in DB).
      attachmentUrl = `/api/uploads/${uploadId}`;

      if (channel === "whatsapp") {
        const media = await uploadWhatsAppMedia({
          data: buffer,
          mimeType: file.type,
          filename: file.name || undefined,
        });
        if (!media) {
          return NextResponse.json(
            { error: "Failed to upload media to WhatsApp" },
            { status: 502 },
          );
        }
        whatsappMediaId = media.mediaId;
        await db
          .collection<ChatUploadDoc>(CHAT_UPLOADS)
          .updateOne(
            { id: uploadId },
            { $set: { whatsappMediaId: media.mediaId } },
          );
      }
    }
  } else {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const data = body as Record<string, unknown>;
    content = typeof data.content === "string" ? data.content.trim() : "";
    const channelRaw =
      (data.channel as "app" | "internal" | "whatsapp" | "instagram") ?? "app";
    channel = channelRaw === "internal" ? "app" : channelRaw;
    const replyVal = data.replyToMessageId;
    replyToMessageId =
      typeof replyVal === "string" && replyVal.trim() ? replyVal.trim() : null;
  }

  if (!content && !attachmentUrl && !whatsappMediaId) {
    return NextResponse.json(
      { error: "Content or attachment required" },
      { status: 400 },
    );
  }
  const trimmedContent = content || "";

  if (channel === "whatsapp" && !leadWhatsAppPhone) {
    return NextResponse.json(
      { error: "Lead has no WhatsApp phone configured" },
      { status: 400 },
    );
  }

  if (channel === "instagram" && !lead.instagramUserId) {
    return NextResponse.json(
      { error: "Lead has no Instagram user ID configured" },
      { status: 400 },
    );
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

  const role = session.role === "admin" ? "admin" : "sales";
  let externalMessageId: string | null = null;

  let replyToExternalId: string | undefined;
  if (replyToMessageId && (channel === "whatsapp" || channel === "instagram")) {
    const replyToMsg = (await db
      .collection<ChatMessageDoc>(CHAT_MESSAGES)
      .findOne({
        id: replyToMessageId,
        conversationId: conversation.id,
      })) as { externalMessageId?: string } | null;
    if (replyToMsg?.externalMessageId) {
      replyToExternalId = replyToMsg.externalMessageId;
    }
  }

  if (channel === "whatsapp" && leadWhatsAppPhone) {
    const result = await sendWhatsAppMessage({
      phone: leadWhatsAppPhone,
      content: trimmedContent,
      contextMessageId: replyToExternalId,
      ...(attachmentType &&
        (whatsappMediaId || attachmentUrl) && {
          attachment: {
            type: attachmentType,
            ...(whatsappMediaId
              ? { mediaId: whatsappMediaId }
              : { url: attachmentUrl! }),
          },
        }),
    });
    if (!result) {
      return NextResponse.json(
        { error: "Failed to send WhatsApp message" },
        { status: 502 },
      );
    }
    externalMessageId = result.externalMessageId;
  } else if (channel === "instagram" && lead.instagramUserId) {
    const result = await sendInstagramMessage({
      instagramUserId: lead.instagramUserId,
      content: trimmedContent,
      replyToMid: replyToExternalId,
      ...(attachmentUrl &&
        attachmentType && {
          attachment: outboundFileBuffer
            ? {
                type: attachmentType,
                file: {
                  buffer: outboundFileBuffer,
                  mimeType: outboundFileMime ?? "application/octet-stream",
                  filename: outboundFileName,
                },
                fallbackUrl: publicUploadUrlForMeta(attachmentUrl, req, {
                  forceProxy: true,
                }),
              }
            : {
                type: attachmentType,
                url: publicUploadUrlForMeta(attachmentUrl, req, {
                  forceProxy: true,
                }),
              },
        }),
    });
    if (!result) {
      return NextResponse.json(
        { error: "Failed to send Instagram message" },
        { status: 502 },
      );
    }
    externalMessageId = result.externalMessageId;
  }

  const now = new Date();
  const message: ChatMessageDoc = {
    id: generateRandomUUID(),
    conversationId: conversation.id,
    senderId: session.user.id,
    senderRole: role,
    content: trimmedContent,
    createdAt: now,
    channel,
    direction: channel === "app" ? null : "outbound",
    externalMessageId,
    ...(attachmentUrl && { attachmentUrl }),
    ...(attachmentType && { attachmentType }),
    ...(replyToMessageId && { replyToMessageId }),
  };
  await db.collection(CHAT_MESSAGES).insertOne(message);

  if (lead.firstResponseAt == null) {
    await db.collection(LEADS).updateOne(
      { id: leadId },
      {
        $set: {
          firstResponseAt: now,
          slaStatus: "met",
          updatedAt: now,
        },
      },
    );
  }

  const currentStage = lead.stage as LeadStage;
  if (currentStage === "new") {
    await db.collection(LEAD_STAGE_HISTORY).insertOne({
      id: generateRandomUUID(),
      leadId,
      fromStage: "new",
      toStage: "contacted",
      changedByUserId: session.user.id,
      changedAt: now,
    });
    await db
      .collection(LEADS)
      .updateOne(
        { id: leadId },
        { $set: { stage: "contacted", updatedAt: now } },
      );
  }

  const wsUrl = process.env.WS_BROADCAST_URL || "http://localhost:3001";
  void fetch(`${wsUrl}/broadcast`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ leadId, message }),
  }).catch(() => {});

  const response = { ...message };
  if (replyToMessageId) {
    const replyToMsg = (await db
      .collection<ChatMessageDoc>(CHAT_MESSAGES)
      .findOne(
        { id: replyToMessageId },
        { projection: { id: 1, content: 1, senderRole: 1, attachmentType: 1 } },
      )) as {
      id: string;
      content: string;
      senderRole: string;
      attachmentType?: string;
    } | null;
    if (replyToMsg) {
      (response as Record<string, unknown>).replyTo = {
        id: replyToMsg.id,
        content: replyToMsg.content?.slice(0, 100),
        senderRole: replyToMsg.senderRole,
        attachmentType: replyToMsg.attachmentType,
      };
    }
  }

  return NextResponse.json(response);
}
