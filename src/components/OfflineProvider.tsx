import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPendingRecords, clearPendingRecords, type OfflineAttendanceRecord } from "@/lib/offline-attendance";
import { toast } from "sonner";

type ConnectionStatus = "online" | "offline";

const OfflineContext = createContext<ConnectionStatus>("online");

export const useConnectionStatus = () => useContext(OfflineContext);

export function OfflineProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ConnectionStatus>(
    navigator.onLine ? "online" : "offline"
  );

  useEffect(() => {
    const goOnline = () => {
      setStatus("online");
      syncPendingRecords();
    };
    const goOffline = () => setStatus("offline");
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    // Try syncing on mount if online
    if (navigator.onLine) syncPendingRecords();
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const syncPendingRecords = async () => {
    try {
      const records = await getPendingRecords();
      if (records.length === 0) return;

      window.dispatchEvent(new Event("attendance-sync-start"));

      let synced = 0;
      for (const r of records) {
        try {
          if (r.action === "check_in") {
            await supabase.from("attendance_records").insert({
              user_id: r.user_id,
              date: r.date,
              check_in_time: r.check_in_time,
              location_type: r.location_type,
              project_id: r.project_id || null,
              gps_lat: r.gps_lat,
              gps_lng: r.gps_lng,
              gps_verified: r.gps_verified,
              remote_reason: r.remote_reason || null,
              offline_captured: true,
              synced_at: new Date().toISOString(),
            });
            synced++;
          } else if (r.action === "check_out" && r.attendance_record_id) {
            await supabase.from("attendance_records").update({
              check_out_time: r.check_out_time,
              hours_worked: r.hours_worked,
            }).eq("id", r.attendance_record_id);
            synced++;
          }
        } catch (err) {
          console.error("Failed to sync record:", err);
        }
      }

      await clearPendingRecords();
      window.dispatchEvent(new Event("attendance-sync-end"));
      if (synced > 0) {
        toast.success(`${synced} attendance record${synced > 1 ? "s" : ""} synced ✓`);
      }
    } catch (err) {
      console.error("Sync failed:", err);
    }
  };

  return (
    <OfflineContext.Provider value={status}>{children}</OfflineContext.Provider>
  );
}
