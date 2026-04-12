import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, AlertTriangle, Bell, Package } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO, differenceInDays } from "date-fns";
import { insertNotifications } from "@/lib/notifications";

export function MaterialAvailability() {
  const [planItems, setPlanItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    const { data } = await (supabase.from("material_plan_items") as any)
      .select("*, projects(name)")
      .in("status", ["planned", "delayed"])
      .order("required_by", { ascending: true });
    setPlanItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleAlert = async (item: any) => {
    // Find stores_executive (Vijay) to alert
    const { data: stores } = await supabase
      .from("profiles")
      .select("auth_user_id, full_name")
      .eq("role", "stores_executive" as any)
      .eq("is_active", true);

    for (const u of stores ?? []) {
      await insertNotifications({
        recipient_id: u.auth_user_id,
        title: "Material Availability Alert",
        body: `${item.material_name} needed for ${item.projects?.name ?? "project"} by ${format(parseISO(item.required_by), "dd/MM/yyyy")} — please confirm availability.`,
        category: "procurement",
        related_table: "material_plan_items",
        related_id: item.id,
      });
    }
    toast.success("Alert sent to stores team");
  };

  if (loading) {
    return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  const today = new Date();
  const critical = planItems.filter((i) => differenceInDays(parseISO(i.required_by), today) <= 3);
  const upcoming = planItems.filter((i) => {
    const d = differenceInDays(parseISO(i.required_by), today);
    return d > 3 && d <= 14;
  });
  const normal = planItems.filter((i) => differenceInDays(parseISO(i.required_by), today) > 14);

  const renderItem = (item: any) => {
    const daysLeft = differenceInDays(parseISO(item.required_by), today);
    const isOverdue = daysLeft < 0;
    const isCritical = daysLeft >= 0 && daysLeft <= 3;
    const color = isOverdue ? "#F40009" : isCritical ? "#D4860A" : "#006039";

    return (
      <Card key={item.id} style={{ borderColor: (isOverdue || isCritical) ? color : undefined }}>
        <CardContent className="py-3 px-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Package className="h-3.5 w-3.5 shrink-0" style={{ color }} />
                <p className="font-medium text-sm" style={{ color: "#1A1A1A" }}>{item.material_name}</p>
              </div>
              {item.projects?.name && <p className="text-xs mt-0.5" style={{ color: "#666" }}>{item.projects.name}</p>}
              <p className="text-xs mt-0.5" style={{ color: "#999" }}>
                {item.quantity} {item.unit} · Required: {format(parseISO(item.required_by), "dd/MM/yyyy")}
              </p>
              <p className="text-xs font-medium mt-0.5" style={{ color }}>
                {isOverdue ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? "Due today" : `${daysLeft}d remaining`}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <Badge variant="outline" className="text-[10px]" style={{ color, borderColor: color }}>
                {item.status}
              </Badge>
              {(isOverdue || isCritical) && (
                <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => handleAlert(item)}>
                  <Bell className="h-3 w-3 mr-1" /> Alert Vijay
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      {critical.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" style={{ color: "#F40009" }} />
            <p className="text-sm font-semibold" style={{ color: "#F40009" }}>Critical — Due within 3 days ({critical.length})</p>
          </div>
          {critical.map(renderItem)}
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold" style={{ color: "#D4860A" }}>Upcoming — Due within 14 days ({upcoming.length})</p>
          {upcoming.map(renderItem)}
        </div>
      )}

      {normal.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold" style={{ color: "#666" }}>Scheduled ({normal.length})</p>
          {normal.map(renderItem)}
        </div>
      )}

      {planItems.length === 0 && (
        <div className="text-center py-8">
          <Package className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No pending material plan items.</p>
        </div>
      )}
    </div>
  );
}
