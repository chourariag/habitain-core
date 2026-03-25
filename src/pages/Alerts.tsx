import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/useNotifications";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";

const CATEGORY_LABEL: Record<string, string> = {
  ncr: "QC / NCR",
  payment: "Finance",
  amc: "AMC",
  qc_inspection: "QC Inspection",
};

const CATEGORY_COLOR: Record<string, string> = {
  ncr: "#F40009",
  payment: "#D4860A",
  amc: "#006039",
  qc_inspection: "#F40009",
};

export default function Alerts() {
  const { notifications, unreadCount, loading, markRead, markAllRead } = useNotifications();
  const navigate = useNavigate();

  // Group by date label
  const grouped: Record<string, typeof notifications> = {};
  for (const n of notifications) {
    const label = format(new Date(n.created_at), "dd MMM yyyy");
    if (!grouped[label]) grouped[label] = [];
    grouped[label].push(n);
  }

  const handleClick = async (n: typeof notifications[number]) => {
    if (!n.is_read) await markRead(n.id);
    if (n.navigate_to) navigate(n.navigate_to);
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-display text-2xl font-bold" style={{ color: "#1A1A1A" }}>
            Alert Centre
          </h1>
          <p className="text-sm" style={{ color: "#666666" }}>
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}` : "All caught up"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            style={{ borderColor: "#006039", color: "#006039" }}
            onClick={() => markAllRead()}
          >
            <CheckCheck className="h-4 w-4 mr-1" />
            Mark all read
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-sm" style={{ color: "#999" }}>Loading…</div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24" style={{ color: "#999" }}>
          <Bell className="h-12 w-12 mb-3 opacity-20" />
          <p className="text-sm font-medium">No notifications yet</p>
          <p className="text-xs mt-1">You'll be alerted here for NCRs, payments, AMC renewals and more.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([dateLabel, items]) => (
            <div key={dateLabel}>
              <p className="text-[11px] font-semibold uppercase tracking-wider mb-2 px-1" style={{ color: "#999" }}>
                {dateLabel}
              </p>
              <div className="rounded-lg border overflow-hidden" style={{ borderColor: "#E0E0E0" }}>
                {items.map((n, i) => {
                  const cat = n.category ?? n.type ?? "default";
                  const catLabel = CATEGORY_LABEL[cat] ?? cat;
                  const catColor = CATEGORY_COLOR[cat] ?? "#666666";
                  return (
                    <div
                      key={n.id}
                      className={cn(
                        "flex gap-3 px-4 py-3 cursor-pointer transition-colors",
                        i < items.length - 1 && "border-b",
                        !n.is_read ? "hover:bg-[#F0F8F4]" : "hover:bg-[#F7F7F7]"
                      )}
                      style={{
                        borderColor: "#E0E0E0",
                        backgroundColor: !n.is_read ? "#F8FFFE" : "#FFFFFF",
                      }}
                      onClick={() => handleClick(n)}
                    >
                      <div
                        className="mt-0.5 h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-sm"
                        style={{ backgroundColor: catColor + "18", color: catColor }}
                      >
                        <Bell className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2 justify-between">
                          <p className="text-sm font-medium leading-snug" style={{ color: "#1A1A1A" }}>
                            {n.title ?? n.content ?? "—"}
                          </p>
                          {!n.is_read && (
                            <span className="h-2 w-2 mt-1.5 rounded-full shrink-0" style={{ backgroundColor: "#006039" }} />
                          )}
                        </div>
                        {(n.body ?? (n.title ? n.content : null)) && (
                          <p className="text-xs mt-0.5" style={{ color: "#666" }}>
                            {n.body ?? n.content}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                            style={{ backgroundColor: catColor + "18", color: catColor }}
                          >
                            {catLabel}
                          </span>
                          <span className="text-[10px]" style={{ color: "#999" }}>
                            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
