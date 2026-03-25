import { useState, useEffect, useCallback } from "react";
import { Factory, Compass, DollarSign, BarChart3, Wrench, Clock, Monitor, Inbox, ChevronLeft, ChevronRight, CheckCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { ScrollableTabsWrapper } from "@/components/ui/scrollable-tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

const PAGE_SIZE = 20;

export default function Alerts() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const fetchPage = useCallback(async () => {
    if (!userId) return;
    let query = (supabase.from("notifications") as any)
      .select("*", { count: "exact" })
      .eq("recipient_id", userId)
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (filter !== "all" && filter !== "unread") query = query.eq("category", filter);
    if (filter === "unread") query = query.eq("is_read", false);
    if (dateFrom) query = query.gte("created_at", `${dateFrom}T00:00:00`);
    if (dateTo) query = query.lte("created_at", `${dateTo}T23:59:59`);

    const { data, count } = await query;
    setItems((data ?? []).map((n: any) => ({
      ...n,
      title: n.title || n.type || "Notification",
      body: n.body || n.content || "",
      category: n.category || "system",
    })));
    setTotal(count ?? 0);
  }, [userId, page, filter, dateFrom, dateTo]);

  useEffect(() => { fetchPage(); }, [fetchPage]);

  const markRead = async (n: any) => {
    if (!n.is_read) {
      await (supabase.from("notifications") as any).update({ is_read: true, read_at: new Date().toISOString() }).eq("id", n.id);
      setItems((prev) => prev.map((x) => x.id === n.id ? { ...x, is_read: true } : x));
    }
    if (n.navigate_to) navigate(n.navigate_to);
  };

  const markAllRead = async () => {
    if (!userId) return;
    await (supabase.from("notifications") as any)
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("recipient_id", userId)
      .eq("is_read", false);
    fetchPage();
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-heading)", color: "hsl(var(--foreground))" }}>
          Alerts
        </h1>
        <div className="flex items-center gap-2">
          <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(0); }} className="h-8 w-36 text-xs" />
          <span className="text-xs text-muted-foreground">to</span>
          <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(0); }} className="h-8 w-36 text-xs" />
          <Button size="sm" variant="outline" onClick={markAllRead} className="h-8 text-xs gap-1">
            <CheckCheck className="h-3.5 w-3.5" /> Mark all read
          </Button>
        </div>
      </div>

      <ScrollableTabsWrapper>
        <div className="flex gap-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => { setFilter(cat.key); setPage(0); }}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                filter === cat.key ? "text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              )}
              style={filter === cat.key ? { backgroundColor: "hsl(var(--primary))" } : undefined}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </ScrollableTabsWrapper>

      <div className="rounded-lg border border-border bg-background divide-y divide-border">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Inbox className="h-10 w-10" style={{ color: "hsl(var(--primary))" }} />
            <p className="text-sm font-medium text-muted-foreground">No notifications found</p>
          </div>
        ) : items.map((n) => {
          const Icon = CATEGORY_ICONS[n.category] || Monitor;
          const borderColor = n.category === "finance" ? "hsl(var(--destructive))" : (CATEGORY_COLORS[n.category] || "hsl(var(--muted-foreground))");
          return (
            <button
              key={n.id}
              onClick={() => markRead(n)}
              className={cn("w-full text-left flex gap-3 px-4 py-3 transition-colors hover:bg-muted/50", !n.is_read && "bg-accent/30")}
            >
              <div className="w-1 rounded-full shrink-0 self-stretch" style={{ backgroundColor: borderColor }} />
              <div className="shrink-0 mt-0.5"><Icon className="h-4 w-4" style={{ color: borderColor }} /></div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold truncate" style={{ color: "hsl(var(--foreground))" }}>{n.title}</p>
                <p className="text-xs line-clamp-2 mt-0.5 text-muted-foreground">{n.body}</p>
                <p className="text-[10px] mt-1" style={{ color: "#999" }}>{relativeTime(n.created_at)}</p>
              </div>
            </button>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground">Page {page + 1} of {totalPages}</span>
          <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
