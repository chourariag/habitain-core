import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, Layers } from "lucide-react";
import { format, addDays, subDays, isBefore, isAfter } from "date-fns";

interface PlanRow {
  material_name: string;
  category: string;
  total_qty: number;
  unit: string;
  projects: string[];
  earliest_date: Date;
  current_stock: number;
  shortfall: number;
  preferred_vendor: string;
  lead_time_days: number;
  order_by_date: Date;
}

export function ThirtyDayPlanTab() {
  const [planItems, setPlanItems] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [projectsMap, setProjectsMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const today = new Date();
      const thirtyOut = addDays(today, 30);

      const [planRes, invRes, projRes] = await Promise.all([
        (supabase.from("material_plan_items") as any)
          .select("*")
          .eq("status", "planned")
          .lte("required_by", thirtyOut.toISOString().slice(0, 10))
          .order("required_by"),
        supabase.from("inventory_items").select("material_name, current_stock, unit").eq("is_archived", false),
        supabase.from("projects").select("id, name").eq("is_archived", false),
      ]);

      const pm: Record<string, string> = {};
      (projRes.data || []).forEach((p: any) => { pm[p.id] = p.name; });
      setProjectsMap(pm);
      setPlanItems(planRes.data || []);
      setInventory(invRes.data || []);
      setLoading(false);
    })();
  }, []);

  const rows = useMemo(() => {
    // Group by material name (case-insensitive)
    const groups: Record<string, {
      category: string; qty: number; unit: string;
      projects: Set<string>; earliestDate: Date;
      vendor: string; leadTime: number;
    }> = {};

    for (const item of planItems) {
      const key = (item.material_name || "").toLowerCase().trim();
      if (!key) continue;
      const reqDate = item.required_by ? new Date(item.required_by) : new Date();

      if (!groups[key]) {
        groups[key] = {
          category: item.category || "General",
          qty: 0,
          unit: item.unit || "units",
          projects: new Set(),
          earliestDate: reqDate,
          vendor: item.supplier || "—",
          leadTime: Number(item.lead_time_days) || 7,
        };
      }
      groups[key].qty += Number(item.quantity) || 0;
      if (item.project_id && projectsMap[item.project_id]) {
        groups[key].projects.add(projectsMap[item.project_id]);
      }
      if (isBefore(reqDate, groups[key].earliestDate)) {
        groups[key].earliestDate = reqDate;
      }
    }

    // Match inventory stock
    const stockMap: Record<string, number> = {};
    for (const inv of inventory) {
      const k = (inv.material_name || "").toLowerCase().trim();
      stockMap[k] = (stockMap[k] || 0) + (Number(inv.current_stock) || 0);
    }

    const result: PlanRow[] = Object.entries(groups).map(([key, g]) => {
      const stock = stockMap[key] || 0;
      const shortfall = Math.max(0, g.qty - stock);
      const orderByDate = subDays(g.earliestDate, g.leadTime);
      return {
        material_name: key.charAt(0).toUpperCase() + key.slice(1),
        category: g.category,
        total_qty: g.qty,
        unit: g.unit,
        projects: Array.from(g.projects),
        earliest_date: g.earliestDate,
        current_stock: stock,
        shortfall,
        preferred_vendor: g.vendor,
        lead_time_days: g.leadTime,
        order_by_date: orderByDate,
      };
    });

    result.sort((a, b) => a.order_by_date.getTime() - b.order_by_date.getTime());
    return result;
  }, [planItems, inventory, projectsMap]);

  const today = new Date();
  const batchOpportunities = rows.filter(r => r.projects.length >= 2);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" style={{ color: "#666" }} /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Batch order suggestions */}
      {batchOpportunities.length > 0 && (
        <div className="space-y-2">
          {batchOpportunities.slice(0, 3).map((b) => (
            <div
              key={b.material_name}
              className="flex items-center gap-2 p-3 rounded-lg text-sm"
              style={{ backgroundColor: "#E8F2ED", border: "1px solid #006039" }}
            >
              <Layers className="h-4 w-4 shrink-0" style={{ color: "#006039" }} />
              <span style={{ color: "#006039" }}>
                <strong>Batch Order:</strong> {b.projects.length} projects need{" "}
                <strong>{b.material_name}</strong> this month — total {b.total_qty} {b.unit}.
                Consider a single order for better pricing.
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <Card className="border" style={{ borderColor: "#E0E0E0" }}>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow style={{ backgroundColor: "#F7F7F7" }}>
                {["Material", "Category", "Total Qty", "Unit", "Projects", "Earliest Date",
                  "Stock", "Shortfall", "Vendor", "Lead Time", "Order By"].map((h) => (
                  <TableHead key={h} className="text-xs font-semibold whitespace-nowrap" style={{ color: "#666666" }}>
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8" style={{ color: "#999" }}>
                    No materials due in the next 30 days
                  </TableCell>
                </TableRow>
              ) : rows.map((r) => {
                const orderByPast = isBefore(r.order_by_date, today);
                const orderByClose = !orderByPast && isBefore(r.order_by_date, addDays(today, 3));
                const orderByColor = orderByPast ? "#F40009" : orderByClose ? "#D4860A" : "#1A1A1A";
                const orderByBg = orderByPast ? "#FFF0F0" : orderByClose ? "#FFF8E8" : "";

                return (
                  <TableRow key={r.material_name}>
                    <TableCell className="font-medium text-sm whitespace-nowrap" style={{ color: "#1A1A1A" }}>
                      <div className="flex items-center gap-1.5">
                        {r.material_name}
                        {r.projects.length >= 2 && (
                          <Badge className="text-[9px]" style={{ backgroundColor: "#E8F2ED", color: "#006039" }}>
                            Batch
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs" style={{ color: "#666" }}>{r.category}</TableCell>
                    <TableCell className="text-sm font-semibold">{r.total_qty}</TableCell>
                    <TableCell className="text-xs" style={{ color: "#666" }}>{r.unit}</TableCell>
                    <TableCell className="text-xs max-w-[140px] truncate" style={{ color: "#666" }}>
                      {r.projects.join(", ")}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{format(r.earliest_date, "dd/MM/yyyy")}</TableCell>
                    <TableCell className="text-sm">{r.current_stock}</TableCell>
                    <TableCell className="text-sm font-semibold" style={{ color: r.shortfall > 0 ? "#F40009" : "#006039" }}>
                      {r.shortfall}
                    </TableCell>
                    <TableCell className="text-xs" style={{ color: "#666" }}>{r.preferred_vendor}</TableCell>
                    <TableCell className="text-xs" style={{ color: "#666" }}>{r.lead_time_days}d</TableCell>
                    <TableCell
                      className="text-xs font-semibold whitespace-nowrap"
                      style={{ color: orderByColor, backgroundColor: orderByBg }}
                    >
                      {format(r.order_by_date, "dd/MM/yyyy")}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
