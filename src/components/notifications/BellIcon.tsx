import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

const CATEGORY_ICON: Record<string, string> = {
  ncr: "🔴",
  payment: "💰",
  amc: "🔔",
  qc_inspection: "🔴",
  default: "📣",
};

export function BellIcon() {
  const { notifications, unreadCount, loading, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleClick = async (notif: typeof notifications[number]) => {
    if (!notif.is_read) await markRead(notif.id);
    if (notif.navigate_to) {
      setOpen(false);
      navigate(notif.navigate_to);
    }
  };

  const icon = (cat: string | null) => CATEGORY_ICON[cat ?? "default"] ?? CATEGORY_ICON.default;

  return (
    <>
      <button
        aria-label="Notifications"
        className="relative flex items-center justify-center h-8 w-8 rounded-md transition-colors hover:bg-[#F7F7F7]"
        onClick={() => setOpen(true)}
      >
        <Bell className="h-5 w-5" style={{ color: "#666666" }} />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 flex items-center justify-center rounded-full text-white font-bold"
            style={{
              backgroundColor: "#F40009",
              fontSize: 9,
              minWidth: 16,
              height: 16,
              padding: "0 3px",
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-sm p-0 flex flex-col">
          <SheetHeader className="px-4 pt-4 pb-2 border-b" style={{ borderColor: "#E0E0E0" }}>
            <div className="flex items-center justify-between">
              <SheetTitle className="font-display text-base" style={{ color: "#1A1A1A" }}>
                Alert Centre
                {unreadCount > 0 && (
                  <span
                    className="ml-2 rounded-full px-2 py-0.5 text-xs font-bold text-white"
                    style={{ backgroundColor: "#F40009" }}
                  >
                    {unreadCount}
                  </span>
                )}
              </SheetTitle>
              {unreadCount > 0 && (
                <button
                  className="text-xs font-medium"
                  style={{ color: "#006039" }}
                  onClick={() => markAllRead()}
                >
                  Mark all read
                </button>
              )}
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-sm" style={{ color: "#999" }}>
                Loading…
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-sm" style={{ color: "#999" }}>
                <Bell className="h-8 w-8 mb-2 opacity-30" />
                No notifications yet
              </div>
            ) : (
              <ul>
                {notifications.map((n) => (
                  <li
                    key={n.id}
                    className={cn(
                      "flex gap-3 px-4 py-3 border-b cursor-pointer transition-colors",
                      !n.is_read ? "hover:bg-[#F0F8F4]" : "hover:bg-[#F7F7F7] opacity-70"
                    )}
                    style={{ borderColor: "#E0E0E0", backgroundColor: !n.is_read ? "#F8FFFE" : undefined }}
                    onClick={() => handleClick(n)}
                  >
                    <span className="mt-0.5 text-lg shrink-0">{icon(n.category ?? n.type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-snug" style={{ color: "#1A1A1A" }}>
                        {n.title ?? n.content ?? "—"}
                      </p>
                      {(n.body ?? n.content) && n.title && (
                        <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "#666" }}>
                          {n.body ?? n.content}
                        </p>
                      )}
                      <p className="text-[10px] mt-1" style={{ color: "#999" }}>
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    {!n.is_read && (
                      <span className="mt-1.5 h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: "#006039" }} />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="px-4 py-3 border-t shrink-0" style={{ borderColor: "#E0E0E0" }}>
            <Button
              variant="outline"
              className="w-full text-sm"
              style={{ borderColor: "#006039", color: "#006039" }}
              onClick={() => { setOpen(false); navigate("/alerts"); }}
            >
              View all in Alert Centre
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
