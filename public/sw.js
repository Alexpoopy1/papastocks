/* PapaStocks service worker: offline shell + notification click handling. */

const CACHE = "papastocks-v1";
const SHELL = ["/", "/markets", "/picks", "/ai", "/settings", "/manifest.json", "/icon-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

/* Network-first for pages & API, cache fallback so the app opens offline. */
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok && !url.pathname.startsWith("/api/")) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((m) => m || caches.match("/")))
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) return client.focus();
      }
      return self.clients.openWindow("/");
    })
  );
});

/* Web-push ready: if you later add a push server, payloads will show. */
self.addEventListener("push", (e) => {
  let data = {};
  try { data = e.data.json(); } catch {}
  e.waitUntil(
    self.registration.showNotification(data.title || "PapaStocks", {
      body: data.body || "Something moved in the market.",
      icon: "/icon-192.png",
      badge: "/icon-192.png"
    })
  );
});
