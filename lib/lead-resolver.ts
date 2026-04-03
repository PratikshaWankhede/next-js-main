import { db } from "@/db";
import { LEADS, USER } from "@/db/collections";
import type { LeadDoc } from "@/db/collections";
import { findAssignedUserForInbound } from "@/lib/lead-routing";
import { generateRandomUUID } from "@/helpers/generate-random-uuid";

export interface ResolveLeadInput {
  whatsappPhone?: string;
  whatsappContactName?: string;
  instagramUserId?: string;
  instagramUsername?: string;
  source: "whatsapp" | "instagram";
  whatsappPhoneNumberId?: string;
  instagramScope?: "default";
}

/** Returns the sales user id with the fewest assigned leads, or null if no sales users. */
export async function getLeastLoadedSalesUserId(): Promise<string | null> {
  const userCol = db.collection<{ id: string; role: string; banned?: boolean }>(
    USER,
  );
  const salesUsers = await userCol
    .find({
      role: "sales",
      $or: [{ banned: { $ne: true } }, { banned: { $exists: false } }],
    })
    .project({ id: 1 })
    .toArray();
  const salesIds = salesUsers.map((u) => u.id).filter(Boolean);
  if (salesIds.length === 0) return null;

  const leadCol = db.collection<LeadDoc>(LEADS);
  const counts = await leadCol
    .aggregate<{
      _id: string;
      count: number;
    }>([
      { $match: { assignedUserId: { $in: salesIds } } },
      { $group: { _id: "$assignedUserId", count: { $sum: 1 } } },
    ])
    .toArray();

  const countByUserId = new Map<string, number>(
    counts.map((c) => [c._id, c.count]),
  );
  let minId: string | null = null;
  let minCount = Infinity;
  for (const id of salesIds) {
    const count = countByUserId.get(id) ?? 0;
    if (count < minCount) {
      minCount = count;
      minId = id;
    }
  }
  return minId;
}

/** Returns the follow_up_candidate user id with the fewest assigned leads, or null if none. */
export async function getLeastLoadedFollowUpCandidateUserId(): Promise<
  string | null
> {
  const userCol = db.collection<{ id: string; role: string; banned?: boolean }>(
    USER,
  );
  const followUpUsers = await userCol
    .find({
      role: "follow_up_candidate",
      $or: [{ banned: { $ne: true } }, { banned: { $exists: false } }],
    })
    .project({ id: 1 })
    .toArray();
  const ids = followUpUsers.map((u) => u.id).filter(Boolean);
  if (ids.length === 0) return null;

  const leadCol = db.collection<LeadDoc>(LEADS);
  const counts = await leadCol
    .aggregate<{
      _id: string;
      count: number;
    }>([
      { $match: { assignedUserId: { $in: ids } } },
      { $group: { _id: "$assignedUserId", count: { $sum: 1 } } },
    ])
    .toArray();
  const countByUserId = new Map(counts.map((c) => [c._id, c.count]));
  let minId: string | null = null;
  let minCount = Infinity;
  for (const id of ids) {
    const count = countByUserId.get(id) ?? 0;
    if (count < minCount) {
      minCount = count;
      minId = id;
    }
  }
  return minId;
}

export async function resolveLeadFromInboundMessage(
  input: ResolveLeadInput,
): Promise<LeadDoc> {
  const {
    whatsappPhone,
    whatsappContactName,
    instagramUserId,
    instagramUsername,
    source,
    whatsappPhoneNumberId,
    instagramScope,
  } = input;
  const col = db.collection<LeadDoc>(LEADS);

  if (whatsappPhone) {
    const found = await col.findOne({
      $or: [{ whatsappPhone }, { phone: whatsappPhone }],
    });
    if (found) {
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (!found.whatsappPhone) updates.whatsappPhone = whatsappPhone;
      // Update name when we have profile name and current name is generic (Unknown or phone)
      if (
        whatsappContactName?.trim() &&
        (found.name === "Unknown" ||
          found.name === whatsappPhone ||
          found.name === found.phone)
      ) {
        updates.name = whatsappContactName.trim();
      }
      if (Object.keys(updates).length > 1) {
        await col.updateOne({ id: found.id }, { $set: updates });
        return { ...found, ...updates } as LeadDoc;
      }
      return found;
    }

    const routedUserId =
      (await findAssignedUserForInbound({
        source,
        whatsappPhoneNumberId: whatsappPhoneNumberId ?? null,
        instagramScope: null,
      })) ?? (await getLeastLoadedSalesUserId());

    const created: LeadDoc = {
      id: generateRandomUUID(),
      name: whatsappContactName?.trim() || whatsappPhone,
      phone: whatsappPhone,
      source: "whatsapp",
      stage: "new",
      assignedUserId: routedUserId ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
      slaStatus: "pending",
      whatsappPhone,
    };
    await col.insertOne(created);
    return created;
  }

  if (instagramUserId) {
    const found = await col.findOne({ instagramUserId });
    if (found) {
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      const trimmedUser = instagramUsername?.trim();
      if (
        trimmedUser &&
        (found.instagramUsername !== trimmedUser || !found.instagramUsername)
      ) {
        updates.instagramUsername = trimmedUser;
      }
      // Same idea as WhatsApp: replace generic name when we learn the IG handle.
      const placeholderName = `Instagram ${instagramUserId.slice(-6)}`;
      if (
        trimmedUser &&
        (found.name === "Unknown" ||
          !found.name?.trim() ||
          found.name === placeholderName)
      ) {
        updates.name = trimmedUser.replace(/^@/, "");
      }
      if (Object.keys(updates).length > 1) {
        await col.updateOne({ id: found.id }, { $set: updates });
        return { ...found, ...updates } as LeadDoc;
      }
      return found;
    }

    const routedUserId =
      (await findAssignedUserForInbound({
        source,
        whatsappPhoneNumberId: null,
        instagramScope: instagramScope ?? "default",
      })) ?? (await getLeastLoadedSalesUserId());

    const phonePlaceholder = `ig-${instagramUserId}`;
    const defaultName =
      instagramUsername?.trim().replace(/^@/, "") ||
      `Instagram ${instagramUserId.slice(-6)}`;
    const created: LeadDoc = {
      id: generateRandomUUID(),
      name: defaultName,
      phone: phonePlaceholder,
      source: "instagram",
      stage: "new",
      assignedUserId: routedUserId ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
      slaStatus: "pending",
      instagramUserId,
      instagramUsername: instagramUsername?.trim() ?? null,
    };
    await col.insertOne(created);
    return created;
  }

  throw new Error("Either whatsappPhone or instagramUserId is required");
}
