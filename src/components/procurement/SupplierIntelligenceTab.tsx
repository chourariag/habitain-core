import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Star, Search, TrendingUp, TrendingDown } from "lucide-react";
import { format, differenceInDays, parseISO } from "date-fns";

interface VendorStats {
  vendor_name: string;
  total_pos: number;
  avg_promised_days: number;
  avg_actual_days: number;
  avg_delay_days: number;
  on_time_pct: number;
  reliability_rating: string;
  last_delivery_date: string | null;
}

const RATING_CONFIG: Record<string, { stars: number; label: string; color: string; bg: string }> = {
  Excellent: { stars: 5, label: "Excellent", color: "#006039", bg: "#E8F2ED" },
  Good: { stars: 4, label: "Good", color: "#006039", bg: "#E8F2ED" },
  Fair: { stars: 3, label: "Fair", color: "#D4860A", bg: "#FFF8E8" },
  Poor: { stars: 2, label: "Poor", color: "#F40009", bg: "#FFF0F0" },
  Unreliable: { stars: 1, label: "Unreliable", color: "#F40009", bg: "#FFF0F0" },
};

function getRating(onTimePct: number): string {
  if (onTimePct >= 90) return "Excellent";
  if (onTimePct >= 80) return "Good";
  if (onTimePct >= 70) return "Fair";
  if (onTimePct >= 60) return "Poor";
  return "Unreliable";
}

function RatingBadge({ rating }: { rating: string }) {
  const cfg = RATING_CONFIG[rating] ?? RATING_CONFIG.Fair;
  return (
    <div className="flex items-center gap-1.5">
      <Badge style={{ backgroundColor: cfg.bg, color: cfg.color, border: "none" }} className="text-xs">
        {Array.from({ length: cfg.stars }).map((_, i) => (
          <Star key={i} className="h-3 w-3 inline fill-current" />
        ))}
      </Badge>
      <span className="text-xs font-medium" style={{ color: cfg.color }}>{cfg.label}</span>
    </div>
  );
}

// Pre-configured lead time categories
const CATEGORY_BENCHMARKS: Record<string, { promised: string; note: string }> = {
  Steel: { promised: "5-7 days", note: "Typically delays" },
  "Boards/Insulation": { promised: "1-2 days", note: "Reliable" },
  Electrical: { promised: "2-3 days", note: "Good" },
  "Windows/Doors/WPC/ACP": { promised: "5-7 days", note: "Moderate" },
};

export function SupplierIntelligenceTab() {
  const [loading, setLoading] = useState(true);
  const [vendors, setVendors] = useState<VendorStats[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    // Compute vendor stats from purchase_orders
    const { data: pos } = await supabase
      .from("purchase_orders")
      .select("vendor_name, po_date, delivery_date, expected_delivery_date, actual_delivery_date")
      .eq("is_archived", false)
      .not("vendor_name", "is", null);

    if (!pos || pos.length === 0) {
      setVendors([]);
      setLoading(false);
      return;
    }

    // Group by vendor
    const vendorMap = new Map<string, { total: number; onTime: number; promisedDays: number[]; actualDays: number[]; delays: number[]; lastDelivery: string | null }>();

    for (const po of pos) {
      const vn = (po as any).vendor_name as string;
      if (!vn) continue;

      if (!vendorMap.has(vn)) {
        vendorMap.set(vn, { total: 0, onTime: 0, promisedDays: [], actualDays: [], delays: [], lastDelivery: null });
      }
      const v = vendorMap.get(vn)!;
      v.total++;

      const poDate = (po as any).po_date as string | null;
      const expectedDate = (po as any).expected_delivery_date as string | null;
      const actualDate = (po as any).actual_delivery_date as string | null;

      if (poDate && expectedDate) {
        const promised = differenceInDays(parseISO(expectedDate), parseISO(poDate));
        if (promised > 0) v.promisedDays.push(promised);
      }

      if (poDate && actualDate) {
        const actual = differenceInDays(parseISO(actualDate), parseISO(poDate));
        if (actual > 0) v.actualDays.push(actual);

        if (!v.lastDelivery || actualDate > v.lastDelivery) v.lastDelivery = actualDate;

        if (expectedDate) {
          const variance = differenceInDays(parseISO(actualDate), parseISO(expectedDate));
          v.delays.push(variance);
          if (variance <= 0) v.onTime++;
        }
      }
    }

    const result: VendorStats[] = [];
    vendorMap.forEach((v, name) => {
      const avgPromised = v.promisedDays.length ? v.promisedDays.reduce((a, b) => a + b, 0) / v.promisedDays.length : 0;
      const avgActual = v.actualDays.length ? v.actualDays.reduce((a, b) => a + b, 0) / v.actualDays.length : 0;
      const avgDelay = v.delays.length ? v.delays.reduce((a, b) => a + b, 0) / v.delays.length : 0;
      const onTimePct = v.delays.length ? (v.onTime / v.delays.length) * 100 : 0;

      result.push({
        vendor_name: name,
        total_pos: v.total,
        avg_promised_days: Math.round(avgPromised * 10) / 10,
        avg_actual_days: Math.round(avgActual * 10) / 10,
        avg_delay_days: Math.round(avgDelay * 10) / 10,
        on_time_pct: Math.round(onTimePct),
        reliability_rating: v.delays.length > 0 ? getRating(onTimePct) : "Fair",
        last_delivery_date: v.lastDelivery,
      });
    });

    result.sort((a, b) => b.total_pos - a.total_pos);
    setVendors(result);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    if (!search) return vendors;
    const q = search.toLowerCase();
    return vendors.filter((v) => v.vendor_name.toLowerCase().includes(q));
  }, [vendors, search]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" style={{ color: "#666" }} /></div>;

  return (
    <div className="space-y-6">
      {/* Category benchmarks */}
      <Card style={{ backgroundColor: "#F7F7F7" }}>
        <CardContent className="p-4">
          <h3 className="font-display text-sm font-bold mb-3" style={{ color: "#1A1A1A" }}>Lead Time Benchmarks by Category</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(CATEGORY_BENCHMARKS).map(([cat, info]) => (
              <div key={cat} className="rounded-md p-3" style={{ backgroundColor: "#fff", border: "1px solid #E0E0E0" }}>
                <p className="text-xs font-bold font-display" style={{ color: "#1A1A1A" }}>{cat}</p>
                <p className="text-xs mt-1" style={{ color: "#666" }}>Promised: {info.promised}</p>
                <p className="text-[10px] mt-0.5" style={{ color: "#999" }}>{info.note}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "#999" }} />
          <Input placeholder="Search vendor..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 text-sm" />
        </div>
        <p className="text-xs" style={{ color: "#666" }}>{filtered.length} vendor{filtered.length !== 1 ? "s" : ""}</p>
      </div>

      {/* Vendor table */}
      {filtered.length === 0 ? (
        <Card><CardContent className="p-8 text-center">
          <TrendingUp className="h-8 w-8 mx-auto mb-2" style={{ color: "#999" }} />
          <p className="text-sm" style={{ color: "#666" }}>No vendor data available yet. Lead time tracking begins when POs include expected delivery dates and GRNs are recorded.</p>
        </CardContent></Card>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow style={{ backgroundColor: "#F7F7F7" }}>
                <TableHead className="font-display text-xs">Vendor Name</TableHead>
                <TableHead className="font-display text-xs text-center">Total POs</TableHead>
                <TableHead className="font-display text-xs text-center">Avg Promised (days)</TableHead>
                <TableHead className="font-display text-xs text-center">Avg Actual (days)</TableHead>
                <TableHead className="font-display text-xs text-center">Avg Delay (days)</TableHead>
                <TableHead className="font-display text-xs text-center">On-Time %</TableHead>
                <TableHead className="font-display text-xs">Rating</TableHead>
                <TableHead className="font-display text-xs">Last Delivery</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((v) => (
                <TableRow key={v.vendor_name}>
                  <TableCell className="font-medium text-sm">{v.vendor_name}</TableCell>
                  <TableCell className="text-center text-sm">{v.total_pos}</TableCell>
                  <TableCell className="text-center text-sm">{v.avg_promised_days || "—"}</TableCell>
                  <TableCell className="text-center text-sm">{v.avg_actual_days || "—"}</TableCell>
                  <TableCell className="text-center text-sm">
                    <span className="flex items-center justify-center gap-1">
                      {v.avg_delay_days > 0 ? (
                        <><TrendingDown className="h-3 w-3" style={{ color: "#F40009" }} /><span style={{ color: "#F40009" }}>+{v.avg_delay_days}</span></>
                      ) : v.avg_delay_days < 0 ? (
                        <><TrendingUp className="h-3 w-3" style={{ color: "#006039" }} /><span style={{ color: "#006039" }}>{v.avg_delay_days}</span></>
                      ) : "—"}
                    </span>
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    <span style={{ color: v.on_time_pct >= 80 ? "#006039" : v.on_time_pct >= 60 ? "#D4860A" : "#F40009", fontWeight: 600 }}>
                      {v.on_time_pct > 0 ? `${v.on_time_pct}%` : "—"}
                    </span>
                  </TableCell>
                  <TableCell><RatingBadge rating={v.reliability_rating} /></TableCell>
                  <TableCell className="text-xs" style={{ color: "#666" }}>
                    {v.last_delivery_date ? format(parseISO(v.last_delivery_date), "dd/MM/yyyy") : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
