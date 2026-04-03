import { db } from "@/db";
import { LEAD_TIMELINE } from "@/db/collections";
import type {
  LeadTimelineDoc,
  LeadTimelineEventType,
} from "@/db/collections";
import { generateRandomUUID } from "@/helpers/generate-random-uuid";

export async function appendLeadTimelineEvent(
  leadId: string,
  type: LeadTimelineEventType,
  payload: Record<string, unknown>,
  userId?: string | null,
): Promise<void> {
  const now = new Date();
  const doc: LeadTimelineDoc = {
    id: generateRandomUUID(),
    leadId,
    type,
    payload,
    createdAt: now,
    userId: userId ?? null,
  };
  await db.collection<LeadTimelineDoc>(LEAD_TIMELINE).insertOne(doc);
}
