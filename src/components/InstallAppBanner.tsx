import { useEffect, useState } from "react";
import { X, Download } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "hstack-install-dismissed";

export function InstallAppBanner() {
  const isMobile = useIsMobile();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY) === "1") return;
    // Already installed (standalone)
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!visible || !isMobile || !deferred) return null;

  const onInstall = async () => {
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } finally {
      localStorage.setItem(DISMISS_KEY, "1");
      setVisible(false);
      setDeferred(null);
    }
  };

  const onDismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  return (
    <div
      className="flex items-center gap-3 px-4 py-2 text-white text-sm shrink-0"
      style={{ backgroundColor: "#006039" }}
      role="region"
      aria-label="Install HStack"
    >
      <Download size={18} className="shrink-0" />
      <span className="flex-1 font-medium">
        Install HStack on your phone for faster access
      </span>
      <button
        type="button"
        onClick={onInstall}
        className="px-3 py-1 rounded bg-white text-[#006039] font-semibold text-xs hover:bg-white/90"
      >
        Install
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="p-1 rounded hover:bg-white/10"
      >
        <X size={16} />
      </button>
    </div>
  );
}
