import { useState, useEffect, useCallback } from "react";
import { X, CheckCheck, Factory, Compass, DollarSign, BarChart3, Wrench, Clock, Monitor, Inbox } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { ScrollableTabsWrapper } from "@/components/ui/scrollable-tabs";

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "production", label: "Production" },
  { key: "design", label: "Design" },
  { key: "finance", label: "Finance" },
  { key: "sales", label: "Sales" },
  { key: "rm", label: "R&M" },
  { key: "hr", label: "HR" },
  { key: "system", label: "System" },
];

const CATEGORY_COLORS: Record<string, string> = {
  production: "hsl(var(--primary))",
  design: "hsl(var(--primary))",
  finance: "hsl(var(--warning))",
  sales: "hsl(var(--primary))",
  rm: "hsl(var(--warning))",
  hr: "hsl(var(--primary))",
  system: "hsl(var(--muted-foreground))",
};

const CATEGORY_ICONS: Record<string, any> = {
  production: Factory,
  design: Compass,
  finance: DollarSign,
  sales: BarChart3,
  rm: Wrench,
  hr: Clock,
  system: Monitor,
};

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
  content?: string;
  type?: string;
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function AlertCentreDrawer({ open, onOpenChange }: Props) {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const navigate = useNavigate();
  const [items, setItems] = useState<Notification[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
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
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  const markAllRead = async () => {
    if (!userId) return;
    await (supabase.from("notifications") as any)
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("recipient_id", userId)
      .eq("is_read", false);
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const markRead = async (n: Notification) => {
    if (!n.is_read) {
      await (supabase.from("notifications") as any)
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("id", n.id);
      setItems((prev) => prev.map((x) => x.id === n.id ? { ...x, is_read: true } : x));
    }
    if (n.navigate_to) {
      onOpenChange(false);
      navigate(n.navigate_to);
    }
  };

  const filtered = items.filter((n) => {
    if (filter === "all") return true;
    if (filter === "unread") return !n.is_read;
    return n.category === filter;
  });

  const unreadTotal = items.filter((n) => !n.is_read).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[400px] p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-2 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SheetTitle className="text-base font-bold" style={{ fontFamily: "var(--font-heading)" }}>
                Notifications
              </SheetTitle>
              {unreadTotal > 0 && (
                <span className="flex items-center justify-center min-w-[20px] h-5 rounded-full text-white text-xs font-bold px-1.5"
                  style={{ backgroundColor: "hsl(var(--destructive))" }}>
                  {unreadTotal}
                </span>
              )}
            </div>
            {unreadTotal > 0 && (
              <button onClick={markAllRead} className="text-xs font-medium" style={{ color: "hsl(var(--primary))" }}>
                <CheckCheck className="inline h-3.5 w-3.5 mr-1" />
                Mark all read
              </button>
            )}
          </div>
          <ScrollableTabsWrapper className="mt-2 -mx-1">
            <div className="flex gap-1 px-1">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => setFilter(cat.key)}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                    filter === cat.key
                      ? "text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                  style={filter === cat.key ? { backgroundColor: "hsl(var(--primary))" } : undefined}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </ScrollableTabsWrapper>
        </SheetHeader>

        <ScrollArea className="flex-1">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Inbox className="h-10 w-10" style={{ color: "hsl(var(--primary))" }} />
              <p className="text-sm font-medium" style={{ color: "hsl(var(--muted-foreground))" }}>
                All caught up!
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((n) => {
                const Icon = CATEGORY_ICONS[n.category] || Monitor;
                const borderColor = n.category === "finance" ? "hsl(var(--destructive))" : (CATEGORY_COLORS[n.category] || "hsl(var(--muted-foreground))");
                return (
                  <button
                    key={n.id}
                    onClick={() => markRead(n)}
                    className={cn(
                      "w-full text-left flex gap-3 px-4 py-3 transition-colors hover:bg-muted/50",
                      !n.is_read && "bg-accent/30"
                    )}
                  >
                    <div className="w-1 rounded-full shrink-0 self-stretch" style={{ backgroundColor: borderColor }} />
                    <div className="shrink-0 mt-0.5">
                      <Icon className="h-4 w-4" style={{ color: borderColor }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold truncate" style={{ color: "hsl(var(--foreground))" }}>
                        {n.title}
                      </p>
                      <p className="text-xs line-clamp-2 mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>
                        {n.body}
                      </p>
                      <p className="text-[10px] mt-1" style={{ color: "#999" }}>
                        {relativeTime(n.created_at)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
