/** Fields needed to show a friendly label when `name` is missing or generic. */
export type LeadDisplayFields = {
  name: string;
  customName?: string | null;
  phone: string;
  source: string;
  whatsappPhone?: string | null;
  instagramUserId?: string | null;
  instagramUsername?: string | null;
};

/** Synthetic names from resolver before Meta profile enrichment. */
export function isInstagramPlaceholderLeadName(name: string): boolean {
  const n = name.trim();
  return n === "Unknown" || /^Instagram \d{6}$/.test(n);
}

/** True when we should call Meta User Profile API to resolve username / name. */
export function needsInstagramProfileEnrichment(
  lead: LeadDisplayFields,
): boolean {
  if (lead.source !== "instagram" || !lead.instagramUserId?.trim()) {
    return false;
  }
  const name = lead.name?.trim() ?? "";
  const placeholder = isInstagramPlaceholderLeadName(name);
  if (lead.instagramUsername?.trim() && !placeholder && name) {
    return false;
  }
  return !lead.instagramUsername?.trim() || placeholder || !name;
}

/**
 * Resolves the label shown for a lead when stored `name` is "Unknown" or empty:
 * Instagram @handle, last digits of IG id, or WhatsApp phone.
 */
export function getLeadDisplayName(lead: LeadDisplayFields): string {
  const custom = lead.customName?.trim();
  if (custom) return custom;

  const raw = lead.name?.trim() ?? "";
  if (raw && raw !== "Unknown" && !isInstagramPlaceholderLeadName(raw))
    return raw;

  const igUser = lead.instagramUsername?.trim();
  if (igUser) {
    const u = igUser.replace(/^@/, "");
    return `@${u}`;
  }
  if (lead.instagramUserId) {
    return `Instagram ${lead.instagramUserId.slice(-6)}`;
  }
  if (lead.source === "whatsapp") {
    const w = lead.whatsappPhone?.trim() || lead.phone?.trim();
    if (w && !w.startsWith("ig-")) return w;
  }
  return raw || "Unknown";
}
