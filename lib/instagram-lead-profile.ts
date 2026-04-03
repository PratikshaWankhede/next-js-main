import { db } from "@/db";
import { LEADS } from "@/db/collections";
import type { LeadDoc } from "@/db/collections";
import {
  collectInstagramGraphTokenCandidates,
  type InstagramGraphTokenSource,
} from "@/lib/instagram-env-tokens";
import { needsInstagramProfileEnrichment } from "@/lib/lead-display-name";

const LOG_PREFIX = "[Instagram profile]";

function isInstagramProfileDebug(): boolean {
  const v = process.env.INSTAGRAM_PROFILE_DEBUG;
  return v === "1" || v === "true" || v === "yes";
}

function dbg(message: string, meta?: Record<string, unknown>): void {
  if (!isInstagramProfileDebug()) return;
  if (meta && Object.keys(meta).length > 0) {
    console.log(LOG_PREFIX, message, meta);
  } else {
    console.log(LOG_PREFIX, message);
  }
}

type GraphJson = {
  name?: string;
  username?: string;
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
};

function isParse190(j: GraphJson): boolean {
  return (
    j.error?.code === 190 &&
    (j.error.message?.toLowerCase().includes("parse") ?? false)
  );
}

/** Messenger User Profile API host — needs a Facebook Page access token. */
async function tryGraphFacebook(
  igsid: string,
  token: string,
  v: string,
): Promise<{ json: GraphJson; res: Response }> {
  const build = () => {
    const u = new URL(
      `https://graph.facebook.com/${v}/${encodeURIComponent(igsid)}`,
    );
    u.searchParams.set("fields", "name,username");
    return u;
  };

  const q = build();
  q.searchParams.set("access_token", token);
  let res = await fetch(q.href);
  let json = (await res.json()) as GraphJson;

  if ((!res.ok || json.error) && isParse190(json)) {
    dbg("graph.facebook.com: retry Bearer");
    const no = build();
    res = await fetch(no.href, {
      headers: { Authorization: `Bearer ${token}` },
    });
    json = (await res.json()) as GraphJson;
  }

  if (!res.ok || json.error) {
    return { json, res };
  }
  return { json, res };
}

/** Same token often works here when it powers graph.instagram.com/me/messages. */
async function tryGraphInstagram(
  igsid: string,
  token: string,
  v: string,
): Promise<{ json: GraphJson; res: Response }> {
  const build = () => {
    const u = new URL(
      `https://graph.instagram.com/${v}/${encodeURIComponent(igsid)}`,
    );
    u.searchParams.set("fields", "name,username");
    return u;
  };

  const q = build();
  q.searchParams.set("access_token", token);
  let res = await fetch(q.href);
  let json = (await res.json()) as GraphJson;

  if ((!res.ok || json.error) && isParse190(json)) {
    dbg("graph.instagram.com: retry Bearer");
    const no = build();
    res = await fetch(no.href, {
      headers: { Authorization: `Bearer ${token}` },
    });
    json = (await res.json()) as GraphJson;
  }

  if (!res.ok || json.error) {
    return { json, res };
  }
  return { json, res };
}

function profileFromJson(json: GraphJson): {
  name?: string;
  username?: string;
} | null {
  const username = json.username?.trim().replace(/^@/, "");
  const name = json.name?.trim();
  if (!username && !name) return null;
  return { username: username || undefined, name: name || undefined };
}

/**
 * Meta User Profile (IGSID) — try graph.facebook.com (Page token) then graph.instagram.com (same token as messaging).
 * @see https://developers.facebook.com/docs/messenger-platform/instagram/features/user-profile
 */
export async function fetchInstagramScopedUserProfile(
  instagramScopedUserId: string,
): Promise<{ name?: string; username?: string } | null> {
  const candidates = collectInstagramGraphTokenCandidates();
  if (candidates.length === 0) {
    console.warn(
      `${LOG_PREFIX} No access token. Set one of: INSTAGRAM_PAGE_ACCESS_TOKEN, FACEBOOK_PAGE_ACCESS_TOKEN, or INSTAGRAM_ACCESS_TOKEN.`,
    );
    dbg("fetch aborted — no token in env");
    return null;
  }

  const v = process.env.META_GRAPH_API_VERSION || "v21.0";

  let lastFailure: {
    httpStatus: number;
    message?: string;
    code?: number;
    fbtrace_id?: string;
    source: InstagramGraphTokenSource;
  } | null = null;

  for (const { token, source } of candidates) {
    dbg("trying token", {
      source,
      tokenLength: token.length,
      tokenPrefix: token.length >= 4 ? `${token.slice(0, 4)}…` : "(short)",
    });

    if (/\s/.test(token) || token.length < 50) {
      console.warn(
        `${LOG_PREFIX} Token looks invalid (spaces or too short). Skipping source ${source}.`,
        { length: token.length },
      );
      continue;
    }

    const fb = await tryGraphFacebook(instagramScopedUserId, token, v);
    if (fb && !fb.json.error && fb.res.ok) {
      const p = profileFromJson(fb.json);
      if (p) {
        console.log(`${LOG_PREFIX} Working API: graph.facebook.com`, {
          envSource: source,
          igsid: instagramScopedUserId,
          name: p.name ?? null,
          username: p.username ?? null,
        });
        dbg("success via graph.facebook.com", { source });
        return p;
      }
    } else if (fb?.json.error) {
      dbg("graph.facebook.com failed", {
        source,
        code: fb.json.error.code,
        message: fb.json.error.message,
      });
    }

    const ig = await tryGraphInstagram(instagramScopedUserId, token, v);
    if (ig && !ig.json.error && ig.res.ok) {
      const p = profileFromJson(ig.json);
      if (p) {
        console.log(`${LOG_PREFIX} Working API: graph.instagram.com`, {
          envSource: source,
          igsid: instagramScopedUserId,
          name: p.name ?? null,
          username: p.username ?? null,
        });
        dbg("success via graph.instagram.com", { source });
        return p;
      }
    } else if (ig?.json.error) {
      dbg("graph.instagram.com failed", {
        source,
        code: ig.json.error.code,
        message: ig.json.error.message,
      });
    }

    const last = ig ?? fb;
    if (last?.json.error) {
      lastFailure = {
        httpStatus: last.res.status,
        message: last.json.error.message,
        code: last.json.error.code,
        fbtrace_id: last.json.error.fbtrace_id,
        source,
      };
    }
  }

  if (lastFailure) {
    console.warn(`${LOG_PREFIX} All tokens and hosts failed (last attempt)`, {
      ...lastFailure,
      igsid: instagramScopedUserId,
      hint:
        lastFailure.code === 190
          ? "Remove a bad INSTAGRAM_PAGE_ACCESS_TOKEN so INSTAGRAM_ACCESS_TOKEN (messaging token) can be tried, or paste Page token from GET /me/accounts → data[].access_token only."
          : undefined,
    });
  }

  return null;
}

/**
 * Fetches Instagram profile from Graph API and updates the lead (name + instagramUsername).
 * Returns updated lead document, or the original if nothing changed / token missing / API error.
 */
export async function enrichLeadInstagramProfile(
  leadId: string,
): Promise<LeadDoc | null> {
  const col = db.collection<LeadDoc>(LEADS);
  const lead = await col.findOne({ id: leadId });
  if (!lead) {
    dbg("enrich: lead not found", { leadId });
    return null;
  }

  if (!lead.instagramUserId || lead.source !== "instagram") {
    dbg("enrich: skip — not an Instagram lead or missing igsid", {
      leadId,
      source: lead.source,
      hasIgsid: !!lead.instagramUserId,
    });
    return lead;
  }

  if (!needsInstagramProfileEnrichment(lead)) {
    dbg(
      "enrich: skip — profile enrichment not needed (already have username + real name)",
      {
        leadId,
        name: lead.name,
        instagramUsername: lead.instagramUsername ?? null,
      },
    );
    return lead;
  }

  dbg("enrich: starting", {
    leadId,
    igsid: lead.instagramUserId,
    currentName: lead.name,
    currentInstagramUsername: lead.instagramUsername ?? null,
  });

  const profile = await fetchInstagramScopedUserProfile(lead.instagramUserId);
  if (!profile) {
    dbg("enrich: no profile returned — lead unchanged", { leadId });
    return lead;
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (profile.username) {
    updates.instagramUsername = profile.username;
  }
  if (profile.name) {
    updates.name = profile.name;
  } else if (profile.username) {
    updates.name = profile.username;
  }

  if (Object.keys(updates).length <= 1) {
    dbg("enrich: no DB fields to write", { leadId, profile });
    return lead;
  }

  await col.updateOne({ id: leadId }, { $set: updates });
  const merged = { ...lead, ...updates } as LeadDoc;
  dbg("enrich: saved to DB", {
    leadId,
    newName: merged.name,
    newInstagramUsername: merged.instagramUsername ?? null,
  });
  return merged;
}
