import { db } from "@/db";
import {
  LEAD_ROUTING_RULES,
  USER,
  type LeadRoutingRuleDoc,
  type UserDoc,
} from "@/db/collections";

type InboundSource = "whatsapp" | "instagram";

export interface InboundRoutingContext {
  source: InboundSource;
  whatsappPhoneNumberId?: string | null;
  instagramScope?: "default" | null;
}

async function getValidUserById(userId: string): Promise<UserDoc | null> {
  const userCol = db.collection<UserDoc>(USER);
  const user = await userCol.findOne({
    id: userId,
    $or: [{ banned: { $ne: true } }, { banned: { $exists: false } }],
  });
  return user ?? null;
}

export async function findAssignedUserForInbound(
  ctx: InboundRoutingContext,
): Promise<string | null> {
  const col = db.collection<LeadRoutingRuleDoc>(LEAD_ROUTING_RULES);

  const now = new Date();

  const rules: LeadRoutingRuleDoc[] = [];

  if (ctx.source === "whatsapp") {
    const phoneId = ctx.whatsappPhoneNumberId ?? null;

    if (phoneId) {
      const byPhone = await col
        .find({ source: "whatsapp", whatsappPhoneNumberId: phoneId })
        .toArray();
      rules.push(...byPhone);
    }

    const generic = await col
      .find({
        source: "whatsapp",
        $or: [
          { whatsappPhoneNumberId: { $exists: false } },
          { whatsappPhoneNumberId: null },
        ],
      })
      .toArray();
    rules.push(...generic);
  } else if (ctx.source === "instagram") {
    const scope = ctx.instagramScope ?? "default";
    const scoped = await col
      .find({
        source: "instagram",
        $or: [
          { instagramScope: scope },
          { instagramScope: { $exists: false } },
          { instagramScope: null },
        ],
      })
      .toArray();
    rules.push(...scoped);
  }

  for (const rule of rules) {
    if (!rule.assignedUserId) continue;
    const user = await getValidUserById(rule.assignedUserId);
    if (user) {
      if (!rule.createdAt || !rule.updatedAt) {
        await col.updateOne(
          { id: rule.id },
          {
            $set: {
              createdAt: rule.createdAt ?? now,
              updatedAt: rule.updatedAt ?? now,
            },
          },
        );
      }
      return user.id;
    }
  }

  return null;
}

