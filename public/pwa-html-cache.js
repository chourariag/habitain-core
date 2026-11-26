// Imported by the generated Workbox worker, never registered independently.
// Keep HTML in the runtime cache, not in the revisioned asset precache.
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const response = await fetch("/index.html", { cache: "no-store" });
      if (response.status !== 200) return;
      const cache = await caches.open("html-cache");
      await cache.put("/index.html", response);
    })(),
  );
});