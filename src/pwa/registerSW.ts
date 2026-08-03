// Guarded service worker registration.
// - Never registers in dev / Lovable preview / iframes.
// - Supports `?sw=off` kill switch.
// - Unregisters any matching stale registration in refused contexts.

export const SW_URL = "/sw.js";

let registration: ServiceWorkerRegistration | null = null;

export function getRegistration() {
  return registration;
}

// Safari can hand back a stale in-memory handle; always re-resolve from the
// browser when possible so we act on the live registration.
export async function resolveRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    const reg = (await navigator.serviceWorker.getRegistration(SW_URL)) ?? registration;
    if (reg) registration = reg;
    return reg ?? null;
  } catch {
    return registration;
  }
}

function isRefusedContext(): boolean {
  if (typeof window === "undefined") return true;
  if (!import.meta.env.PROD) return true;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const host = window.location.hostname;
  if (host.startsWith("id-preview--") || host.startsWith("preview--")) return true;
  if (host === "lovableproject.com" || host.endsWith(".lovableproject.com")) return true;
  if (host === "lovableproject-dev.com" || host.endsWith(".lovableproject-dev.com")) return true;
  if (host === "beta.lovable.dev" || host.endsWith(".beta.lovable.dev")) return true;
  if (new URLSearchParams(window.location.search).get("sw") === "off") return true;
  return false;
}

async function unregisterMatching() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      regs
        .filter((r) => r.active?.scriptURL.endsWith(SW_URL) || r.installing?.scriptURL.endsWith(SW_URL))
        .map((r) => r.unregister()),
    );
  } catch {
    /* noop */
  }
}

export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  if (isRefusedContext()) {
    void unregisterMatching();
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker
      // updateViaCache: "none" stops Safari serving sw.js from HTTP cache,
      // which otherwise hides new versions indefinitely.
      .register(SW_URL, { updateViaCache: "none" })
      .then((reg) => {
        registration = reg;
      })
      .catch(() => {
        /* swallow */
      });
  });
}
