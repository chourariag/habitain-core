import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Download, ChevronDown, ChevronRight, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const MIS_CATEGORIES = {
  revenue: "Sales Revenue",
  other_income: "Other Income",
  unbilled_revenue: "Unbilled Revenue",
  raw_materials: "Raw Materials",
  manufacturing: "Manufacturing Expenses",
  rent_electricity: "Rent + Electricity",
  salaries: "Salaries",
  director_remuneration: "Director Remuneration",
  other_fixed: "Other Fixed Expenses",
  depreciation: "Depreciation",
  interest: "Interest",
  tax: "Tax",
} as const;

type MISCategory = keyof typeof MIS_CATEGORIES;

interface LedgerEntry {
  ledger_name: string;
  debit: number;
  credit: number;
}

interface MISUpload {
  id: string;
  period_label: string;
  raw_data: LedgerEntry[];
  ads_split: Record<string, number>;
}

function sumByCategory(entries: LedgerEntry[], mappings: Record<string, string>, category: string): number {
  return entries
    .filter(e => mappings[e.ledger_name] === category)
    .reduce((sum, e) => sum + (e.credit - e.debit), 0);
}

function sumDebitByCategory(entries: LedgerEntry[], mappings: Record<string, string>, category: string): number {
  return entries
    .filter(e => mappings[e.ledger_name] === category)
    .reduce((sum, e) => sum + (e.debit - e.credit), 0);
}

function MISRow({ label, amount, pct, bold, large, color }: {
  label: string; amount: number; pct?: number; bold?: boolean; large?: boolean; color?: string;
}) {
  const style: React.CSSProperties = {
    color: color || "#1A1A1A",
    fontWeight: bold ? 700 : 400,
    fontSize: large ? 18 : 14,
  };
  return (
    <div className="flex justify-between items-center py-1.5 px-2" style={style}>
      <span className="font-display">{label}</span>
      <div className="flex gap-6 items-center">
        <span className="font-mono text-right min-w-[100px]">₹{Math.abs(amount).toLocaleString("en-IN")}</span>
        {pct !== undefined && (
          <span className="text-right min-w-[50px] text-xs" style={{ color: "#666666" }}>{pct.toFixed(1)}%</span>
        )}
      </div>
    </div>
  );
}

function Divider() {
  return <div className="border-t my-1" style={{ borderColor: "#E5E7EB" }} />;
}

function DoubleDivider() {
  return <div className="border-t-2 my-2" style={{ borderColor: "#006039" }} />;
}

export function MISTab() {
  const [uploads, setUploads] = useState<MISUpload[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [currentUpload, setCurrentUpload] = useState<MISUpload | null>(null);
  const [periodLabel, setPeriodLabel] = useState("");
  const [adsDrawerOpen, setAdsDrawerOpen] = useState(false);
  const [adsValues, setAdsValues] = useState<Record<string, number>>({});
  const [unmappedLedgers, setUnmappedLedgers] = useState<string[]>([]);
  const [mappingDrawerOpen, setMappingDrawerOpen] = useState(false);
  const [newMappings, setNewMappings] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    const [{ data: u }, { data: m }] = await Promise.all([
      supabase.from("finance_mis_uploads").select("*").order("created_at", { ascending: false }).limit(10),
      supabase.from("ledger_mappings").select("*"),
    ]);
    const mappingMap: Record<string, string> = {};
    (m || []).forEach((row: any) => { mappingMap[row.ledger_name] = row.mis_category; });
    setMappings(mappingMap);
    const parsed = (u || []).map((row: any) => ({
      id: row.id,
      period_label: row.period_label,
      raw_data: Array.isArray(row.raw_data) ? row.raw_data : [],
      ads_split: typeof row.ads_split === "object" && row.ads_split ? row.ads_split : {},
    }));
    setUploads(parsed);
    if (parsed.length > 0 && !currentUpload) setCurrentUpload(parsed[0]);
  }, [currentUpload]);

  useEffect(() => { fetchData(); }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!periodLabel.trim()) { toast.error("Enter a period label first"); return; }

    try {
      const XLSX = await import("xlsx");
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { header: 1 });

      const entries: LedgerEntry[] = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row[0]) continue;
        entries.push({
          ledger_name: String(row[0]).trim(),
          debit: Number(row[1]) || 0,
          credit: Number(row[2]) || 0,
        });
      }

      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("finance_mis_uploads").insert({
        period_label: periodLabel.trim(),
        uploaded_by: user?.id,
        raw_data: entries as any,
      });
      if (error) throw error;

      // Check for unmapped ledgers
      const unmapped = entries
        .map(e => e.ledger_name)
        .filter(name => !mappings[name]);
      if (unmapped.length > 0) {
        setUnmappedLedgers([...new Set(unmapped)]);
        setNewMappings({});
        setMappingDrawerOpen(true);
      }

      toast.success("Trial Balance uploaded successfully");
      setPeriodLabel("");
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    }
    e.target.value = "";
  };

  const saveMappings = async () => {
    const entries = Object.entries(newMappings).filter(([, v]) => v);
    if (entries.length === 0) { setMappingDrawerOpen(false); return; }

    for (const [ledger_name, mis_category] of entries) {
      await supabase.from("ledger_mappings").upsert({ ledger_name, mis_category }, { onConflict: "ledger_name" });
    }
    toast.success("Ledger mappings saved");
    setMappingDrawerOpen(false);
    await fetchData();
  };

  const saveAdsSplit = async () => {
    if (!currentUpload) return;
    await supabase.from("finance_mis_uploads")
      .update({ ads_split: adsValues as any })
      .eq("id", currentUpload.id);
    toast.success("ADS split saved");
    setAdsDrawerOpen(false);
    await fetchData();
  };

  const downloadTemplate = () => {
    const csv = "Ledger Name,Debit Amount,Credit Amount\nSales - Domestic,0,500000\nRaw Material Purchased,300000,0\nFactory Rent,50000,0\nSalaries & Wages,100000,0";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "TB_Template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const entries = currentUpload?.raw_data || [];
  const totalIncome = sumByCategory(entries, mappings, "revenue") + sumByCategory(entries, mappings, "other_income") + sumByCategory(entries, mappings, "unbilled_revenue");
  const pct = (v: number) => totalIncome ? (v / totalIncome) * 100 : 0;

  const salesRevenue = sumByCategory(entries, mappings, "revenue");
  const otherIncome = sumByCategory(entries, mappings, "other_income");
  const unbilledRevenue = sumByCategory(entries, mappings, "unbilled_revenue");
  const rawMaterials = sumDebitByCategory(entries, mappings, "raw_materials");
  const manufacturing = sumDebitByCategory(entries, mappings, "manufacturing");
  const totalVariable = rawMaterials + manufacturing;
  const contribution = totalIncome - totalVariable;
  const rentElec = sumDebitByCategory(entries, mappings, "rent_electricity");
  const salaries = sumDebitByCategory(entries, mappings, "salaries");
  const dirRem = sumDebitByCategory(entries, mappings, "director_remuneration");
  const otherFixed = sumDebitByCategory(entries, mappings, "other_fixed");
  const totalFixed = rentElec + salaries + dirRem + otherFixed;
  const ebitda = contribution - totalFixed;
  const depreciation = sumDebitByCategory(entries, mappings, "depreciation");
  const interest = sumDebitByCategory(entries, mappings, "interest");
  const pbt = ebitda - depreciation - interest;
  const tax = sumDebitByCategory(entries, mappings, "tax");
  const pat = pbt - tax;

  const adsVal = (key: string) => (currentUpload?.ads_split as Record<string, number>)?.[key] || 0;

  return (
    <div className="space-y-4 mt-2">
      {/* Upload Controls */}
      <Card style={{ backgroundColor: "#F7F7F7" }}>
        <CardContent className="pt-4 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs" style={{ color: "#666666" }}>Period Label</Label>
              <Input
                placeholder="e.g. Q3 FY 2025-26"
                value={periodLabel}
                onChange={e => setPeriodLabel(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <label>
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
                <Button variant="default" asChild style={{ backgroundColor: "#006039" }}>
                  <span className="cursor-pointer flex items-center gap-2"><Upload className="h-4 w-4" /> Upload Trial Balance</span>
                </Button>
              </label>
              <Button variant="outline" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-2" /> Download TB Template
              </Button>
            </div>
          </div>
          {uploads.length > 1 && (
            <div className="flex items-center gap-2">
              <Label className="text-xs" style={{ color: "#666666" }}>Period:</Label>
              <select
                className="text-sm border rounded px-2 py-1"
                value={currentUpload?.id || ""}
                onChange={e => setCurrentUpload(uploads.find(u => u.id === e.target.value) || null)}
              >
                {uploads.map(u => <option key={u.id} value={u.id}>{u.period_label}</option>)}
              </select>
            </div>
          )}
        </CardContent>
      </Card>

      {currentUpload && entries.length > 0 && (
        <>
          {/* Section A: Contribution Analysis */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-display" style={{ color: "#1A1A1A" }}>
                Contribution Analysis — {currentUpload.period_label}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              <div className="text-xs font-semibold uppercase tracking-wider py-2 px-2" style={{ color: "#006039" }}>Income</div>
              <MISRow label="Sales Revenue" amount={salesRevenue} pct={pct(salesRevenue)} />
              <MISRow label="Other Income" amount={otherIncome} pct={pct(otherIncome)} />
              <MISRow label="Unbilled Revenue" amount={unbilledRevenue} pct={pct(unbilledRevenue)} />
              <Divider />
              <MISRow label="Total Income" amount={totalIncome} pct={100} bold />

              <div className="text-xs font-semibold uppercase tracking-wider py-2 px-2 mt-2" style={{ color: "#006039" }}>Variable Costs</div>
              <MISRow label="Raw Materials" amount={rawMaterials} pct={pct(rawMaterials)} />
              <MISRow label="Manufacturing Expenses" amount={manufacturing} pct={pct(manufacturing)} />
              <Divider />
              <MISRow label="Total Variable Cost" amount={totalVariable} pct={pct(totalVariable)} bold />

              <DoubleDivider />
              <MISRow label="CONTRIBUTION" amount={contribution} pct={pct(contribution)} bold large color={contribution >= 0 ? "#006039" : "#F40009"} />
              <div className="flex justify-end px-2 pb-2">
                <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{
                  backgroundColor: contribution >= 0 ? "#E8F2ED" : "#FFF0F0",
                  color: contribution >= 0 ? "#006039" : "#F40009",
                }}>
                  Contribution Margin: {totalIncome ? ((contribution / totalIncome) * 100).toFixed(1) : 0}%
                </span>
              </div>
              <DoubleDivider />

              <div className="text-xs font-semibold uppercase tracking-wider py-2 px-2" style={{ color: "#006039" }}>Fixed Costs</div>
              <MISRow label="Rent + Electricity" amount={rentElec} pct={pct(rentElec)} />
              <MISRow label="Salaries" amount={salaries} pct={pct(salaries)} />
              <MISRow label="Director Remuneration" amount={dirRem} pct={pct(dirRem)} />
              <MISRow label="Other Fixed Expenses" amount={otherFixed} pct={pct(otherFixed)} />
              <Divider />
              <MISRow label="Total Fixed Costs" amount={totalFixed} pct={pct(totalFixed)} bold />

              <DoubleDivider />
              <MISRow label="EBITDA" amount={ebitda} pct={pct(ebitda)} bold large color={ebitda >= 0 ? "#006039" : "#F40009"} />
              <DoubleDivider />

              <MISRow label="Depreciation" amount={depreciation} pct={pct(depreciation)} />
              <MISRow label="Interest" amount={interest} pct={pct(interest)} />
              <Divider />
              <MISRow label="Profit Before Tax" amount={pbt} pct={pct(pbt)} bold />
              <MISRow label="Tax" amount={tax} pct={pct(tax)} />
              <Divider />
              <MISRow label="Profit After Tax" amount={pat} pct={pct(pat)} bold large color={pat >= 0 ? "#006039" : "#F40009"} />
            </CardContent>
          </Card>

          {/* Section B: Division Split */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-display" style={{ color: "#1A1A1A" }}>Division Split</CardTitle>
              <Button variant="outline" size="sm" onClick={() => { setAdsValues(currentUpload.ads_split as Record<string, number> || {}); setAdsDrawerOpen(true); }}>
                <Pencil className="h-3 w-3 mr-1" /> Edit ADS Values
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b" style={{ color: "#666666" }}>
                      <th className="text-left py-2 font-display">Line Item</th>
                      <th className="text-right py-2 font-display">Consolidated (₹)</th>
                      <th className="text-right py-2 font-display">ADS (₹)</th>
                      <th className="text-right py-2 font-display">Habitainer (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono text-xs">
                    {[
                      { label: "Sales Revenue", consolidated: salesRevenue, key: "revenue" },
                      { label: "Raw Materials", consolidated: rawMaterials, key: "raw_materials" },
                      { label: "Manufacturing", consolidated: manufacturing, key: "manufacturing" },
                      { label: "Contribution", consolidated: contribution, key: "contribution" },
                      { label: "Fixed Costs", consolidated: totalFixed, key: "fixed" },
                      { label: "EBITDA", consolidated: ebitda, key: "ebitda" },
                      { label: "PAT", consolidated: pat, key: "pat" },
                    ].map(row => {
                      const ads = adsVal(row.key);
                      const hab = row.consolidated - ads;
                      return (
                        <tr key={row.key} className="border-b">
                          <td className="py-1.5 font-display font-medium" style={{ color: "#1A1A1A" }}>{row.label}</td>
                          <td className="text-right py-1.5">₹{Math.abs(row.consolidated).toLocaleString("en-IN")}</td>
                          <td className="text-right py-1.5">₹{Math.abs(ads).toLocaleString("en-IN")}</td>
                          <td className="text-right py-1.5" style={{ color: hab >= 0 ? "#006039" : "#F40009" }}>
                            ₹{Math.abs(hab).toLocaleString("en-IN")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Section C: Detailed Ledger View */}
          <Collapsible>
            <Card>
              <CollapsibleTrigger className="w-full">
                <CardHeader className="pb-2 flex flex-row items-center gap-2 cursor-pointer">
                  <ChevronRight className="h-4 w-4 transition-transform [[data-state=open]>&]:rotate-90" style={{ color: "#006039" }} />
                  <CardTitle className="text-lg font-display" style={{ color: "#1A1A1A" }}>Detailed Ledger View</CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  {Object.entries(MIS_CATEGORIES).map(([cat, label]) => {
                    const catEntries = entries.filter(e => mappings[e.ledger_name] === cat);
                    if (catEntries.length === 0) return null;
                    return (
                      <Collapsible key={cat}>
                        <CollapsibleTrigger className="w-full flex items-center gap-2 py-2 text-sm font-semibold cursor-pointer" style={{ color: "#006039" }}>
                          <ChevronDown className="h-3 w-3" />
                          {label} ({catEntries.length} ledgers)
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="pl-5 space-y-0.5 pb-2">
                            {catEntries.map((e, i) => (
                              <div key={i} className="flex justify-between text-xs py-0.5" style={{ color: "#1A1A1A" }}>
                                <span>{e.ledger_name}</span>
                                <span className="font-mono">₹{(e.debit || e.credit).toLocaleString("en-IN")}</span>
                              </div>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
                  {entries.filter(e => !mappings[e.ledger_name]).length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-semibold" style={{ color: "#D4860A" }}>
                        Unmapped Ledgers ({entries.filter(e => !mappings[e.ledger_name]).length})
                      </p>
                      <div className="pl-5 space-y-0.5 pt-1">
                        {entries.filter(e => !mappings[e.ledger_name]).map((e, i) => (
                          <div key={i} className="flex justify-between text-xs py-0.5" style={{ color: "#999" }}>
                            <span>{e.ledger_name}</span>
                            <span className="font-mono">₹{(e.debit || e.credit).toLocaleString("en-IN")}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </>
      )}

      {(!currentUpload || entries.length === 0) && (
        <Card className="py-12">
          <CardContent className="text-center">
            <p className="text-sm" style={{ color: "#666666" }}>Upload a Trial Balance to generate MIS analysis</p>
          </CardContent>
        </Card>
      )}

      {/* ADS Split Drawer */}
      <Sheet open={adsDrawerOpen} onOpenChange={setAdsDrawerOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader><SheetTitle className="font-display">Edit ADS Values</SheetTitle></SheetHeader>
          <div className="space-y-3 py-4">
            {["revenue", "raw_materials", "manufacturing", "contribution", "fixed", "ebitda", "pat"].map(key => (
              <div key={key}>
                <Label className="text-xs" style={{ color: "#666666" }}>{key.replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase())}</Label>
                <Input
                  type="number"
                  value={adsValues[key] || ""}
                  onChange={e => setAdsValues(prev => ({ ...prev, [key]: Number(e.target.value) || 0 }))}
                  className="mt-1"
                />
              </div>
            ))}
          </div>
          <SheetFooter>
            <Button onClick={saveAdsSplit} className="w-full" style={{ backgroundColor: "#006039" }}>Save ADS Split</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Ledger Mapping Drawer */}
      <Sheet open={mappingDrawerOpen} onOpenChange={setMappingDrawerOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader><SheetTitle className="font-display">Map Unmapped Ledgers</SheetTitle></SheetHeader>
          <p className="text-xs py-2" style={{ color: "#666666" }}>Assign each ledger to an MIS category. This mapping is saved for future uploads.</p>
          <div className="space-y-3 py-2">
            {unmappedLedgers.map(name => (
              <div key={name}>
                <Label className="text-xs font-medium" style={{ color: "#1A1A1A" }}>{name}</Label>
                <select
                  className="w-full mt-1 text-sm border rounded px-2 py-1.5"
                  value={newMappings[name] || ""}
                  onChange={e => setNewMappings(prev => ({ ...prev, [name]: e.target.value }))}
                >
                  <option value="">— Select Category —</option>
                  {Object.entries(MIS_CATEGORIES).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <SheetFooter>
            <Button onClick={saveMappings} className="w-full" style={{ backgroundColor: "#006039" }}>Save Mappings</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
