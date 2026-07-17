import { createRoot } from "react-dom/client";
import "./i18n";
import "./index.css";
import { registerServiceWorker } from "./pwa/registerSW";

const BUILD_CACHE_BUSTER = "hstack-clean-rebuild-20260717-0715";

const requiredEnv = {
  url: import.meta.env.VITE_SUPABASE_URL,
  key: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
};

const root = document.getElementById("root");

if (!requiredEnv.url || !requiredEnv.key) {
  if (root) {
    root.innerHTML = `
      <div class="min-h-screen flex items-center justify-center bg-background px-6">
        <main class="w-full max-w-md space-y-4 rounded-md border border-border bg-card p-6 shadow-sm">
          <div class="h-9 w-9 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">H</div>
          <div class="space-y-2">
            <h1 class="font-display text-xl font-bold text-foreground">HStack is temporarily unavailable</h1>
            <p class="text-sm text-muted-foreground">The app configuration was not included in this build. Please refresh shortly.</p>
          </div>
          <button class="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground" onclick="window.location.reload()">Refresh</button>
        </main>
      </div>
    `;
  }
} else {
  import("./App.tsx").then(({ default: App }) => {
    createRoot(root!).render(<App />);
  });
}

registerServiceWorker();

void BUILD_CACHE_BUSTER;
