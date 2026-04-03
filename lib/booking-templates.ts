import { db } from "@/db";
import { APP_SETTINGS } from "@/db/collections";
import type { BookingTemplatesDoc } from "@/db/collections";

const BOOKING_TEMPLATES_DOC_ID = "booking_templates";

function defaultTemplates(): BookingTemplatesDoc {
  const now = new Date();
  return {
    id: BOOKING_TEMPLATES_DOC_ID,
    bookingConfirmationBody:
      "Hi {{client_name}}, your tattoo booking is confirmed for {{appointment_date}} at {{appointment_time}}. Advance received: {{advance_amount}}. – RJ Tattoo Studio",
    bookingReminderBody:
      "Reminder: Hi {{client_name}}, you have a tattoo appointment on {{appointment_date}} at {{appointment_time}} with us. Reply if you need to reschedule. – RJ Tattoo Studio",
    bookingReviewBody:
      "Hi {{client_name}}, hope you loved your new tattoo! We'd really appreciate a quick review. Thank you for choosing us. – RJ Tattoo Studio",
    updatedAt: now,
    updatedByUserId: "system",
  };
}

export async function getBookingTemplates(): Promise<BookingTemplatesDoc> {
  const col = db.collection<BookingTemplatesDoc>(APP_SETTINGS);
  const existing = await col.findOne({ id: BOOKING_TEMPLATES_DOC_ID });
  if (existing) return existing;

  const defaults = defaultTemplates();
  await col.insertOne(defaults);
  return defaults;
}

export async function updateBookingTemplates(
  updates: Partial<Pick<
    BookingTemplatesDoc,
    "bookingConfirmationBody" | "bookingReminderBody" | "bookingReviewBody"
  >>,
  updatedByUserId: string,
): Promise<BookingTemplatesDoc> {
  const col = db.collection<BookingTemplatesDoc>(APP_SETTINGS);
  const current = await getBookingTemplates();

  const next: BookingTemplatesDoc = {
    ...current,
    ...updates,
    updatedAt: new Date(),
    updatedByUserId,
  };

  await col.updateOne(
    { id: BOOKING_TEMPLATES_DOC_ID },
    {
      $set: {
        bookingConfirmationBody: next.bookingConfirmationBody,
        bookingReminderBody: next.bookingReminderBody,
        bookingReviewBody: next.bookingReviewBody,
        updatedAt: next.updatedAt,
        updatedByUserId: next.updatedByUserId,
      },
    },
    { upsert: true },
  );

  return next;
}

