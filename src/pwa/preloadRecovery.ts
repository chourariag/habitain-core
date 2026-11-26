const PRELOAD_RELOAD_KEY = "hstack:vite-preload-reload";

type ReloadStorage = Pick<Storage, "getItem" | "setItem">;

function getSessionStorage(): ReloadStorage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** Reload at most once per tab session, even if the new document also fails. */
export function createPreloadErrorHandler(
  reload: () => void = () => window.location.reload(),
  storage: ReloadStorage | null = getSessionStorage(),
) {
  let attemptedInThisDocument = false;

  return (event: Event) => {
    if (attemptedInThisDocument) return;

    try {
      if (storage?.getItem(PRELOAD_RELOAD_KEY)) {
        attemptedInThisDocument = true;
        return;
      }
    } catch {
      // The in-memory flag below still prevents a loop when storage is blocked.
    }

    attemptedInThisDocument = true;
    try {
      storage?.setItem(PRELOAD_RELOAD_KEY, "1");
    } catch {
      // Reload recovery must not fail because session storage is unavailable.
    }

    event.preventDefault();
    reload();
  };
}

export function registerPreloadErrorRecovery() {
  window.addEventListener("vite:preloadError", createPreloadErrorHandler());
}
