import type { GenerateSWOptions } from "workbox-build";

/**
 * Never precache HTML: a cached document can reference chunks removed by a
 * later deployment. Navigations use the network first instead.
 */
export const workboxConfig: Partial<GenerateSWOptions> = {
  clientsClaim: true,
  skipWaiting: true,
  cleanupOutdatedCaches: true,
  navigateFallback: null,
  globPatterns: ["**/*.{js,css,ico,png,svg,woff2}"],
  globIgnores: ["**/version.json"],
  maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
  runtimeCaching: [
    {
      urlPattern: ({ request, url }) =>
        request.mode === "navigate" &&
        !/^\/~oauth/.test(url.pathname) &&
        !/^\/auth\/callback/.test(url.pathname) &&
        !/^\/version\.json/.test(url.pathname),
      handler: "NetworkFirst",
      options: {
        cacheName: "html-cache",
        networkTimeoutSeconds: 5,
      },
    },
    {
      urlPattern: ({ url, sameOrigin }) =>
        sameOrigin && /\.(?:js|css|woff2?)$/.test(url.pathname),
      handler: "CacheFirst",
      options: { cacheName: "asset-cache" },
    },
  ],
};
