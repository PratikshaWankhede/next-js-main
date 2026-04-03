/**
 * Instagram outbound adapter — sends DMs via Meta Graph API.
 *
 * Meta docs require sending through the **Facebook Page** that owns the Instagram inbox:
 * `POST https://graph.facebook.com/{PAGE_ID}/messages` with a **Page access token**.
 * Using `graph.instagram.com/.../me/messages` + `payload.url` often yields blank media because Meta’s
 * fetcher hits strict timeouts (~10s for non-video), SSL rules, or fails to follow app URLs reliably.
 *
 * Prefer uploading bytes with `/{PAGE_ID}/message_attachments` (`platform: instagram`) then sending
 * `attachment_id` — same pattern as WhatsApp media upload + send.
 *
 * @see https://developers.facebook.com/docs/messenger-platform/instagram/features/attachment-upload
 * @see https://developers.facebook.com/docs/messenger-platform/reference/attachment-upload-api
 */

import { collectInstagramGraphTokenCandidates } from "@/lib/instagram-env-tokens";

export type InstagramAttachmentType = "image" | "video" | "file";

const GRAPH_HOST = "https://graph.facebook.com";

function metaGraphVersion(): string {
  return process.env.META_GRAPH_API_VERSION?.trim() || "v21.0";
}

function firstPageAccessToken(): string | null {
  const candidates = collectInstagramGraphTokenCandidates();
  return (
    candidates[0]?.token ?? process.env.INSTAGRAM_ACCESS_TOKEN?.trim() ?? null
  );
}

let cachedFacebookPageId: string | null | undefined;

/**
 * Attachment Upload API and Page Send API require the **Facebook Page id** (not the Instagram
 * business / 178414… id). Resolve from env or Graph (`connected_facebook_page`).
 *
 * Tries every distinct env token (Page token first). A bad `INSTAGRAM_PAGE_ACCESS_TOKEN` must not
 * block a valid `INSTAGRAM_ACCESS_TOKEN` — Meta error 190 "Cannot parse access token" is common when
 * one value is corrupted in `.env`.
 */
export async function resolveFacebookPageIdForInstagram(): Promise<
  string | null
> {
  const explicit = process.env.FACEBOOK_PAGE_ID?.trim();
  if (explicit) return explicit;
  if (cachedFacebookPageId !== undefined) return cachedFacebookPageId;

  const candidates = collectInstagramGraphTokenCandidates();
  if (candidates.length === 0) {
    cachedFacebookPageId = null;
    return null;
  }

  const igBiz = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID?.trim();

  const v = metaGraphVersion();
  let lastMessage: string | undefined;

  if (igBiz) {
    for (const { token, source } of candidates) {
      if (/\s/.test(token) || token.length < 30) {
        console.warn(
          `[Instagram] resolveFacebookPageId: skipping ${source} (token looks truncated or has spaces)`,
        );
        continue;
      }
      try {
        const buildUrl = (withQueryToken: boolean) => {
          const u = new URL(`${GRAPH_HOST}/${v}/${igBiz}`);
          u.searchParams.set("fields", "connected_facebook_page{id}");
          if (withQueryToken) u.searchParams.set("access_token", token);
          return u;
        };
        let res = await fetch(buildUrl(true).href);
        let json = (await res.json()) as {
          connected_facebook_page?: { id?: string };
          error?: { message?: string; code?: number };
        };
        const parse190 =
          json.error?.code === 190 &&
          (json.error.message?.toLowerCase().includes("parse") ?? false);
        if ((!res.ok || json.error) && parse190) {
          res = await fetch(buildUrl(false).href, {
            headers: { Authorization: `Bearer ${token}` },
          });
          json = (await res.json()) as typeof json;
        }
        if (!res.ok || json.error) {
          const msg = json.error?.message ?? res.statusText;
          const code = json.error?.code;
          lastMessage = `${source}: ${msg}`;
          const parseOrAuth =
            code === 190 || /parse access token|invalid.*token/i.test(msg);
          if (parseOrAuth) {
            console.warn(
              `[Instagram] resolveFacebookPageId: ${source} rejected (${msg}); trying next token`,
            );
            continue;
          }
          console.warn(
            `[Instagram] resolveFacebookPageId: ${source} — ${lastMessage}; trying next token`,
          );
          continue;
        }
        const id = json.connected_facebook_page?.id;
        if (typeof id === "string") {
          cachedFacebookPageId = id;
          return cachedFacebookPageId;
        }
      } catch (e) {
        lastMessage = String(e);
        console.warn(
          `[Instagram] resolveFacebookPageId: ${source} request failed; trying next token`,
          e,
        );
      }
    }

    if (lastMessage) {
      console.warn(
        "[Instagram] connected_facebook_page lookup did not return an id;",
        lastMessage,
      );
    }
  }

  /** When IG user lookup fails, GET /me/accounts still returns the Page id (same id as in Send API). Enables reply_to + attachments on graph.facebook.com/{PAGE_ID}/messages. */
  for (const { token, source } of candidates) {
    if (/\s/.test(token) || token.length < 30) continue;
    const fromAccounts = await tryPageIdFromMeAccounts(token);
    if (fromAccounts) {
      console.log(
        `[Instagram] Resolved Facebook Page id from /me/accounts (token=${source})`,
      );
      cachedFacebookPageId = fromAccounts;
      return cachedFacebookPageId;
    }
  }

  cachedFacebookPageId = null;
  return null;
}

async function tryPageIdFromMeAccounts(token: string): Promise<string | null> {
  const v = metaGraphVersion();
  try {
    const u = new URL(`${GRAPH_HOST}/${v}/me/accounts`);
    u.searchParams.set("fields", "id,name");
    u.searchParams.set("access_token", token);
    const res = await fetch(u.href);
    const json = (await res.json()) as {
      data?: { id?: string }[];
      error?: { message?: string };
    };
    if (
      !res.ok ||
      json.error ||
      !Array.isArray(json.data) ||
      json.data.length === 0
    ) {
      return null;
    }
    const preferred = process.env.FACEBOOK_PAGE_ID?.trim();
    if (preferred) {
      const match = json.data.find((p) => p.id === preferred);
      if (match?.id) return match.id;
    }
    const id = json.data[0]?.id;
    return typeof id === "string" ? id : null;
  } catch {
    return null;
  }
}

function asciiFilename(
  name: string | null | undefined,
  fallback: string,
): string {
  const raw = (name ?? "").trim() || fallback;
  const safe = raw.replace(/[^\w.\-]/g, "_");
  return safe.length > 0 ? safe : fallback;
}

function metaAttachmentType(
  logical: InstagramAttachmentType,
  mime: string,
): "image" | "video" | "file" {
  if (logical === "video") return "video";
  if (logical === "file") return "file";
  // Instagram messaging images: png, jpeg, gif per Meta — webp/heic often fail as “image”.
  const m = mime.toLowerCase();
  if (
    m === "image/jpeg" ||
    m === "image/png" ||
    m === "image/gif" ||
    m === "image/jpg"
  ) {
    return "image";
  }
  return "file";
}

async function uploadPageMessageAttachment(params: {
  pageId: string;
  accessToken: string;
  apiType: "image" | "video" | "file";
  buffer: Buffer;
  mimeType: string;
  filename: string;
}): Promise<string | null> {
  const v = metaGraphVersion();
  const url = `${GRAPH_HOST}/${v}/${params.pageId}/message_attachments`;
  /** File upload: type only (see Graph API Page message_attachments “Upload a File”). */
  const message = {
    attachment: {
      type: params.apiType,
    },
  };
  const form = new FormData();
  form.append("message", JSON.stringify(message));
  form.append("platform", "instagram");
  const blob = new Blob([new Uint8Array(params.buffer)], {
    type: params.mimeType || "application/octet-stream",
  });
  form.append("filedata", blob, params.filename);

  try {
    const res = await fetch(
      `${url}?access_token=${encodeURIComponent(params.accessToken)}`,
      { method: "POST", body: form },
    );
    const json = (await res.json()) as {
      attachment_id?: string;
      error?: { message?: string };
    };
    if (!res.ok || json.error) {
      console.error(
        "[Instagram] message_attachments error:",
        json.error?.message ?? res.statusText,
      );
      return null;
    }
    if (!json.attachment_id) {
      console.error("[Instagram] message_attachments: missing attachment_id");
      return null;
    }
    return json.attachment_id;
  } catch (e) {
    console.error("[Instagram] message_attachments failed:", e);
    return null;
  }
}

async function sendPageMessageJson(params: {
  pageId: string;
  accessToken: string;
  body: Record<string, unknown>;
}): Promise<{ externalMessageId: string } | null> {
  const v = metaGraphVersion();
  const url = `${GRAPH_HOST}/${v}/${params.pageId}/messages`;
  /** Meta Send API expects `messaging_type` (see Send API ref). Omitting it can deliver text without threading reply_to in Instagram UI. */
  const payload = {
    ...params.body,
    messaging_type:
      (params.body as { messaging_type?: string }).messaging_type ?? "RESPONSE",
  };
  try {
    const res = await fetch(
      `${url}?access_token=${encodeURIComponent(params.accessToken)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const json = (await res.json()) as {
      message_id?: string;
      recipient_id?: string;
      error?: { message?: string };
    };
    if (!res.ok || json.error) {
      console.error(
        "[Instagram] Page /messages error:",
        json.error?.message ?? res.statusText,
      );
      return null;
    }
    const mid = json.message_id;
    if (mid) return { externalMessageId: mid };
    console.error("[Instagram] Page /messages: no message_id in response");
    return null;
  } catch (e) {
    console.error("[Instagram] Page /messages failed:", e);
    return null;
  }
}

/** Legacy host — only used when Facebook Page id or Page token path is unavailable. */
async function sendInstagramHostMessageJson(params: {
  body: Record<string, unknown>;
  token: string;
}): Promise<{ externalMessageId: string } | null> {
  const v = metaGraphVersion();
  const url = `https://graph.instagram.com/${v}/me/messages`;
  /** Thread replies use `reply_to` on graph.facebook.com/{PAGE_ID}/messages only — Instagram host returns "Invalid parameter". */
  const body = { ...params.body };
  if ("reply_to" in body && body.reply_to != null) {
    console.warn(
      "[Instagram] Omitting reply_to on graph.instagram.com (unsupported). Set FACEBOOK_PAGE_ID or ensure /me/accounts Page resolution for threaded replies.",
    );
    delete body.reply_to;
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.token}`,
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as {
      message_id?: string;
      error?: { message?: string };
    };
    if (!res.ok || json.error) {
      console.error(
        "[Instagram] graph.instagram.com /messages error:",
        json.error?.message ?? res.statusText,
      );
      return null;
    }
    if (json.message_id) return { externalMessageId: json.message_id };
    console.error("[Instagram] graph.instagram.com: no message_id in response");
    return null;
  } catch (e) {
    console.error("[Instagram] graph.instagram.com send failed:", e);
    return null;
  }
}

export type InstagramOutboundAttachment =
  | { type: InstagramAttachmentType; url: string }
  | {
      type: InstagramAttachmentType;
      file: {
        buffer: Buffer;
        mimeType: string;
        filename: string | null;
      };
      /** If upload/send via attachment_id fails, Meta can retry fetching this public HTTPS URL. */
      fallbackUrl?: string;
    };

export async function sendInstagramMessage({
  instagramUserId,
  content,
  attachment,
  replyToMid,
}: {
  instagramUserId: string;
  content: string;
  attachment?: InstagramOutboundAttachment;
  replyToMid?: string | null;
}): Promise<{ externalMessageId: string } | null> {
  const token = firstPageAccessToken();

  if (!token) {
    console.warn(
      "[Instagram] Missing access token (INSTAGRAM_* / FACEBOOK_PAGE_ACCESS_TOKEN)",
    );
    return { externalMessageId: `stub-ig-${Date.now()}` };
  }

  const trimmedMid = replyToMid?.trim() ?? "";
  const replyTo =
    trimmedMid && !/^stub-/i.test(trimmedMid) ? { mid: trimmedMid } : undefined;
  if (trimmedMid && /^stub-/i.test(trimmedMid)) {
    console.warn(
      "[Instagram] reply_to skipped — referenced CRM message has no Meta id (stub).",
    );
  }
  const recipient = { id: String(instagramUserId) };

  const pageId = await resolveFacebookPageIdForInstagram();
  const requiresThreadedReply = Boolean(replyTo);

  if (requiresThreadedReply && !pageId) {
    console.error(
      "[Instagram] Cannot send threaded reply without Facebook Page /messages access. Configure FACEBOOK_PAGE_ID or working Page resolution.",
    );
    return null;
  }

  if (pageId && attachment && "file" in attachment) {
    const apiType = metaAttachmentType(
      attachment.type,
      attachment.file.mimeType,
    );
    const attachmentId = await uploadPageMessageAttachment({
      pageId,
      accessToken: token,
      apiType,
      buffer: attachment.file.buffer,
      mimeType: attachment.file.mimeType,
      filename: asciiFilename(
        attachment.file.filename,
        apiType === "image"
          ? "image.jpg"
          : apiType === "video"
            ? "video.mp4"
            : "file.bin",
      ),
    });
    if (!attachmentId) {
      if (attachment.fallbackUrl) {
        console.warn(
          "[Instagram] message_attachments upload failed; falling back to public URL",
        );
        const urlSent = await sendPageMessageJson({
          pageId,
          accessToken: token,
          body: {
            recipient,
            message: {
              attachment: {
                type: apiType,
                payload: { url: attachment.fallbackUrl },
              },
            },
            ...(replyTo && { reply_to: replyTo }),
          },
        });
        if (urlSent) return urlSent;
        if (requiresThreadedReply) {
          console.error(
            "[Instagram] Threaded reply failed because Page /messages URL send failed and graph.instagram.com cannot preserve reply_to.",
          );
          return null;
        }
        return sendInstagramHostMessageJson({
          token,
          body: {
            recipient,
            message: {
              attachment: {
                type: apiType,
                payload: { url: attachment.fallbackUrl },
              },
            },
            ...(replyTo && { reply_to: replyTo }),
          },
        });
      }
      console.error(
        "[Instagram] Upload to message_attachments failed; not sending partial message",
      );
      return null;
    }
    const sent = await sendPageMessageJson({
      pageId,
      accessToken: token,
      body: {
        recipient,
        message: {
          attachment: {
            type: apiType,
            payload: { attachment_id: attachmentId },
          },
        },
        ...(replyTo && { reply_to: replyTo }),
      },
    });
    if (sent) return sent;
    if (attachment.fallbackUrl) {
      console.warn(
        "[Instagram] Page /messages with attachment_id failed; falling back to URL",
      );
      const urlSent = await sendPageMessageJson({
        pageId,
        accessToken: token,
        body: {
          recipient,
          message: {
            attachment: {
              type: apiType,
              payload: { url: attachment.fallbackUrl },
            },
          },
          ...(replyTo && { reply_to: replyTo }),
        },
      });
      if (urlSent) return urlSent;
      if (requiresThreadedReply) {
        console.error(
          "[Instagram] Threaded reply failed because Page /messages fallback URL send failed and graph.instagram.com cannot preserve reply_to.",
        );
        return null;
      }
      return sendInstagramHostMessageJson({
        token,
        body: {
          recipient,
          message: {
            attachment: {
              type: apiType,
              payload: { url: attachment.fallbackUrl },
            },
          },
          ...(replyTo && { reply_to: replyTo }),
        },
      });
    }
    return null;
  }

  if (attachment && "file" in attachment && !pageId) {
    if (attachment.fallbackUrl) {
      console.warn(
        "[Instagram] No Facebook Page id (set FACEBOOK_PAGE_ID or INSTAGRAM_BUSINESS_ACCOUNT_ID) — sending attachment via public URL only.",
      );
      const apiType = metaAttachmentType(
        attachment.type,
        attachment.file.mimeType,
      );
      if (requiresThreadedReply) {
        console.error(
          "[Instagram] Cannot send threaded reply attachment without Facebook Page /messages access.",
        );
        return null;
      }
      return sendInstagramHostMessageJson({
        token,
        body: {
          recipient,
          message: {
            attachment: {
              type: apiType,
              payload: { url: attachment.fallbackUrl },
            },
          },
          ...(replyTo && { reply_to: replyTo }),
        },
      });
    }
    console.error(
      "[Instagram] File send needs FACEBOOK_PAGE_ID or INSTAGRAM_BUSINESS_ACCOUNT_ID (for connected_facebook_page), or a public fallback URL.",
    );
    return null;
  }

  if (pageId && attachment && "url" in attachment) {
    const sent = await sendPageMessageJson({
      pageId,
      accessToken: token,
      body: {
        recipient,
        message: {
          attachment: {
            type: attachment.type,
            payload: { url: attachment.url },
          },
        },
        ...(replyTo && { reply_to: replyTo }),
      },
    });
    if (sent) return sent;
    if (requiresThreadedReply) {
      console.error(
        "[Instagram] Threaded reply failed because Page /messages URL send failed.",
      );
      return null;
    }
    console.warn(
      "[Instagram] Page /messages with URL failed; trying graph.instagram.com",
    );
  }

  if (pageId && !attachment && content.trim()) {
    const sent = await sendPageMessageJson({
      pageId,
      accessToken: token,
      body: {
        recipient,
        message: { text: content },
        ...(replyTo && { reply_to: replyTo }),
      },
    });
    if (sent) return sent;
    if (requiresThreadedReply) {
      console.error(
        "[Instagram] Threaded reply failed because Page /messages text send failed.",
      );
      return null;
    }
  }

  if (attachment && "url" in attachment && attachment.url) {
    return sendInstagramHostMessageJson({
      token,
      body: {
        recipient,
        message: {
          attachment: {
            type: attachment.type,
            payload: { url: attachment.url },
          },
        },
        ...(replyTo && { reply_to: replyTo }),
      },
    });
  }

  return sendInstagramHostMessageJson({
    token,
    body: {
      recipient,
      message: { text: content },
      ...(replyTo && { reply_to: replyTo }),
    },
  });
}

/**
 * Send or remove an emoji reaction on an Instagram DM via the Send API.
 * Uses `sender_action` react/unreact; falls back to attachment-style payload if needed.
 * See https://developers.facebook.com/docs/messenger-platform/send-messages/sender-actions
 */
export async function sendInstagramReaction({
  instagramUserId,
  messageId,
  emoji,
}: {
  instagramUserId: string;
  messageId: string;
  emoji: string;
}): Promise<boolean> {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!token) {
    console.warn("[Instagram] Missing INSTAGRAM_ACCESS_TOKEN");
    return false;
  }

  const url = "https://graph.instagram.com/v21.0/me/messages";
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
  const recipient = { id: String(instagramUserId) };

  try {
    if (!emoji) {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          recipient,
          sender_action: "unreact",
          payload: { message_id: messageId },
        }),
      });
      const json = (await res.json()) as { error?: { message: string } };
      if (!res.ok) {
        console.error(
          "[Instagram] Unreact API error:",
          json.error?.message ?? res.statusText,
        );
        return false;
      }
      return true;
    }

    let res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        recipient,
        sender_action: "react",
        payload: {
          message_id: messageId,
          reaction: emoji,
        },
      }),
    });
    let json = (await res.json()) as { error?: { message: string } };

    if (!res.ok) {
      res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          recipient,
          message: {
            attachment: {
              type: "reaction",
              payload: {
                message_id: messageId,
                emoji,
              },
            },
          },
        }),
      });
      json = (await res.json()) as { error?: { message: string } };
      if (!res.ok) {
        console.error(
          "[Instagram] Reaction API error:",
          json.error?.message ?? res.statusText,
        );
        return false;
      }
    }
    return true;
  } catch (err) {
    console.error("[Instagram] Reaction failed:", err);
    return false;
  }
}
