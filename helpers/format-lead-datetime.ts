import { format } from "date-fns";

/** Consistent long stamp for CRM lists and lead overview (local timezone, 12-hour). */
const LEAD_DATETIME_PATTERN = "MMM d, yyyy h:mm a";

export function formatLeadDateTime(
  isoOrDate: string | Date | null | undefined,
): string {
  if (isoOrDate == null) return "";
  const d = new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return "";
  return format(d, LEAD_DATETIME_PATTERN);
}
