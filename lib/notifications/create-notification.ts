import { db } from "@/db";
import { NOTIFICATIONS } from "@/db/collections";
import type { NotificationDoc, NotificationType } from "@/db/collections";
import { generateRandomUUID } from "@/helpers/generate-random-uuid";
import { sendPushNotification } from "@/lib/notifications/web-push";

export type { NotificationType };

export type CreateNotificationParams = {
  type: NotificationType;
  title: string;
  body: string;
  leadId?: string;
  targetUserIds: string[];
};

export async function createNotification(params: CreateNotificationParams) {
  const { type, title, body, leadId, targetUserIds } = params;
  if (targetUserIds.length === 0) return;

  const docs: Omit<NotificationDoc, "isRead">[] = targetUserIds.map(
    (userId) => ({
      id: generateRandomUUID(),
      userId,
      type,
      title,
      body,
      message: body,
      leadId: leadId ?? null,
      isRead: false,
      createdAt: new Date(),
    }),
  );
  await db.collection(NOTIFICATIONS).insertMany(docs as NotificationDoc[]);

  const wsUrl = process.env.WS_BROADCAST_URL || "http://localhost:3001";
  const notificationPayload = {
    id: docs[0]?.id,
    type: docs[0]?.type,
    title: docs[0]?.title,
    body: docs[0]?.body,
    leadId: leadId ?? null,
    isRead: false,
    createdAt: docs[0]?.createdAt,
  };

  for (const doc of docs) {
    fetch(`${wsUrl}/broadcast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: doc.userId,
        notification: {
          id: doc.id,
          type: doc.type,
          title: doc.title,
          body: doc.body,
          leadId: doc.leadId ?? null,
          isRead: false,
          createdAt: doc.createdAt,
        },
      }),
    }).catch(() => {});
  }

  if (leadId) {
    fetch(`${wsUrl}/broadcast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId,
        notification: notificationPayload,
      }),
    }).catch(() => {});
  }

  // Immediate push notifications (for when tab is closed or backgrounded)
  const pushSubCol = db.collection("push_subscriptions");
  for (const doc of docs) {
    pushSubCol
      .find({ userId: doc.userId })
      .toArray()
      .then((subs) => {
        for (const sub of subs) {
          sendPushNotification({
            subscription: {
              endpoint: sub.endpoint as string,
              keys: {
                p256dh: (sub.keys as { p256dh?: string })?.p256dh ?? "",
                auth: (sub.keys as { auth?: string })?.auth ?? "",
              },
            },
            payload: {
              title: doc.title,
              body: doc.body,
              url: doc.leadId ? `/leads/${doc.leadId}` : undefined,
            },
          }).catch((err: unknown) => {
            const sc =
              err && typeof err === "object" && "statusCode" in err
                ? (err as { statusCode?: number }).statusCode
                : null;
            if (sc === 404 || sc === 410) {
              pushSubCol.deleteOne({ _id: sub._id }).catch(() => {});
            }
          });
        }
      })
      .catch(() => {});
  }
}
