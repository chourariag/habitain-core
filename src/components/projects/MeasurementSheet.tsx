import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";

const PROCESSES = [
  "Sub-Frame Fabrication", "Wall Framing", "Floor Decking", "Roof Decking",
  "Concrete Pouring", "Internal Wall Panelling", "Insulation", "External Cladding",
  "Ceiling", "Flooring", "Painting", "Waterproofing", "Openings",
  "MEP Electrical", "MEP Plumbing", "Site Erection", "Marriage Line", "Finishing Works",
];

// Map BOQ categories to process names (case-insensitive partial match)
const CATEGORY_MAP: Record<string, string[]> = {
  "Sub-Frame Fabrication": ["sub-frame", "sub frame", "fabrication"],
  "Wall Framing": ["wall framing", "wall frame"],
  "Floor Decking": ["floor deck", "floor decking"],
  "Roof Decking": ["roof deck", "roof decking"],
  "Concrete Pouring": ["concrete", "rcc"],
  "Internal Wall Panelling": ["internal wall", "wall panel"],
  "Insulation": ["insulation"],
  "External Cladding": ["cladding", "external clad"],
  "Ceiling": ["ceiling"],
  "Flooring": ["flooring", "floor finish"],
  "Painting": ["painting", "paint"],
  "Waterproofing": ["waterproof"],
  "Openings": ["opening", "door", "window"],
  "MEP Electrical": ["electrical", "elec", "wiring"],
  "MEP Plumbing": ["plumbing", "plumb", "sanitary"],
  "Site Erection": ["erection", "site erect"],
  "Marriage Line": ["marriage", "stitching"],
  "Finishing Works": ["finishing", "finish work"],
};

function matchCategory(boqCategory: string): string | null {
  const lower = boqCategory.toLowerCase();
  for (const [process, keywords] of Object.entries(CATEGORY_MAP)) {
    if (keywords.some((k) => lower.includes(k))) return process;
  }
  return null;
}

interface Props {
  projectId: string;
}

interface ProcessRow {
  process: string;
  materialBOQ: number;
  materialActual: number;
  labourBOQ: number;
  labourActualHours: number;
  labourActualCost: number;
  totalBudget: number;
  totalActual: number;
}

export function MeasurementSheet({ projectId }: Props) {
  const [loading, setLoading] = useState(true);
  const [boqItems, setBoqItems] = useState<any[]>([]);
  const [grnData, setGrnData] = useState<any[]>([]);
  const [labourData, setLabourData] = useState<any[]>([]);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);

      // Fetch BOQ items for this project
      const { data: boqs } = await supabase
        .from("project_boq")
        .select("id")
        .eq("project_id", projectId)
        .order("version_number", { ascending: false })
        .limit(1);

      let items: any[] = [];
      if (boqs && boqs.length > 0) {
        const { data } = await supabase
          .from("project_boq_items")
          .select("*")
          .eq("boq_id", boqs[0].id);
        items = data ?? [];
      }
      setBoqItems(items);

      // Fetch GRN data (goods_receipt_notes) for this project
      const { data: grn } = await supabase
        .from("goods_receipt_notes" as any)
        .select("*")
        .eq("project_id", projectId);
      setGrnData(grn ?? []);

      // Fetch labour daily actuals for this project
      const { data: labour } = await supabase
        .from("daily_actuals")
        .select("*")
        .eq("project_id", projectId);
      setLabourData(labour ?? []);

      setLoading(false);
    };
    fetch();
  }, [projectId]);

  const rows = useMemo((): ProcessRow[] => {
    return PROCESSES.map((process) => {
      // Material BOQ: sum of total_amount for matching BOQ category
      const matchingBOQ = boqItems.filter((item) => matchCategory(item.category ?? "") === process);
      const materialBOQ = matchingBOQ.reduce((s, i) => s + (Number(i.material_rate ?? 0) * Number(i.boq_qty ?? 0)), 0);
      const labourBOQ = matchingBOQ.reduce((s, i) => s + (Number(i.labour_rate ?? 0) * Number(i.boq_qty ?? 0)), 0);

      // Material Actual from GRN
      const matchingGRN = grnData.filter((g: any) => matchCategory(g.material_name ?? g.category ?? "") === process);
      const materialActual = matchingGRN.reduce((s: number, g: any) => s + (Number(g.total_amount ?? 0) || Number(g.amount ?? 0) || 0), 0);

      // Labour Actual from daily_actuals
      const matchingLabour = labourData.filter((l: any) => {
        const task = l.stage_task ?? l.skill_type ?? "";
        return matchCategory(task) === process;
      });
      const labourActualHours = matchingLabour.reduce((s: number, l: any) => s + (Number(l.hours_worked ?? 0)), 0);
      const labourActualCost = labourActualHours * 350; // Default rate, would come from HR settings

      return {
        process,
        materialBOQ,
        materialActual,
        labourBOQ,
        labourActualHours,
        labourActualCost,
        totalBudget: materialBOQ + labourBOQ,
        totalActual: materialActual + labourActualCost,
      };
    });
  }, [boqItems, grnData, labourData]);

  const fmt = (n: number) => n === 0 ? "-" : `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

  const varianceColor = (budget: number, actual: number): string => {
    if (budget === 0 && actual === 0) return "";
    const variance = budget > 0 ? ((actual - budget) / budget) * 100 : 0;
    if (variance > 0) return "text-[#F40009] font-medium"; // over budget
    if (variance >= -10) return "text-[#006039] font-medium"; // within 10% under
    return "text-amber-600 font-medium"; // significantly under
  };

  const variancePct = (budget: number, actual: number): string => {
    if (budget === 0) return "-";
    const pct = ((actual - budget) / budget) * 100;
    return `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  const totals = rows.reduce(
    (acc, r) => ({
      materialBOQ: acc.materialBOQ + r.materialBOQ,
      materialActual: acc.materialActual + r.materialActual,
      labourBOQ: acc.labourBOQ + r.labourBOQ,
      labourActualCost: acc.labourActualCost + r.labourActualCost,
      totalBudget: acc.totalBudget + r.totalBudget,
      totalActual: acc.totalActual + r.totalActual,
    }),
    { materialBOQ: 0, materialActual: 0, labourBOQ: 0, labourActualCost: 0, totalBudget: 0, totalActual: 0 }
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Measurement Sheet — BOQ vs Actual Cost by Process</h3>
      </div>

      {boqItems.length === 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="py-3 px-4 text-sm text-amber-700">
            No BOQ uploaded for this project. Upload a BOQ in the Design Portal to see budget comparisons.
          </CardContent>
        </Card>
      )}

      <div className="overflow-x-auto border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead rowSpan={2} className="border-r align-bottom">Process</TableHead>
              <TableHead colSpan={3} className="text-center border-r border-b">Material</TableHead>
              <TableHead colSpan={3} className="text-center border-r border-b">Labour</TableHead>
              <TableHead colSpan={4} className="text-center border-b">Total</TableHead>
            </TableRow>
            <TableRow className="bg-muted/30">
              <TableHead className="text-xs">BOQ</TableHead>
              <TableHead className="text-xs">Actual</TableHead>
              <TableHead className="text-xs border-r">Var ₹</TableHead>
              <TableHead className="text-xs">BOQ</TableHead>
              <TableHead className="text-xs">Hours</TableHead>
              <TableHead className="text-xs border-r">Actual ₹</TableHead>
              <TableHead className="text-xs">Budget</TableHead>
              <TableHead className="text-xs">Actual</TableHead>
              <TableHead className="text-xs">Var ₹</TableHead>
              <TableHead className="text-xs">Var %</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const matVar = r.materialActual - r.materialBOQ;
              const labVar = r.labourActualCost - r.labourBOQ;
              const totalVar = r.totalActual - r.totalBudget;
              return (
                <TableRow key={r.process}>
                  <TableCell className="text-xs font-medium border-r">{r.process}</TableCell>
                  <TableCell className="text-xs text-right">{fmt(r.materialBOQ)}</TableCell>
                  <TableCell className="text-xs text-right">{fmt(r.materialActual)}</TableCell>
                  <TableCell className={`text-xs text-right border-r ${varianceColor(r.materialBOQ, r.materialActual)}`}>{matVar !== 0 ? fmt(matVar) : "-"}</TableCell>
                  <TableCell className="text-xs text-right">{fmt(r.labourBOQ)}</TableCell>
                  <TableCell className="text-xs text-right">{r.labourActualHours > 0 ? r.labourActualHours.toFixed(1) : "-"}</TableCell>
                  <TableCell className={`text-xs text-right border-r ${varianceColor(r.labourBOQ, r.labourActualCost)}`}>{fmt(r.labourActualCost)}</TableCell>
                  <TableCell className="text-xs text-right">{fmt(r.totalBudget)}</TableCell>
                  <TableCell className="text-xs text-right">{fmt(r.totalActual)}</TableCell>
                  <TableCell className={`text-xs text-right ${varianceColor(r.totalBudget, r.totalActual)}`}>{totalVar !== 0 ? fmt(totalVar) : "-"}</TableCell>
                  <TableCell className={`text-xs text-right ${varianceColor(r.totalBudget, r.totalActual)}`}>{variancePct(r.totalBudget, r.totalActual)}</TableCell>
                </TableRow>
              );
            })}
            {/* Totals row */}
            <TableRow className="bg-muted/50 font-semibold">
              <TableCell className="text-xs border-r">TOTAL</TableCell>
              <TableCell className="text-xs text-right">{fmt(totals.materialBOQ)}</TableCell>
              <TableCell className="text-xs text-right">{fmt(totals.materialActual)}</TableCell>
              <TableCell className={`text-xs text-right border-r ${varianceColor(totals.materialBOQ, totals.materialActual)}`}>{fmt(totals.materialActual - totals.materialBOQ)}</TableCell>
              <TableCell className="text-xs text-right">{fmt(totals.labourBOQ)}</TableCell>
              <TableCell className="text-xs text-right">-</TableCell>
              <TableCell className={`text-xs text-right border-r ${varianceColor(totals.labourBOQ, totals.labourActualCost)}`}>{fmt(totals.labourActualCost)}</TableCell>
              <TableCell className="text-xs text-right">{fmt(totals.totalBudget)}</TableCell>
              <TableCell className="text-xs text-right">{fmt(totals.totalActual)}</TableCell>
              <TableCell className={`text-xs text-right ${varianceColor(totals.totalBudget, totals.totalActual)}`}>{fmt(totals.totalActual - totals.totalBudget)}</TableCell>
              <TableCell className={`text-xs text-right ${varianceColor(totals.totalBudget, totals.totalActual)}`}>{variancePct(totals.totalBudget, totals.totalActual)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <div className="flex gap-4 text-[10px] text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#F40009]/20 border border-[#F40009]/40" /> Over Budget</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#006039]/20 border border-[#006039]/40" /> Within 10% Under</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-100 border border-amber-300" /> Under by &gt;10% (review)</span>
      </div>
    </div>
  );
}
