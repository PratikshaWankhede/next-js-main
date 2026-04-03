import webPush from "web-push";

interface PushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

export interface StoredPushSubscription {
  endpoint: string;
  keys: PushSubscriptionKeys;
}

let configured = false;

function ensureConfigured() {
  if (configured) return;

  const publicKey = process.env.WEB_PUSH_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY;
  const subject = process.env.WEB_PUSH_EMAIL || "mailto:admin@example.com";

  if (!publicKey || !privateKey) {
    // When keys are not configured, we silently skip push sending.
    return;
  }

  webPush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export async function sendPushNotification(params: {
  subscription: StoredPushSubscription;
  payload: {
    title: string;
    body: string;
    url?: string;
  };
}) {
  ensureConfigured();
  if (!configured) return;

  const { subscription, payload } = params;

  try {
    await webPush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
      },
      JSON.stringify(payload),
    );
  } catch (err) {
    // Let callers decide how to handle stale / invalid subscriptions.
    throw err;
  }
}
