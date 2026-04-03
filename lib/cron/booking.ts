import "dotenv/config";
import { db } from "@/db";
import { LEADS } from "@/db/collections";
import type { LeadDoc } from "@/db/collections";
import { sendBookingMessageForLead } from "@/lib/booking-messages";
import { addDays, addHours, endOfDay, startOfDay } from "date-fns";

export async function runBookingCron() {
  const now = new Date();
  const leadsCol = db.collection<LeadDoc>(LEADS);

  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const tomorrowStart = startOfDay(addDays(now, 1));
  const tomorrowEnd = endOfDay(addDays(now, 1));

  // 1) Day-before reminders
  const dayBeforeLeads = await leadsCol
    .find({
      appointmentDate: { $gte: tomorrowStart, $lte: tomorrowEnd },
      $or: [
        { bookingReminderDayBeforeSentAt: null },
        { bookingReminderDayBeforeSentAt: { $exists: false } },
      ],
    } as Record<string, unknown>)
    .toArray();

  for (const lead of dayBeforeLeads) {
    try {
      const sent = await sendBookingMessageForLead(lead, "reminder");
      if (sent) {
        await leadsCol.updateOne(
          { id: lead.id },
          { $set: { bookingReminderDayBeforeSentAt: now, updatedAt: now } },
        );
      }
    } catch {
      // ignore individual send failures
    }
  }

  // 2) Same-day morning reminders (before 10am)
  const sameDayCutoff = addHours(todayStart, 10);
  if (now <= sameDayCutoff) {
    const sameDayLeads = await leadsCol
      .find({
        appointmentDate: { $gte: todayStart, $lte: todayEnd },
        $or: [
          { bookingReminderSameDaySentAt: null },
          { bookingReminderSameDaySentAt: { $exists: false } },
        ],
      } as Record<string, unknown>)
      .toArray();

    for (const lead of sameDayLeads) {
      try {
        const sent = await sendBookingMessageForLead(lead, "reminder");
        if (sent) {
          await leadsCol.updateOne(
            { id: lead.id },
            { $set: { bookingReminderSameDaySentAt: now, updatedAt: now } },
          );
        }
      } catch {
        // ignore individual send failures
      }
    }
  }

  // Review request is sent immediately when lead is marked Done (see stage API), not by cron.

  console.log(
    `[cron] Booking cron completed. Day-before: ${dayBeforeLeads.length}, same-day: ${
      now <= sameDayCutoff ? "sent" : "skipped"
    }`,
  );
}

runBookingCron()
  .then(() => {
    console.log("[cron] Booking cron finished");
    process.exit(0);
  })
  .catch((err) => {
    console.error("[cron] Booking cron failed:", err);
    process.exit(1);
  });

