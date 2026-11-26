import { describe, expect, it, vi } from "vitest";
import { createPreloadErrorHandler } from "@/pwa/preloadRecovery";
import { workboxConfig } from "@/pwa/workbox-config";

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
