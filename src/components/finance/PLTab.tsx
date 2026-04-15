import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Download } from "lucide-react";
import { toast } from "sonner";
import { downloadXlsxTemplate, TEMPLATES } from "@/lib/xlsx-templates";
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";

interface PLRow {
  month: number; year: number; revenue: number; materials: number; labour: number;
  logistics: number; other_cogs: number; office_admin: number; marketing: number;
  rm_costs: number; depreciation: number; other_opex: number;
}

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function PLTab() {
  const [data, setData] = useState<PLRow[]>([]);
  const [quarterly, setQuarterly] = useState(false);

  useEffect(() => {
    supabase.from("finance_pl_data").select("*").order("year", { ascending: false }).order("month", { ascending: false }).limit(24)
      .then(({ data: d }) => setData((d as PLRow[]) || []));
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer());
      const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      const { data: { user } } = await supabase.auth.getUser();
      for (const r of rows) {
        await supabase.from("finance_pl_data").upsert({
          month: Number(r.Month), year: Number(r.Year),
          revenue: Number(r.Revenue) || 0, materials: Number(r.Materials) || 0,
          labour: Number(r.Labour) || 0, logistics: Number(r.Logistics) || 0,
          other_cogs: Number(r.Other_COGS) || 0, office_admin: Number(r.Office_Admin) || 0,
          marketing: Number(r.Marketing) || 0, rm_costs: Number(r.RM_Costs) || 0,
          depreciation: Number(r.Depreciation) || 0, other_opex: Number(r.Other_Opex) || 0,
          uploaded_by: user?.id,
        }, { onConflict: "month,year" });
      }
      toast.success("P&L data uploaded");
      const { data: d } = await supabase.from("finance_pl_data").select("*").order("year", { ascending: false }).order("month", { ascending: false }).limit(24);
      setData((d as PLRow[]) || []);
    } catch (err: any) { toast.error(err.message || "Upload failed"); }
    e.target.value = "";
  };

  const downloadTemplate = () => {
    const t = TEMPLATES.plUpload;
    downloadXlsxTemplate(t.filename, t.sheet, t.headers, t.sample);
  };

  const last6 = data.slice(0, 6).reverse();

  const chartData = last6.map(d => {
    const cogs = (d.materials || 0) + (d.labour || 0) + (d.logistics || 0) + (d.other_cogs || 0);
    const gm = d.revenue ? ((d.revenue - cogs) / d.revenue * 100) : 0;
    return {
      month: MONTH_NAMES[d.month - 1],
      Revenue: d.revenue || 0,
      COGS: cogs,
      "Gross Margin %": Number(gm.toFixed(1)),
    };
  });

  const fmtLakh = (v: number) => `₹${(v / 100000).toFixed(0)}L`;

  const plRows = [
    { label: "Revenue", key: "revenue", bold: false },
    { label: "— Materials", key: "materials" },
    { label: "— Labour Contract", key: "labour" },
    { label: "— Logistics", key: "logistics" },
    { label: "— Other COGS", key: "other_cogs" },
    { label: "Gross Profit", calc: (d: PLRow) => d.revenue - d.materials - d.labour - d.logistics - d.other_cogs, bold: true },
    { label: "Gross Margin %", calc: (d: PLRow) => d.revenue ? ((d.revenue - d.materials - d.labour - d.logistics - d.other_cogs) / d.revenue * 100) : 0, pct: true },
    { label: "— Office & Admin", key: "office_admin" },
    { label: "— Marketing", key: "marketing" },
    { label: "— R&M Costs", key: "rm_costs" },
    { label: "— Depreciation", key: "depreciation" },
    { label: "— Other Opex", key: "other_opex" },
    { label: "Salaries", note: "Managed externally" },
    { label: "EBITDA", calc: (d: PLRow) => d.revenue - d.materials - d.labour - d.logistics - d.other_cogs - d.office_admin - d.marketing - d.rm_costs - d.depreciation - d.other_opex, bold: true },
    { label: "EBITDA %", calc: (d: PLRow) => d.revenue ? ((d.revenue - d.materials - d.labour - d.logistics - d.other_cogs - d.office_admin - d.marketing - d.rm_costs - d.depreciation - d.other_opex) / d.revenue * 100) : 0, pct: true },
  ];

  return (
    <div className="space-y-4 mt-2">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2">
          <label>
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleUpload} />
            <Button variant="default" asChild style={{ backgroundColor: "#006039" }}>
              <span className="cursor-pointer flex items-center gap-2"><Upload className="h-4 w-4" /> Upload P&L Data</span>
            </Button>
          </label>
          <Button variant="outline" onClick={downloadTemplate}><Download className="h-4 w-4 mr-2" /> Download Template</Button>
        </div>
        <div className="flex gap-1 text-xs">
          <button className={`px-3 py-1 rounded ${!quarterly ? "font-bold" : ""}`} style={{ backgroundColor: !quarterly ? "#E8F2ED" : "transparent", color: "#006039" }} onClick={() => setQuarterly(false)}>Monthly</button>
          <button className={`px-3 py-1 rounded ${quarterly ? "font-bold" : ""}`} style={{ backgroundColor: quarterly ? "#E8F2ED" : "transparent", color: "#006039" }} onClick={() => setQuarterly(true)}>Quarterly</button>
        </div>
      </div>

      <div className="flex items-center gap-2 px-1">
        <Button variant="ghost" size="sm" disabled className="text-xs" style={{ color: "#999" }}>
          Sync with Tally
        </Button>
        <span className="text-xs" style={{ color: "#999" }}>Tally integration coming in Phase 5</span>
      </div>

      {last6.length > 0 ? (<>
        <Card>
          <CardContent className="pt-4">
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#666" }} />
                <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "#666" }} tickFormatter={fmtLakh} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "#666" }} unit="%" domain={[0, 100]} />
                <Tooltip
                  formatter={(value: number, name: string) =>
                    name === "Gross Margin %" ? `${value}%` : `₹${value.toLocaleString("en-IN")}`
                  }
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="left" dataKey="Revenue" fill="#006039" radius={[3, 3, 0, 0]} />
                <Bar yAxisId="left" dataKey="COGS" fill="#D4860A" radius={[3, 3, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="Gross Margin %" stroke="#F40009" strokeWidth={2} dot={{ r: 4, fill: "#F40009" }} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-display text-xs" style={{ color: "#666" }}>Line Item</th>
                  {last6.map(d => (
                    <th key={`${d.month}-${d.year}`} className="text-right py-2 font-display text-xs min-w-[80px]" style={{ color: "#666" }}>
                      {MONTH_NAMES[d.month - 1]} {d.year}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {plRows.map((row, i) => (
                  <tr key={i} className="border-b" style={{ fontWeight: row.bold ? 700 : 400 }}>
                    <td className="py-1.5 font-display text-xs" style={{ color: "#1A1A1A" }}>{row.label}</td>
                    {last6.map(d => {
                      if (row.note) return <td key={`${d.month}-${d.year}`} className="text-right py-1.5 text-xs" style={{ color: "#999" }}>{row.note}</td>;
                      const val = row.calc ? row.calc(d) : (d as any)[row.key!] || 0;
                      return (
                        <td key={`${d.month}-${d.year}`} className="text-right py-1.5 font-mono text-xs" style={{ color: row.bold && val < 0 ? "#F40009" : "#1A1A1A" }}>
                          {row.pct ? `${val.toFixed(1)}%` : `₹${Math.abs(val).toLocaleString("en-IN")}`}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </>) : (
        <Card className="py-12"><CardContent className="text-center"><p className="text-sm" style={{ color: "#666" }}>Upload P&L data to view monthly summary</p></CardContent></Card>
      )}
    </div>
  );
}
