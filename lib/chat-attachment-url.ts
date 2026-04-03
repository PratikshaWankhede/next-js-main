/**
 * Chat messages store upload URLs. Prefer same-origin paths so images work in any
 * deployment; older rows may have absolute http://localhost URLs from webhooks.
 */
export function normalizeChatAttachmentUrl(
  url: string | null | undefined,
): string | null {
  if (url == null || String(url).trim() === "") return null;
  const trimmed = String(url).trim();
  if (trimmed.startsWith("/")) return trimmed;
  try {
    const u = new URL(trimmed);
    if (u.pathname.startsWith("/api/uploads/")) {
      return `${u.pathname}${u.search}`;
    }
  } catch {
    return trimmed;
  }
  return trimmed;
}

export type PublicUploadUrlForMetaOptions = {
  /**
   * When true, append `?proxy=1` so `/api/uploads/...` returns **200 + body** from your app
   * instead of **302 → signed S3**. Meta’s Instagram (and some WhatsApp) fetchers do not always
   * follow redirects; without this, recipients can see a blank image/file even when send API succeeds.
   */
  forceProxy?: boolean;
};

/** Meta APIs require a publicly reachable HTTPS URL to fetch media from. */
export function publicUploadUrlForMeta(
  storedPath: string,
  req: { headers: Headers },
  options?: PublicUploadUrlForMetaOptions,
): string {
  if (/^https?:\/\//i.test(storedPath)) return storedPath;
  const path = storedPath.startsWith("/") ? storedPath : `/${storedPath}`;
  const proto = req.headers.get("x-forwarded-proto");
  const host =
    req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? null;
  let absolute: string;
  if (proto && host) {
    absolute = `${proto}://${host}${path}`;
  } else {
    const base = (process.env.NEXTAUTH_URL || "http://localhost:3000").replace(
      /\/$/,
      "",
    );
    absolute = `${base}${path}`;
  }
  if (options?.forceProxy) {
    const sep = absolute.includes("?") ? "&" : "?";
    return `${absolute}${sep}proxy=1`;
  }
  return absolute;
}
