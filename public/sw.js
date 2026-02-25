self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Notification", body: event.data.text() };
  }
  const { title, body, link } = payload;
  const options = {
    body: body ?? "",
    data: { link: link ?? "/" },
    tag: link ?? "auction-notification",
  };
  event.waitUntil(self.registration.showNotification(title ?? "Auction", options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = event.notification.data?.link ?? "/";
  const fullUrl = path.startsWith("/") ? `${self.location.origin}${path}` : path;
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          client.navigate(fullUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(fullUrl);
      }
    })
  );
});
