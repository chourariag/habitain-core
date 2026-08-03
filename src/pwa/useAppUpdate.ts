import { useCallback, useEffect, useRef, useState } from "react";
import { APP_VERSION, fetchDeployedVersion } from "./version";
import { getRegistration, resolveRegistration, SW_URL } from "./registerSW";

const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const APPLY_FALLBACK_MS = 2500;

// Only the caches this app's service worker owns (Workbox precache + the
// runtime caches configured in vite.config.ts). Cache Storage is origin
// scoped, so never blanket-delete.
function isAppCache(name: string) {
  return (
    name.startsWith("workbox-precache") ||
    name === "html-cache" ||
    name === "asset-cache"
  );
}

async function clearAppCaches() {
  if (typeof caches === "undefined") return;
  try {
    const names = await caches.keys();
    await Promise.allSettled(names.filter(isAppCache).map((n) => caches.delete(n)));
  } catch {
    /* noop */
  }
}

function hardReload() {
  // Safari will happily re-serve the cached document on a plain reload.
  // A one-shot cache-busting query param guarantees a fresh navigation.
  const url = new URL(window.location.href);
  url.searchParams.set("_v", Date.now().toString(36));
  window.location.replace(url.toString());
}

export function useAppUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const timerRef = useRef<number | null>(null);
  const applyingRef = useRef(false);

  const check = useCallback(async () => {
    const deployed = await fetchDeployedVersion();
    if (!deployed) return; // offline / failed — skip silently
    if (deployed !== APP_VERSION) {
      setUpdateAvailable(true);
      // Ask the browser to fetch the new service worker now, so a waiting
      // worker exists by the time the user taps refresh.
      try {
        await (await resolveRegistration())?.update();
      } catch {
        /* noop */
      }
    }
  }, []);

  useEffect(() => {
    void check();

    const startTimer = () => {
      if (timerRef.current !== null) return;
      timerRef.current = window.setInterval(() => void check(), CHECK_INTERVAL_MS);
    };
    const stopTimer = () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void check();
        startTimer();
      } else {
        stopTimer();
      }
    };
    const onFocus = () => void check();

    if (document.visibilityState === "visible") startTimer();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    return () => {
      stopTimer();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, [check]);

  const applyUpdate = useCallback(async () => {
    if (applyingRef.current) return;
    applyingRef.current = true;

    // Fallback: if nothing has navigated within a couple of seconds
    // (Safari often never fires controllerchange), force a hard reload.
    const fallback = window.setTimeout(() => {
      void clearAppCaches().finally(hardReload);
    }, APPLY_FALLBACK_MS);

    try {
      const reg = (await resolveRegistration()) ?? getRegistration();

      if (reg && "serviceWorker" in navigator) {
        // Make sure a new worker has actually been fetched.
        try {
          await reg.update();
        } catch {
          /* noop */
        }

        const waiting = reg.waiting ?? reg.installing;
        if (waiting) {
          let reloaded = false;
          const onControllerChange = () => {
            if (reloaded) return;
            reloaded = true;
            window.clearTimeout(fallback);
            void clearAppCaches().finally(hardReload);
          };
          navigator.serviceWorker.addEventListener("controllerchange", onControllerChange, {
            once: true,
          });

          const post = () => waiting.postMessage({ type: "SKIP_WAITING" });
          if (waiting.state === "installed" || waiting.state === "activated") post();
          else waiting.addEventListener("statechange", () => {
            if (waiting.state === "installed") post();
          });
          return; // controllerchange or the fallback timer takes it from here
        }

        // No new worker pending: the stale bundle is HTTP-cached, not SW-cached
        // (classic Safari behaviour). Drop caches, unregister, hard reload.
        try {
          if (reg.active?.scriptURL.endsWith(SW_URL)) await reg.unregister();
        } catch {
          /* noop */
        }
      }

      window.clearTimeout(fallback);
      await clearAppCaches();
      hardReload();
    } catch {
      window.clearTimeout(fallback);
      hardReload();
    }
  }, []);

  return { updateAvailable, applyUpdate, version: APP_VERSION };
}
