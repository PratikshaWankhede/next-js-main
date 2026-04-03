import { db } from "@/db";
import { NOTIFICATION_PREFERENCES } from "@/db/collections";
import type { NotificationType } from "@/db/collections";
import { sendWhatsAppMessage } from "@/lib/integrations/whatsapp";

type Notification = {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  leadId: string | null;
};

type User = {
  id: string;
  whatsappPhone?: string | null;
};

function getStaffWhatsAppPhone(userId: string, user: User): string | null {
  const envMap = process.env.STAFF_WHATSAPP_PHONES;
  if (envMap) {
    try {
      const map = JSON.parse(envMap) as Record<string, string>;
      const phone = map[userId];
      if (phone) return phone;
    } catch {
      // ignore
    }
  }
  return user.whatsappPhone ?? null;
}

export async function sendWhatsAppInternalAlert(
  notification: Notification,
  user: User,
): Promise<boolean> {
  const pref = await db.collection(NOTIFICATION_PREFERENCES).findOne({
    userId: user.id,
    channel: "whatsapp",
    type: notification.type as NotificationType,
  });

  if (!pref || !pref.enabled) return false;

  const phone = getStaffWhatsAppPhone(user.id, user);
  if (!phone) return true;

  const content = `${notification.title}: ${notification.body}`;
  const result = await sendWhatsAppMessage({ phone, content });
  return result !== null;
}
