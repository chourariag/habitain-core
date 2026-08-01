import { RefreshCw } from "lucide-react";
import { useAppUpdate } from "@/pwa/useAppUpdate";

export function UpdateBanner() {
  const { updateAvailable, applyUpdate } = useAppUpdate();

  if (!updateAvailable) return null;

  return (
    <button
      type="button"
      onClick={() => void applyUpdate()}
      className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm font-medium text-primary-foreground bg-primary shrink-0"
      role="status"
      aria-live="polite"
    >
      <RefreshCw size={16} className="shrink-0" />
      <span className="flex-1">A new version of HStack is available — tap to refresh</span>
    </button>
  );
}
