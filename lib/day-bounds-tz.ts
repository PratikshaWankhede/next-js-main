/**
 * Calendar day boundaries in an IANA timezone as UTC instants (no extra deps).
 * Used for Today Focus follow-ups and new leads.
 */

function findUtcForLocalWallTime(
  timeZone: string,
  isoDay: string,
  hour: number,
  minute: number,
  second: number,
): Date {
  const [y, mo, d] = isoDay.split("-").map(Number);
  const approx = Date.UTC(y, mo - 1, d, 12, 0, 0, 0);
  for (
    let offset = -48 * 60 * 60 * 1000;
    offset <= 48 * 60 * 60 * 1000;
    offset += 60 * 1000
  ) {
    const candidate = new Date(approx + offset);
    const day = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(candidate);
    if (day !== isoDay) continue;
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(candidate);
    const hh = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
    const mm = parseInt(
      parts.find((p) => p.type === "minute")?.value ?? "0",
      10,
    );
    const ss = parseInt(
      parts.find((p) => p.type === "second")?.value ?? "0",
      10,
    );
    if (hh === hour && mm === minute && ss === second) return candidate;
  }
  return new Date(Date.UTC(y, mo - 1, d, 0, 0, 0, 0));
}

export function getDayBoundsUtc(
  timeZone: string,
  referenceUtc: Date,
): { startUtc: Date; endUtc: Date } {
  const isoDay = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(referenceUtc);

  const startUtc = findUtcForLocalWallTime(timeZone, isoDay, 0, 0, 0);
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { startUtc, endUtc };
}

export function isValidIanaTimeZone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
