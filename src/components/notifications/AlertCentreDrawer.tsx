import { useState, useEffect, useCallback, useMemo } from "react";
import { CheckCheck, Inbox, ShieldCheck, AlertTriangle, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? "s" : ""} ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

type Notification = {
  id: string;
  title: string;
  body: string;
  category: string;
  is_read: boolean;
  created_at: string;
  navigate_to: string | null;
  related_table?: string;
  related_id?: string;
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

function bucketOf(n: Notification): "approval" | "escalation" | "info" {
  const cat = (n.category || "").toLowerCase();
  if (cat === "approval_request" || cat === "approval" || n.related_table === "approval_requests") return "approval";
  if (cat === "escalation" || cat.includes("overdue") || cat === "alert") return "escalation";
  return "info";
}

const BUCKETS: { key: "approval" | "escalation" | "info"; label: string; icon: any; color: string; badge: string }[] = [
  { key: "approval",   label: "Approvals Needed", icon: ShieldCheck,    color: "#F40009", badge: "#F40009" },
  { key: "escalation", label: "Escalations",      icon: AlertTriangle,  color: "#D4860A", badge: "#D4860A" },
  { key: "info",       label: "Info / Updates",   icon: Info,           color: "#666666", badge: "#999999" },
];

export function AlertCentreDrawer({ open, onOpenChange }: Props) {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const navigate = useNavigate();
  const [items, setItems] = useState<Notification[]>([]);

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    const { data } = await (supabase.from("notifications") as any)
      .select("*")
      .eq("recipient_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);
    setItems((data ?? []).map((n: any) => ({
      ...n,
      title: n.title || n.type || "Notification",
      body: n.body || n.content || "",
      category: n.category || n.linked_entity_type || "system",
    })));
  }, [userId]);

  useEffect(() => { if (open) fetchNotifications(); }, [open, fetchNotifications]);

  const markAllRead = async () => {
    if (!userId) return;
    await (supabase.from("notifications") as any)
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("recipient_id", userId).eq("is_read", false);
    setItems(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const markRead = async (n: Notification) => {
    if (!n.is_read) {
      await (supabase.from("notifications") as any)
        .update({ is_read: true, read_at: new Date().toISOString() }).eq("id", n.id);
      setItems(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
    }
    let target = n.navigate_to;
    // Force approval notifications to deep-link to /approvals
    if (bucketOf(n) === "approval" && (!target || !target.startsWith("/approvals"))) {
      target = n.related_id ? `/approvals?id=${n.related_id}` : "/approvals";
    }
    if (target) {
      onOpenChange(false);
      navigate(target);
    }
  };

  const grouped = useMemo(() => {
    const g: Record<string, Notification[]> = { approval: [], escalation: [], info: [] };
    for (const n of items) g[bucketOf(n)].push(n);
    return g;
  }, [items]);

  const unreadTotal = items.filter(n => !n.is_read).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[400px] p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SheetTitle className="text-base font-bold" style={{ fontFamily: "var(--font-heading)" }}>
                Notifications
              </SheetTitle>
              {unreadTotal > 0 && (
                <span className="flex items-center justify-center min-w-[20px] h-5 rounded-full text-white text-xs font-bold px-1.5"
                  style={{ backgroundColor: "#F40009" }}>{unreadTotal}</span>
              )}
            </div>
            {unreadTotal > 0 && (
              <button onClick={markAllRead} className="text-xs font-medium" style={{ color: "#006039" }}>
                <CheckCheck className="inline h-3.5 w-3.5 mr-1" />Mark all read
              </button>
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Inbox className="h-10 w-10" style={{ color: "#006039" }} />
              <p className="text-sm font-medium text-muted-foreground">All caught up!</p>
            </div>
          ) : (
            <div>
              {BUCKETS.map(b => {
                const list = grouped[b.key];
                if (!list || list.length === 0) return null;
                const unread = list.filter(n => !n.is_read).length;
                const Icon = b.icon;
                return (
                  <div key={b.key} className="border-b border-border">
                    <div className="px-4 py-2 flex items-center gap-2 bg-muted/40">
                      <Icon className="h-3.5 w-3.5" style={{ color: b.color }} />
                      <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: b.color }}>
                        {b.label}
                      </span>
                      {unread > 0 && (
                        <span className="ml-auto rounded-full text-white text-[10px] font-bold px-1.5 py-0.5"
                          style={{ background: b.badge }}>{unread}</span>
                      )}
                    </div>
                    <div className="divide-y divide-border">
                      {list.map(n => (
                        <button key={n.id} onClick={() => markRead(n)}
                          className={cn("w-full text-left flex gap-3 px-4 py-3 transition-colors hover:bg-muted/50",
                            !n.is_read && "bg-accent/30")}>
                          <div className="w-1 rounded-full shrink-0 self-stretch" style={{ backgroundColor: b.color }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold truncate">{n.title}</p>
                            <p className="text-xs line-clamp-2 mt-0.5 text-muted-foreground">{n.body}</p>
                            <p className="text-[10px] mt-1" style={{ color: "#999" }}>{relativeTime(n.created_at)}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
