import { useState, useEffect, useCallback } from "react";
import { Bell, BellRing } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { AlertCentreDrawer } from "./AlertCentreDrawer";
import { toast } from "sonner";

export function NotificationBell() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  const fetchUnread = useCallback(async () => {
    if (!userId) return;
    const { count } = await (supabase.from("notifications") as any)
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", userId)
      .eq("is_read", false);
    setUnreadCount(count ?? 0);
  }, [userId]);

  useEffect(() => {
    fetchUnread();
  }, [fetchUnread]);

  // Realtime subscription
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel("notifications-bell")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_id=eq.${userId}` },
        (payload: any) => {
          setUnreadCount((c) => c + 1);
          const n = payload.new;
          if (n?.title) {
            toast(n.title, {
              description: n.body?.slice(0, 80),
              duration: 5000,
              action: n.navigate_to
                ? { label: "View", onClick: () => (window.location.href = n.navigate_to) }
                : undefined,
            });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const displayCount = unreadCount > 99 ? "99+" : unreadCount;
  const hasUnread = unreadCount > 0;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative p-1.5 rounded-md transition-colors hover:bg-muted"
        aria-label={`Notifications${hasUnread ? ` (${unreadCount} unread)` : ""}`}
      >
        {hasUnread ? (
          <BellRing className="h-5 w-5" style={{ color: "hsl(var(--foreground))" }} />
        ) : (
          <Bell className="h-5 w-5" style={{ color: "hsl(var(--muted-foreground))" }} />
        )}
        {hasUnread && (
          <span
            className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-white font-bold px-1"
            style={{ backgroundColor: "hsl(var(--destructive))", fontSize: "9px", lineHeight: 1 }}
          >
            {displayCount}
          </span>
        )}
      </button>

      <AlertCentreDrawer
        open={open}
        onOpenChange={(v) => { setOpen(v); if (!v) fetchUnread(); }}
      />
    </>
  );
}
