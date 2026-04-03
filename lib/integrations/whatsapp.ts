/**
 * WhatsApp outbound adapter - sends messages via Meta Cloud API.
 * Returns externalMessageId on success, null on failure.
 */

export type WhatsAppAttachmentType = "image" | "video" | "file";

export async function uploadWhatsAppMedia({
  data,
  mimeType,
  filename,
}: {
  data: Buffer;
  mimeType: string;
  filename?: string;
}): Promise<{ mediaId: string } | null> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    console.warn(
      "[WhatsApp] Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID",
    );
    return null;
  }

  try {
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    const withBuffer = data as unknown as { buffer?: ArrayBuffer };
    const arrayBuffer =
      withBuffer && withBuffer.buffer instanceof ArrayBuffer
        ? withBuffer.buffer
        : await (async () => {
            // Fallback: create ArrayBuffer from Uint8Array view
            const view = new Uint8Array(data);
            return view.buffer;
          })();

    form.append(
      "file",
      new Blob([arrayBuffer], { type: mimeType }),
      filename || "upload",
    );

    const res = await fetch(
      `https://graph.facebook.com/v22.0/${phoneNumberId}/media`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: form,
      },
    );

    const json = (await res.json()) as {
      id?: string;
      error?: { message?: string };
    };

    if (!res.ok || !json.id) {
      console.error(
        "[WhatsApp] Media upload error:",
        json.error?.message ?? res.statusText,
      );
      return null;
    }

    return { mediaId: json.id };
  } catch (err) {
    console.error("[WhatsApp] Media upload failed:", err);
    return null;
  }
}

export async function sendWhatsAppMessage({
  phone,
  content,
  attachment,
  contextMessageId,
}: {
  phone: string;
  content: string;
  attachment?: {
    type: WhatsAppAttachmentType;
    url?: string;
    mediaId?: string;
  };
  /** WhatsApp message ID (wamid) to reply to - creates quoted reply bubble */
  contextMessageId?: string;
}): Promise<{ externalMessageId: string } | null> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    console.warn(
      "[WhatsApp] Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID",
    );
    return { externalMessageId: `stub-wa-${Date.now()}` };
  }

  const normalizedPhone = phone.startsWith("+") ? phone : `+${phone}`;
  const to = normalizedPhone.replace(/\D/g, "");

  const basePayload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    ...(contextMessageId && {
      context: { message_id: contextMessageId },
    }),
  };

  const apiBase = `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`;

  try {
    if (attachment) {
      const type = attachment.type === "file" ? "document" : attachment.type;
      const mediaPayloadKey = attachment.mediaId ? "id" : "link";
      const mediaPayloadValue =
        attachment.mediaId ?? attachment.url ?? undefined;

      if (!mediaPayloadValue) {
        console.warn(
          "[WhatsApp] attachment specified without mediaId or url; falling back to text-only message.",
        );
      } else {
        const body: Record<string, unknown> = {
          ...basePayload,
          type,
          [type]: { [mediaPayloadKey]: mediaPayloadValue },
        };
        const res = await fetch(apiBase, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });
        const json = (await res.json()) as {
          messages?: Array<{ id: string }>;
          error?: { message: string };
        };
        if (!res.ok) {
          console.error(
            "[WhatsApp] API error:",
            json.error?.message ?? res.statusText,
          );
          return null;
        }
        const messageId = json.messages?.[0]?.id;
        if (messageId) return { externalMessageId: messageId };
        return null;
      }
    }

    const res = await fetch(apiBase, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        ...basePayload,
        type: "text",
        text: { body: content },
      }),
    });

    const json = (await res.json()) as {
      messages?: Array<{ id: string }>;
      error?: { message: string };
    };

    if (!res.ok) {
      console.error(
        "[WhatsApp] API error:",
        json.error?.message ?? res.statusText,
      );
      return null;
    }

    const messageId = json.messages?.[0]?.id;
    if (messageId) return { externalMessageId: messageId };
    console.error("[WhatsApp] No message id in response");
    return null;
  } catch (err) {
    console.error("[WhatsApp] Send failed:", err);
    return null;
  }
}

/**
 * Send a reaction to a WhatsApp message. Uses Meta Cloud API reaction type.
 * Pass empty emoji to remove the reaction.
 */
export async function sendWhatsAppReaction({
  phone,
  messageId,
  emoji,
}: {
  phone: string;
  messageId: string;
  emoji: string;
}): Promise<boolean> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    console.warn(
      "[WhatsApp] Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID",
    );
    return false;
  }

  const normalizedPhone = phone.startsWith("+") ? phone : `+${phone}`;
  const to = normalizedPhone.replace(/\D/g, "");

  const apiBase = `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`;

  try {
    const body = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "reaction",
      reaction: {
        message_id: messageId,
        emoji: emoji || "",
      },
    };

    const res = await fetch(apiBase, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const json = (await res.json()) as { error?: { message: string } };

    if (!res.ok) {
      console.error(
        "[WhatsApp] Reaction API error:",
        json.error?.message ?? res.statusText,
      );
      return false;
    }

    return true;
  } catch (err) {
    console.error("[WhatsApp] Reaction send failed:", err);
    return false;
  }
}
