/**
 * Booking times are stored as UTC (ISO). All user-facing booking strings use one
 * IANA timezone so the lead UI, WhatsApp/Instagram templates, and cron match.
 *
 * Set NEXT_PUBLIC_BOOKING_DISPLAY_TIMEZONE (browser + server) or
 * BOOKING_DISPLAY_TIMEZONE (server-only) — default Asia/Kolkata.
 */

const DEFAULT_BOOKING_TZ = "Asia/Kolkata";

export function getBookingDisplayTimeZone(): string {
  if (typeof process === "undefined") return DEFAULT_BOOKING_TZ;
  return (
    process.env.NEXT_PUBLIC_BOOKING_DISPLAY_TIMEZONE?.trim() ||
    process.env.BOOKING_DISPLAY_TIMEZONE?.trim() ||
    DEFAULT_BOOKING_TZ
  );
}

/** Lead card / UI: "31 Mar 2026, 11:44 am" */
export function formatBookingAppointmentDisplay(
  isoOrDate: string | Date | null | undefined,
): string {
  if (isoOrDate == null) return "";
  const d = new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: getBookingDisplayTimeZone(),
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

/** Template variables for confirmation / reminder / review messages. */
export function getBookingTemplateParts(date: Date): {
  dateStr: string;
  timeStr: string;
  dayStr: string;
} {
  const tz = getBookingDisplayTimeZone();
  const dateStr = new Intl.DateTimeFormat("en-IN", {
    timeZone: tz,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
  const timeStr = new Intl.DateTimeFormat("en-IN", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
  const dayStr = new Intl.DateTimeFormat("en-IN", {
    timeZone: tz,
    weekday: "long",
  }).format(date);
  return { dateStr, timeStr, dayStr };
}
