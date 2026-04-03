import { generateText } from "ai";
import { getModel } from "@/lib/ai/model";
import { db } from "@/db";
import {
  CHAT_CONVERSATIONS,
  CHAT_MESSAGES,
  FOLLOW_UPS,
  LEADS,
  SLA_LOGS,
} from "@/db/collections";
import type { ChatMessageDoc, LeadDoc } from "@/db/collections";
import { checkRateLimit } from "@/lib/ai/rate-limit";
import { getSessionWithRole, requireAdmin, requireAuth } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";

const MAX_CONTENT_CHARS = 4000;

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const session = await getSessionWithRole();
  requireAuth(session);
  requireAdmin(session);

  if (!checkRateLimit(session.user.id)) {
    return NextResponse.json({
      insight: "",
      error: "Rate limit exceeded. Try again in a minute.",
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data = body as { leadId?: string };
  const leadId = data.leadId;

  if (typeof leadId !== "string" || !leadId.trim()) {
    return NextResponse.json({ error: "leadId is required" }, { status: 400 });
  }

  const lead = await db.collection<LeadDoc>(LEADS).findOne({ id: leadId });
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const followUpsList = await db
    .collection(FOLLOW_UPS)
    .find({ leadId })
    .toArray();

  const slaLogsList = await db.collection(SLA_LOGS).find({ leadId }).toArray();

  const conversation = await db
    .collection(CHAT_CONVERSATIONS)
    .findOne({ leadId });

  let conversationText = "";
  if (conversation) {
    const msgs = await db
      .collection<ChatMessageDoc>(CHAT_MESSAGES)
      .find({ conversationId: conversation.id })
      .sort({ createdAt: 1 })
      .project({ content: 1, senderRole: 1 })
      .toArray();
    conversationText = msgs
      .map((m) => `${m.senderRole}: ${m.content}`)
      .join("\n");
    if (conversationText.length > MAX_CONTENT_CHARS) {
      conversationText =
        conversationText.slice(-MAX_CONTENT_CHARS) + "\n[truncated]";
    }
  }

  const systemPrompt = `You are a sales manager assistant. Explain why this lead is stuck or failed and what the sales rep should do next. Be concise (2-4 sentences). Focus on actionable insights.`;

  const userPrompt = `Lead: ${lead.name}
Stage: ${lead.stage}
SLA status: ${lead.slaStatus}
First response: ${lead.firstResponseAt ?? "none"}
SLA breached: ${lead.slaBreachedAt ? "yes" : "no"}

Follow-ups: ${followUpsList.length} total
- Pending: ${followUpsList.filter((f) => f.status === "pending").length}
- Completed: ${followUpsList.filter((f) => f.status === "completed").length}
- Missed: ${followUpsList.filter((f) => f.status === "missed").length}

SLA breaches logged: ${slaLogsList.length}

Conversation:
${conversationText || "(No messages)"}

Explain why this lead is stuck or failed and what should be done next:`;

  try {
    const { text } = await generateText({
      model: getModel(),
      system: systemPrompt,
      prompt: userPrompt,
    });

    return NextResponse.json({ insight: text.trim() });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "AI request failed. Check your API key.";
    return NextResponse.json({ insight: "", error: message });
  }
}
