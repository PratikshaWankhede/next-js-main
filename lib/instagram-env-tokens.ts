/**
 * Shared Instagram / Meta token parsing and candidate ordering for Graph, webhooks, and CDN fetches.
 */

export type InstagramGraphTokenSource =
  | "INSTAGRAM_PAGE_ACCESS_TOKEN"
  | "FACEBOOK_PAGE_ACCESS_TOKEN"
  | "INSTAGRAM_ACCESS_TOKEN";

/** WhatsApp Cloud API token — optional last resort for CDN when same Page backs both channels. */
export type InstagramCdnTokenSource =
  | InstagramGraphTokenSource
  | "WHATSAPP_ACCESS_TOKEN";

/**
 * Fixes common .env mistakes: CRLF, spaces, accidental JSON quotes around the value.
 * Meta error 190 "Cannot parse access token" is often caused by a corrupted string here.
 */
export function sanitizeOAuthTokenFromEnv(
  raw: string | undefined,
): string | null {
  if (raw == null) return null;
  let t = raw.replace(/^\uFEFF/, "").replace(/\u200B/g, "");
  t = t.replace(/\r\n/g, "\n").replace(/\r/g, "").trim();
  if (!t) return null;
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    t = t.slice(1, -1).trim();
  }
  if (/^bearer\s+/i.test(t)) {
    t = t.replace(/^bearer\s+/i, "").trim();
  }
  return t || null;
}

/**
 * Page token first — Meta CDN (lookaside.fbsbx.com) and User Profile API often need it.
 * A bad Page token in INSTAGRAM_PAGE_ACCESS_TOKEN can block a good INSTAGRAM_ACCESS_TOKEN in profile code,
 * so callers that iterate should try each distinct token until one works.
 */
export function collectInstagramGraphTokenCandidates(): {
  token: string;
  source: InstagramGraphTokenSource;
}[] {
  const seen = new Set<string>();
  const out: { token: string; source: InstagramGraphTokenSource }[] = [];
  const add = (raw: string | undefined, source: InstagramGraphTokenSource) => {
    const t = sanitizeOAuthTokenFromEnv(raw);
    if (!t || seen.has(t)) return;
    seen.add(t);
    out.push({ token: t, source });
  };
  add(process.env.INSTAGRAM_PAGE_ACCESS_TOKEN, "INSTAGRAM_PAGE_ACCESS_TOKEN");
  add(process.env.FACEBOOK_PAGE_ACCESS_TOKEN, "FACEBOOK_PAGE_ACCESS_TOKEN");
  add(process.env.INSTAGRAM_ACCESS_TOKEN, "INSTAGRAM_ACCESS_TOKEN");
  return out;
}

/**
 * Tokens to try when downloading Instagram webhook attachment URLs from Meta CDN.
 * Extends {@link collectInstagramGraphTokenCandidates} with `WHATSAPP_ACCESS_TOKEN` when set and distinct —
 * many studios use one Facebook Page for both WhatsApp Cloud API and Instagram DMs; the Page token may work for lookaside URLs when `IGAA…` user tokens do not.
 */
export function collectInstagramCdnFetchTokenCandidates(): {
  token: string;
  source: InstagramCdnTokenSource;
}[] {
  const base: {
    token: string;
    source: InstagramCdnTokenSource;
  }[] = collectInstagramGraphTokenCandidates();
  const seen = new Set(base.map((b) => b.token));
  const wa = sanitizeOAuthTokenFromEnv(process.env.WHATSAPP_ACCESS_TOKEN);
  if (wa && !seen.has(wa)) {
    seen.add(wa);
    base.push({ token: wa, source: "WHATSAPP_ACCESS_TOKEN" });
  }
  return base;
}

/** Append access_token for Meta CDN URLs (lookaside.fbsbx.com). */
export function appendAccessTokenToMetaCdnUrl(
  url: string,
  token: string,
): string {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}access_token=${encodeURIComponent(token)}`;
}
