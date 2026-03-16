import { useConnectionStatus } from "./OfflineProvider";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const status = useConnectionStatus();
  if (status === "online") return null;

  return (
    <div className="bg-warning text-warning-foreground px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2 z-50">
      <WifiOff className="h-4 w-4" />
      Working Offline · Changes will sync when reconnected
    </div>
  );
}
