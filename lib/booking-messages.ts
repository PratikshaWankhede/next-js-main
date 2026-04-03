import { parseDocument } from "htmlparser2";

import { db } from "@/db";
import { CHAT_CONVERSATIONS, CHAT_MESSAGES } from "@/db/collections";
import type {
  ChatConversationDoc,
  ChatMessageDoc,
  LeadDoc,
  MessageChannel,
  SenderRole,
} from "@/db/collections";
import { getBookingTemplateParts } from "@/lib/booking-datetime";
import { getBookingTemplates } from "@/lib/booking-templates";
import { sendWhatsAppMessage } from "@/lib/integrations/whatsapp";
import { sendInstagramMessage } from "@/lib/integrations/instagram";
import { generateRandomUUID } from "@/helpers/generate-random-uuid";

type BookingMessageKind = "confirmation" | "reminder" | "review";

interface BookingMessageOptions {
  triggeredByUserId?: string;
  triggeredByRole?: Extract<SenderRole, "admin" | "sales">;
}

type HtmlNode = {
  type?: string;
  name?: string;
  data?: unknown;
  attribs?: { href?: string };
  childNodes?: HtmlNode[];
};

function htmlToWhatsApp(body: string): string {
  // Fast path for plain-text content.
  if (!body.includes("<")) {
    return body.trim();
  }

  const doc = parseDocument(body);
  const parts: string[] = [];

  const hasMeaningfulText = (
    n: HtmlNode | HtmlNode[] | null | undefined,
  ): boolean => {
    if (!n) return false;
    if (Array.isArray(n)) {
      return n.some((child) => hasMeaningfulText(child));
    }
    if (n.type === "text") {
      return typeof n.data === "string" && n.data.trim().length > 0;
    }
    if (n.type === "tag") {
      const childTag = typeof n.name === "string" ? n.name.toLowerCase() : "";
      // Treat pure <br> wrappers as non-content.
      if (childTag === "br") return false;
      return (n.childNodes ?? []).some((child) => hasMeaningfulText(child));
    }
    return false;
  };

  const walk = (node: HtmlNode | HtmlNode[] | null | undefined) => {
    if (!node) return;

    if (Array.isArray(node)) {
      node.forEach((child) => walk(child));
      return;
    }

    if (node.type === "text") {
      const data = typeof node.data === "string" ? node.data : "";
      parts.push(data);
      return;
    }

    if (node.type === "tag") {
      const tag = typeof node.name === "string" ? node.name.toLowerCase() : "";

      switch (tag) {
        case "br": {
          parts.push("\n");
          return;
        }
        case "p": {
          node.childNodes?.forEach((child) => walk(child));
          parts.push("\n\n");
          return;
        }
        case "strong":
        case "b": {
          if (!hasMeaningfulText(node.childNodes ?? [])) {
            node.childNodes?.forEach((child) => walk(child));
            return;
          }
          parts.push("*");
          node.childNodes?.forEach((child) => walk(child));
          parts.push("*");
          return;
        }
        case "em":
        case "i": {
          if (!hasMeaningfulText(node.childNodes ?? [])) {
            node.childNodes?.forEach((child) => walk(child));
            return;
          }
          parts.push("_");
          node.childNodes?.forEach((child) => walk(child));
          parts.push("_");
          return;
        }
        case "s":
        case "strike":
        case "del": {
          if (!hasMeaningfulText(node.childNodes ?? [])) {
            node.childNodes?.forEach((child) => walk(child));
            return;
          }
          parts.push("~");
          node.childNodes?.forEach((child) => walk(child));
          parts.push("~");
          return;
        }
        case "a": {
          const href: string =
            (node.attribs && typeof node.attribs.href === "string"
              ? node.attribs.href
              : "") || "";
          const before = parts.length;
          node.childNodes?.forEach((child) => walk(child));
          const visibleText = parts.slice(before).join("").trim();
          if (href && href !== visibleText) {
            parts.push(` (${href})`);
          }
          return;
        }
        case "ul":
        case "ol": {
          let index = 1;
          node.childNodes?.forEach((child) => {
            if (
              child.type === "tag" &&
              typeof child.name === "string" &&
              child.name.toLowerCase() === "li"
            ) {
              const prefix = tag === "ol" ? `${index}. ` : "- ";
              parts.push(prefix);
              walk(child);
              parts.push("\n");
              index += 1;
            }
          });
          parts.push("\n");
          return;
        }
        case "li": {
          node.childNodes?.forEach((child) => walk(child));
          return;
        }
        default: {
          node.childNodes?.forEach((child) => walk(child));
          return;
        }
      }
    }
  };

  (doc.childNodes as HtmlNode[] | undefined)?.forEach((node) => walk(node));

  let text = parts.join("");

  // Normalize whitespace and newlines.
  text = text.replace(/\r\n/g, "\n");
  text = text.replace(/[ \t]+\n/g, "\n");
  text = text.replace(/\n{3,}/g, "\n\n");

  return text.trim();
}

function renderTemplate(
  body: string,
  context: Record<string, string | number>,
): string {
  return body.replace(/{{(\w+)}}/g, (_, key: string) => {
    const value = context[key];
    return value == null ? "" : String(value);
  });
}

async function recordBookingChatMessage(opts: {
  lead: LeadDoc;
  content: string;
  channel: Exclude<MessageChannel, "app">;
  externalMessageId?: string | null;
  triggeredByUserId?: string;
  triggeredByRole?: Extract<SenderRole, "admin" | "sales">;
}) {
  const {
    lead,
    content,
    channel,
    externalMessageId,
    triggeredByRole,
    triggeredByUserId,
  } = opts;

  // Safety: do not record empty messages.
  if (!content.trim()) return;

  const conversationsCol =
    db.collection<ChatConversationDoc>(CHAT_CONVERSATIONS);
  const messagesCol = db.collection<ChatMessageDoc>(CHAT_MESSAGES);

  const now = new Date();

  const existingConversation = await conversationsCol.findOne({
    leadId: lead.id,
  });

  let conversationId: string;

  if (existingConversation) {
    conversationId = existingConversation.id;
  } else {
    const created: ChatConversationDoc = {
      id: generateRandomUUID(),
      leadId: lead.id,
      createdAt: now,
    };
    await conversationsCol.insertOne(created);
    conversationId = created.id;
  }

  const senderRole: SenderRole = triggeredByRole ?? "admin";

  const message: ChatMessageDoc = {
    id: generateRandomUUID(),
    conversationId: conversationId,
    senderId: triggeredByUserId ?? null,
    senderRole,
    content,
    createdAt: now,
    channel,
    direction: "outbound",
    externalMessageId: externalMessageId ?? null,
  };

  await messagesCol.insertOne(message);

  const wsUrl = process.env.WS_BROADCAST_URL || "http://localhost:3001";
  void fetch(`${wsUrl}/broadcast`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ leadId: lead.id, message }),
  }).catch(() => {});
}

export async function sendBookingMessageForLead(
  lead: LeadDoc,
  kind: BookingMessageKind,
  options?: BookingMessageOptions,
): Promise<boolean> {
  const templates = await getBookingTemplates();

  const appointmentDate =
    lead.appointmentDate instanceof Date
      ? lead.appointmentDate
      : lead.appointmentDate
        ? new Date(lead.appointmentDate)
        : null;

  const parts = appointmentDate
    ? getBookingTemplateParts(appointmentDate)
    : null;
  const dateStr = parts?.dateStr ?? "";
  const timeStr = parts?.timeStr ?? "";
  const dayStr = parts?.dayStr ?? "";

  const context: Record<string, string | number> = {
    client_name: lead.name,
    phone: lead.phone,
    appointment_date: dateStr,
    appointment_day: dayStr,
    appointment_time: timeStr,
    advance_amount:
      typeof lead.advanceAmount === "number" ? lead.advanceAmount : "",
    artist_name: lead.artistName ?? "",
    lead_source: lead.source,
  };

  let body: string;
  switch (kind) {
    case "confirmation":
      body = templates.bookingConfirmationBody;
      break;
    case "reminder":
      body = templates.bookingReminderBody;
      break;
    case "review":
      body = templates.bookingReviewBody;
      break;
    default:
      return false;
  }

  // Templates are stored as HTML. Convert the rendered HTML
  // into WhatsApp-friendly formatting before sending.
  const renderedHtml = renderTemplate(body, context);
  const content = htmlToWhatsApp(renderedHtml);
  if (!content.trim()) return false;

  // Prefer WhatsApp when possible, then Instagram.
  if (lead.whatsappPhone) {
    const result = await sendWhatsAppMessage({
      phone: lead.whatsappPhone,
      content,
    });

    if (!result) {
      return false;
    }

    await recordBookingChatMessage({
      lead,
      content,
      channel: "whatsapp",
      externalMessageId: result.externalMessageId,
      triggeredByUserId: options?.triggeredByUserId,
      triggeredByRole: options?.triggeredByRole,
    });

    return true;
  }

  if (lead.instagramUserId) {
    const result = await sendInstagramMessage({
      instagramUserId: lead.instagramUserId,
      content,
    });

    if (!result) {
      return false;
    }

    await recordBookingChatMessage({
      lead,
      content,
      channel: "instagram",
      externalMessageId: result.externalMessageId,
      triggeredByUserId: options?.triggeredByUserId,
      triggeredByRole: options?.triggeredByRole,
    });

    return true;
  }

  return false;
}
