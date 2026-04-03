import { generateText } from "ai";
import { getModel } from "@/lib/ai/model";
import { db } from "@/db";
import { CHAT_CONVERSATIONS, CHAT_MESSAGES, LEADS } from "@/db/collections";
import type {
  ChatConversationDoc,
  ChatMessageDoc,
  LeadDoc,
} from "@/db/collections";

const MAX_CONTENT_CHARS = 4000;

export async function regenerateLeadSummary(leadId: string): Promise<string> {
  const leadsCol = db.collection<LeadDoc>(LEADS);
  const lead = await leadsCol.findOne({ id: leadId });
  if (!lead) throw new Error("Lead not found");

  const convCol = db.collection<ChatConversationDoc>(CHAT_CONVERSATIONS);
  const msgCol = db.collection<ChatMessageDoc>(CHAT_MESSAGES);
  const conversation = await convCol.findOne({ leadId });

  let conversationText = "";
  if (conversation) {
    const msgs = await msgCol
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

  const systemPrompt = `You are a sales CRM assistant. Summarize the lead conversation in 1 concise paragraph (2-4 sentences). Include:
- Client intent and what they want
- Current stage of discussion
- Pending actions or next steps
- Whether they have confirmed booking or not`;

  const userPrompt = `Lead: ${lead.name}
Stage: ${lead.stage}
Source: ${lead.source}

Conversation:
${conversationText || "(No messages yet)"}

Provide a 1-paragraph summary:`;

  const { text } = await generateText({
    model: getModel(),
    system: systemPrompt,
    prompt: userPrompt,
  });

  const summary = text.trim();
  const now = new Date();
  await leadsCol.updateOne(
    { id: leadId },
    {
      $set: {
        aiSummary: summary,
        aiSummaryUpdatedAt: now,
        updatedAt: now,
      },
    },
  );
  return summary;
}
