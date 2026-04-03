import { db } from "@/db";
import { APP_SETTINGS } from "@/db/collections";
import type { SlaSettingsDoc } from "@/db/collections";

const SLA_DOC_ID = "sla";
const DEFAULT_FIRST_RESPONSE_SLA_MINUTES = 10;
const MIN_MINUTES = 1;
const MAX_MINUTES = 1440; // 24 hours

export function clampSlaMinutes(value: number): number {
  return Math.max(MIN_MINUTES, Math.min(MAX_MINUTES, Math.round(value)));
}

export async function getFirstResponseSlaMinutes(): Promise<number> {
  const doc = await db
    .collection<SlaSettingsDoc>(APP_SETTINGS)
    .findOne({ id: SLA_DOC_ID });
  const minutes = doc?.firstResponseSlaMinutes;
  if (typeof minutes === "number" && minutes >= MIN_MINUTES && minutes <= MAX_MINUTES) {
    return Math.round(minutes);
  }
  return DEFAULT_FIRST_RESPONSE_SLA_MINUTES;
}

export async function setFirstResponseSlaMinutes(minutes: number): Promise<void> {
  const clamped = clampSlaMinutes(minutes);
  const now = new Date();
  await db.collection<SlaSettingsDoc>(APP_SETTINGS).updateOne(
    { id: SLA_DOC_ID },
    {
      $set: {
        firstResponseSlaMinutes: clamped,
        updatedAt: now,
      },
    },
    { upsert: true }
  );
}
