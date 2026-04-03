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
import type { LeadDoc } from "@/db/collections";
import { checkRateLimit } from "@/lib/ai/rate-limit";
import { canAccessLead, getSessionWithRole, requireAuth } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";

const MAX_CONTENT_CHARS = 4000;

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const session = await getSessionWithRole();
  requireAuth(session);

  if (!checkRateLimit(session.user.id)) {
    return NextResponse.json({ score: null, reason: "" });
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

  if (!canAccessLead(session, lead)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const followUpCount = await db
    .collection(FOLLOW_UPS)
    .countDocuments({ leadId });

  const slaLogCount = await db.collection(SLA_LOGS).countDocuments({ leadId });

  const conversation = await db
    .collection(CHAT_CONVERSATIONS)
    .findOne({ leadId });

  let messageCount = 0;
  let conversationText = "";
  if (conversation) {
    const msgs = await db
      .collection(CHAT_MESSAGES)
      .find({ conversationId: conversation.id })
      .project({ content: 1 })
      .toArray();
    messageCount = msgs.length;
    conversationText = msgs.map((m) => m.content).join("\n");
    if (conversationText.length > MAX_CONTENT_CHARS) {
      conversationText =
        conversationText.slice(-MAX_CONTENT_CHARS) + "\n[truncated]";
    }
  }

  const systemPrompt = `You are a sales CRM assistant. Score the lead as hot, warm, or cold based on:
- Response speed (firstResponseAt, slaStatus)
- Message frequency and engagement
- Keywords: price, booking, date, confirm
- Follow-up count and status (missed vs completed)
- SLA breaches
- Current stage (new, contacted, interested, done, lost)

Output exactly: SCORE: hot|warm|cold
REASON: one sentence explanation`;

  const userPrompt = `Lead: ${lead.name}
Stage: ${lead.stage}
First response: ${lead.firstResponseAt ?? "none"}
SLA status: ${lead.slaStatus}
SLA breached: ${lead.slaBreachedAt ? "yes" : "no"}
Follow-up count: ${followUpCount}
SLA log count: ${slaLogCount}
Message count: ${messageCount}

Recent conversation:
${conversationText || "(none)"}

Score this lead (hot/warm/cold) and give a one-sentence reason:`;

  try {
    const { text } = await generateText({
      model: getModel(),
      system: systemPrompt,
      prompt: userPrompt,
    });

    let score: "hot" | "warm" | "cold" = "warm";
    let reason = text.trim();

    const scoreMatch = text.match(/SCORE:\s*(hot|warm|cold)/i);
    if (scoreMatch) {
      score = scoreMatch[1].toLowerCase() as "hot" | "warm" | "cold";
    }

    const reasonMatch = text.match(/REASON:\s*([\s\S]+?)(?:\n|$)/i);
    if (reasonMatch) {
      reason = reasonMatch[1].trim();
    }

    const now = new Date();
    await db.collection(LEADS).updateOne(
      { id: leadId },
      {
        $set: {
          aiScore: score,
          aiScoreReason: reason,
          aiScoreUpdatedAt: now,
          updatedAt: now,
        },
      },
    );

    return NextResponse.json({ score, reason });
  } catch {
    return NextResponse.json({ score: null, reason: "" });
  }
}
