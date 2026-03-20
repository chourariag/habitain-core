import { useState, useEffect } from "react";
import { useConnectionStatus } from "./OfflineProvider";
import { getPendingCount } from "@/lib/offline-attendance";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function ConnectionIndicator() {
  const status = useConnectionStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  useEffect(() => {
    const check = async () => {
      try {
        const count = await getPendingCount();
        setPendingCount(count);
      } catch { /* indexedDB unavailable */ }
    };
    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, [status]);

  // Listen for custom sync events
  useEffect(() => {
    const onSyncStart = () => setSyncing(true);
    const onSyncEnd = (e: Event) => {
      setSyncing(false);
      setPendingCount(0);
      setLastSynced(new Date().toLocaleTimeString());
    };
    window.addEventListener("attendance-sync-start", onSyncStart);
    window.addEventListener("attendance-sync-end", onSyncEnd);
    return () => {
      window.removeEventListener("attendance-sync-start", onSyncStart);
      window.removeEventListener("attendance-sync-end", onSyncEnd);
    };
  }, []);

  const isOffline = status === "offline";
  const dotColor = syncing
    ? "bg-[#D4860A] animate-pulse"
    : isOffline
      ? "bg-[#F40009]"
      : "bg-[#006039]";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1.5 px-1.5 py-1 rounded-md hover:bg-accent/10 transition-colors">
          <span className={`inline-block w-2 h-2 rounded-full ${dotColor}`} />
          {(isOffline || syncing) && (
            <span className="text-[10px] font-medium" style={{ color: isOffline ? "#F40009" : "#D4860A" }}>
              {syncing ? "Syncing..." : "Offline"}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="end">
        <div className="space-y-2">
          <p className="text-xs font-semibold" style={{ color: "#1A1A1A" }}>
            {syncing ? "Syncing data…" : isOffline ? "You are offline" : "Connected"}
          </p>
          {isOffline && pendingCount > 0 && (
            <p className="text-xs" style={{ color: "#666" }}>
              {pendingCount} record{pendingCount > 1 ? "s" : ""} saved locally, will sync when connected
            </p>
          )}
          {!isOffline && pendingCount === 0 && (
            <p className="text-xs" style={{ color: "#006039" }}>All data synced ✓</p>
          )}
          {lastSynced && (
            <p className="text-[10px]" style={{ color: "#999" }}>Last synced: {lastSynced}</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
