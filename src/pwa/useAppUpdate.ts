import { useCallback, useEffect, useRef, useState } from "react";
import { APP_VERSION, fetchDeployedVersion } from "./version";
import { getRegistration } from "./registerSW";

const CHECK_INTERVAL_MS = 5 * 60 * 1000;

export function useAppUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const timerRef = useRef<number | null>(null);

  const check = useCallback(async () => {
    const deployed = await fetchDeployedVersion();
    if (!deployed) return; // offline / failed — skip silently
    if (deployed !== APP_VERSION) {
      setUpdateAvailable(true);
      // Ask the browser to fetch the new service worker now, so a waiting
      // worker exists by the time the user taps refresh.
      try {
        await getRegistration()?.update();
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
    const reg = getRegistration();
    const waiting = reg?.waiting;
    if (waiting && "serviceWorker" in navigator) {
      let reloaded = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (reloaded) return;
        reloaded = true;
        window.location.reload();
      });
      waiting.postMessage({ type: "SKIP_WAITING" });
      // Safety net if controllerchange never fires.
      window.setTimeout(() => {
        if (!reloaded) window.location.reload();
      }, 3000);
      return;
    }
    window.location.reload();
  }, []);

  return { updateAvailable, applyUpdate, version: APP_VERSION };
}
