self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }

  const title = payload.title || "New notification";
  const body = payload.body || "";
  const url = payload.url || "/";

  const options = {
    body,
    data: { url },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url;

  event.waitUntil(
    (async () => {
      const allClients = await clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      const client = allClients.find((c) => {
        return (
          "url" in c &&
          typeof c.url === "string" &&
          c.url.includes(self.origin || "")
        );
      });

      if (client) {
        await client.focus();
        if (url) {
          client.navigate(url);
        }
      } else if (url) {
        await clients.openWindow(url);
      }
    })(),
  );
});
