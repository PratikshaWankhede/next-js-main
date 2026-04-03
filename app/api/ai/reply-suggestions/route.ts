import { generateText } from "ai";
import { getModel } from "@/lib/ai/model";
import { db } from "@/db";
import { CHAT_CONVERSATIONS, CHAT_MESSAGES, LEADS } from "@/db/collections";
import type { ChatMessageDoc, LeadDoc } from "@/db/collections";
import { checkRateLimit } from "@/lib/ai/rate-limit";
import { canAccessLead, getSessionWithRole, requireAuth } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";

const MAX_CONTENT_CHARS = 4000;

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const session = await getSessionWithRole();
  requireAuth(session);

  if (!checkRateLimit(session.user.id)) {
    return NextResponse.json({ suggestions: [] });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data = body as { leadId?: string; channel?: string };
  const leadId = data.leadId;
  const channel = data.channel;

  if (typeof leadId !== "string" || !leadId.trim()) {
    return NextResponse.json({ error: "leadId is required" }, { status: 400 });
  }

  const validChannels = ["app", "whatsapp", "instagram"] as const;
  const channelVal = validChannels.includes(
    channel as (typeof validChannels)[number],
  )
    ? (channel as (typeof validChannels)[number])
    : "app";

  const lead = await db.collection<LeadDoc>(LEADS).findOne({ id: leadId });
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  if (!canAccessLead(session, lead)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const conversation = await db
    .collection(CHAT_CONVERSATIONS)
    .findOne({ leadId });

  if (!conversation) {
    return NextResponse.json({ suggestions: [] });
  }

  const allMessages = await db
    .collection<ChatMessageDoc>(CHAT_MESSAGES)
    .find({ conversationId: conversation.id })
    .sort({ createdAt: 1 })
    .project({ content: 1, senderRole: 1, direction: 1 })
    .toArray();

  const last10 = allMessages.slice(-10);
  const lastMessages: { role: "client" | "staff"; content: string }[] =
    last10.map((m) => {
      const isClient = m.senderRole === "client" || m.direction === "inbound";
      return {
        role: isClient ? "client" : "staff",
        content: m.content,
      };
    });

  let contentForPrompt = lastMessages
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");
  if (contentForPrompt.length > MAX_CONTENT_CHARS) {
    contentForPrompt =
      contentForPrompt.slice(-MAX_CONTENT_CHARS) + "\n[truncated]";
  }

  const systemPrompt = `You are a professional sales assistant for a CRM. Suggest 3 short, ready-to-send reply options for the staff member to respond to the client.

Rules:
- Professional, friendly sales tone
- Keep each suggestion under 2 sentences
- Do NOT mention pricing, discounts, or availability unless the client explicitly asked
- Do NOT make commitments or guarantees
- No medical or legal advice
- Support EN/Hindi mix if the conversation uses it

Output exactly 3 suggestions, one per line, numbered 1. 2. 3. Each line should be the reply text only.`;

  const userPrompt = `Lead: ${lead.name}
Stage: ${lead.stage}
Channel: ${channelVal}

Recent conversation:
${contentForPrompt || "(No messages yet)"}

Generate 3 short reply suggestions for the staff to send next:`;

  try {
    const { text } = await generateText({
      model: getModel(),
      system: systemPrompt,
      prompt: userPrompt,
    });

    const suggestions: string[] = [];
    const lines = text.split("\n").filter((l) => l.trim());
    for (const line of lines) {
      const cleaned = line.replace(/^\d+\.\s*/, "").trim();
      if (cleaned && suggestions.length < 3) {
        suggestions.push(cleaned);
      }
    }

    return NextResponse.json({
      suggestions: suggestions.slice(0, 3),
    });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
