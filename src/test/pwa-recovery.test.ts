import { describe, expect, it, vi } from "vitest";
import { createPreloadErrorHandler } from "@/pwa/preloadRecovery";
import { workboxConfig } from "@/pwa/workbox-config";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

function storageMock(initialValue: string | null = null) {
  let value = initialValue;
  return {
    getItem: vi.fn(() => value),
    setItem: vi.fn((_key: string, nextValue: string) => {
      value = nextValue;
    }),
  };
}

describe("PWA navigation cache rules", () => {
  it("does not precache HTML or bind a precached navigation fallback", () => {
    expect(workboxConfig.globPatterns).toEqual(["**/*.{js,css,ico,png,svg,woff2}"]);
    expect(workboxConfig.globPatterns?.join(" ")).not.toContain("html");
    expect(workboxConfig.navigateFallback).toBeNull();
  });

  it("keeps immediate worker activation and old-precache cleanup", () => {
    expect(workboxConfig.skipWaiting).toBe(true);
    expect(workboxConfig.clientsClaim).toBe(true);
    expect(workboxConfig.cleanupOutdatedCaches).toBe(true);
  });

  it("shares /index.html for navigation cache reads and writes", async () => {
    const navigation = workboxConfig.runtimeCaching?.find(
      (route) => route.options?.cacheName === "html-cache",
    );
    const plugin = navigation?.options?.plugins?.[0];
    if (!plugin?.cacheKeyWillBeUsed) throw new Error("Missing shared cache key");
    for (const mode of ["read", "write"] as const) {
      for (const path of ["/", "/login", "/attendance"]) {
        const key = await plugin.cacheKeyWillBeUsed({
          request: new Request(`https://h-stack.com${path}`), mode,
          event: new Event("fetch") as Parameters<NonNullable<typeof plugin.cacheKeyWillBeUsed>>[0]["event"],
        });
        expect(key).toBe("/index.html");
      }
    }
  });

  it("uses five-second NetworkFirst navigation caching with the existing exclusions", () => {
    const navigation = workboxConfig.runtimeCaching?.find(
      (route) => route.options?.cacheName === "html-cache",
    );
    expect(navigation?.handler).toBe("NetworkFirst");
    expect(navigation?.options?.networkTimeoutSeconds).toBe(5);

    const matches = navigation?.urlPattern as (input: {
      request: { mode: string };
      url: URL;
    }) => boolean;
    const request = { mode: "navigate" };
    expect(matches({ request, url: new URL("https://h-stack.com/projects") })).toBe(true);
    expect(matches({ request, url: new URL("https://h-stack.com/~oauth") })).toBe(false);
    expect(matches({ request, url: new URL("https://h-stack.com/auth/callback") })).toBe(false);
    expect(matches({ request, url: new URL("https://h-stack.com/version.json") })).toBe(false);
    expect(matches({ request: { mode: "cors" }, url: new URL("https://h-stack.com/projects") })).toBe(false);
  });
});

describe("installation HTML runtime-cache seed", () => {
  async function install(status: number, failure = false) {
    const response = { status };
    const fetch = vi.fn(() => failure
      ? Promise.reject(new Error("Offline")) : Promise.resolve(response));
    const put = vi.fn();
    const open = vi.fn(async () => ({ put }));
    let done: Promise<void> | undefined;
    const waitUntil = vi.fn((promise: Promise<void>) => { done = promise; });
    const addEventListener = vi.fn((_name: string, listener: (event: unknown) => void) => {
      listener({ waitUntil });
    });
    const source = readFileSync("public/pwa-html-cache.js", "utf8");
    runInNewContext(source, { self: { addEventListener }, fetch, caches: { open } });
    if (!done) throw new Error("Install must wait for the seed");
    const completed = done;
    return { fetch, open, put, response, completed, addEventListener };
  }

  it("imports the installation hook in the generated worker", () => {
    expect(workboxConfig.importScripts).toEqual(["/pwa-html-cache.js"]);
  });

  it("fetches fresh HTML and saves a 200 response before installation completes", async () => {
    const result = await install(200);
    await result.completed;
    expect(result.addEventListener).toHaveBeenCalledWith("install", expect.any(Function));
    expect(result.fetch).toHaveBeenCalledWith("/index.html", { cache: "no-store" });
    expect(result.open).toHaveBeenCalledWith("html-cache");
    expect(result.put).toHaveBeenCalledWith("/index.html", result.response);
  });

  it.each([204, 404, 500])("never caches an HTTP %i response", async (status) => {
    const result = await install(status);
    await result.completed;
    expect(result.open).not.toHaveBeenCalled();
    expect(result.put).not.toHaveBeenCalled();
  });

  it("does not activate an update whose fresh shell fetch fails", async () => {
    const result = await install(200, true);
    await expect(result.completed).rejects.toThrow("Offline");
    expect(result.put).not.toHaveBeenCalled();
  });
});

describe("vite:preloadError recovery", () => {
  it("reloads once and suppresses only the event that triggers that reload", () => {
    const storage = storageMock();
    const reload = vi.fn();
    const handler = createPreloadErrorHandler(reload, storage);
    const first = new Event("vite:preloadError", { cancelable: true });
    const second = new Event("vite:preloadError", { cancelable: true });

    handler(first);
    handler(second);

    expect(reload).toHaveBeenCalledTimes(1);
    expect(first.defaultPrevented).toBe(true);
    expect(second.defaultPrevented).toBe(false);
    expect(storage.setItem).toHaveBeenCalledWith("hstack:vite-preload-reload", "1");
  });

  it("does not reload again after a document reload in the same tab", () => {
    const storage = storageMock("1");
    const reload = vi.fn();

    createPreloadErrorHandler(reload, storage)(
      new Event("vite:preloadError", { cancelable: true }),
    );

    expect(reload).not.toHaveBeenCalled();
  });

  it("still guards against loops when session storage is unavailable", () => {
    const storage = {
      getItem: vi.fn(() => {
        throw new Error("Storage blocked");
      }),
      setItem: vi.fn(() => {
        throw new Error("Storage blocked");
      }),
    };
    const reload = vi.fn();
    const handler = createPreloadErrorHandler(reload, storage);

    handler(new Event("vite:preloadError", { cancelable: true }));
    handler(new Event("vite:preloadError", { cancelable: true }));

    expect(reload).toHaveBeenCalledTimes(1);
  });
});
