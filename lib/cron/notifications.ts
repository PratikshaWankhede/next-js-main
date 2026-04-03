import "dotenv/config";
import { db } from "@/db";
import {
  NOTIFICATION_DELIVERIES,
  NOTIFICATION_PREFERENCES,
  NOTIFICATIONS,
  USER,
} from "@/db/collections";
import type {
  NotificationDeliveryDoc,
  NotificationDoc,
  UserDoc,
} from "@/db/collections";
import { sendEmailNotification } from "@/lib/notifications/email";
import { sendWhatsAppInternalAlert } from "@/lib/notifications/whatsapp-internal";
import { sendPushNotification } from "@/lib/notifications/web-push";
import { generateRandomUUID } from "@/helpers/generate-random-uuid";

export async function runNotificationDeliveryCron() {
  const notifCol = db.collection<NotificationDoc>(NOTIFICATIONS);
  const userCol = db.collection<UserDoc>(USER);
  const prefCol = db.collection(NOTIFICATION_PREFERENCES);
  const deliveryCol = db.collection<NotificationDeliveryDoc>(
    NOTIFICATION_DELIVERIES,
  );
  const pushSubCol = db.collection("push_subscriptions");

  const allNotifications = await notifCol
    .find({})
    .sort({ createdAt: 1 })
    .toArray();

  let deliveredCount = 0;

  for (const notif of allNotifications) {
    const u = await userCol.findOne({ id: notif.userId });
    if (!u) continue;

    const notification = {
      id: notif.id,
      userId: notif.userId,
      type: notif.type,
      title: notif.title,
      body: notif.body,
      leadId: notif.leadId ?? null,
    };

    const userInfo = {
      id: u.id,
      email: u.email,
      whatsappPhone: u.whatsappPhone ?? undefined,
    };

    for (const channel of ["email", "whatsapp"] as const) {
      const existing = await deliveryCol.findOne({
        notificationId: notif.id,
        channel,
      });
      if (existing) continue;

      const pref = await prefCol.findOne({
        userId: notif.userId,
        channel,
        type: notif.type,
      });
      if (!pref || !pref.enabled) continue;

      let status: "sent" | "failed" = "failed";
      let error: string | null = null;

      try {
        if (channel === "email") {
          const ok = await sendEmailNotification(notification, userInfo);
          status = ok ? "sent" : "failed";
        } else {
          const ok = await sendWhatsAppInternalAlert(notification, userInfo);
          status = ok ? "sent" : "failed";
        }
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
      }

      await deliveryCol.insertOne({
        id: generateRandomUUID(),
        notificationId: notif.id,
        channel,
        status,
        error,
        attemptedAt: new Date(),
      });

      if (status === "sent") deliveredCount++;
    }

    // Web push (in_app-like), per device subscription.
    try {
      const pushPrefsEnabled = await prefCol.findOne({
        userId: notif.userId,
        channel: "in_app",
        type: notif.type,
        enabled: true,
      });

      if (pushPrefsEnabled) {
        const subscriptions = await pushSubCol
          .find({ userId: notif.userId })
          .toArray();

        for (const sub of subscriptions) {
          try {
            await sendPushNotification({
              subscription: {
                endpoint: sub.endpoint as string,
                keys: {
                  p256dh: sub.keys?.p256dh as string,
                  auth: sub.keys?.auth as string,
                },
              },
              payload: {
                title: notif.title,
                body: notif.body,
                url: notif.leadId ? `/leads/${notif.leadId}` : undefined,
              },
            });
          } catch (err: unknown) {
            const msg =
              err && typeof err === "object" && "statusCode" in err
                ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (err as any).statusCode
                : null;
            if (msg === 404 || msg === 410) {
              await pushSubCol.deleteOne({ _id: sub._id });
            }
          }
        }
      }
    } catch {
      // ignore push errors so they don't break cron
    }
  }

  if (deliveredCount > 0) {
    console.log(
      `[cron] Delivered ${deliveredCount} notifications via email/WhatsApp`,
    );
  }
}

runNotificationDeliveryCron()
  .then(() => {
    console.log("[cron] Notification delivery cron completed");
    process.exit(0);
  })
  .catch((err) => {
    console.error("[cron] Notification delivery cron failed:", err);
    process.exit(1);
  });
