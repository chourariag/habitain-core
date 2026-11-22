import { useCallback, useEffect, useRef, useState } from "react";
import * as XLSX from "@/lib/safe-xlsx";
import { ChevronDown, ChevronRight, Download, Loader2, Plus, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { canViewRunningBill } from "@/lib/running-bill";
import { canConfirmCostUpload, costRatesWorkbook, readCostRatesWorkbook, subcontractRateProblem, type CostDryRun, type CostRateItem, type CostRates, type CostSubcontract, type CostUploadRow } from "@/lib/cost-rates";

const money = (n: number | null) => n == null ? "—" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);
const numberOrNull = (v: string) => v.trim() === "" ? null : Number(v);

function MaterialRate({ item, save, disabled }: { item: CostRateItem; save: (rate: number) => Promise<boolean>; disabled: boolean }) {
  const [value, setValue] = useState(String(item.material_rate ?? ""));
  const [error, setError] = useState("");
  useEffect(() => { setValue(String(item.material_rate ?? "")); }, [item.material_rate]);
  const persist = async () => {
    if (value === String(item.material_rate ?? "")) return;
    const rate = numberOrNull(value);
    if (rate == null || !Number.isFinite(rate) || rate < 0) { setError("Enter a rate of 0 or more"); return; }
    setError("");
    if (!await save(rate)) setError("Not saved");
  };
  return <div className="min-w-0"><Input aria-label={`Material rate ${item.sno}`} type="number" min="0" step="any" value={value} disabled={disabled} className="min-h-11" onChange={e => setValue(e.target.value)} onBlur={persist} onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }} />{error && <p role="alert" className="text-destructive text-xs mt-1">{error}</p>}</div>;
}

function SubcontractEditor({ projectId, item, contractors, rate, onSaved }: { projectId: string; item: CostRateItem; contractors: CostRates["contractors"]; rate?: CostSubcontract; onSaved: () => Promise<void> }) {
  const [contractor, setContractor] = useState(rate?.contractor_id ?? "");
  const [type, setType] = useState<"per_unit" | "lump_sum">(rate?.rate_type ?? "per_unit");
  const [price, setPrice] = useState(String(rate?.rate ?? ""));
  const [lump, setLump] = useState(String(rate?.lump_sum ?? ""));
  const [pkg, setPkg] = useState(String(rate?.package_qty ?? (item.unit === "%" ? 100 : "")));
  const [included, setIncluded] = useState(rate?.includes_material ?? false);
  const [active, setActive] = useState(rate?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const labelId = `${item.id}-${rate?.id ?? "new"}`;
  const save = async () => {
    const selected = contractors.find(c => c.id === contractor);
    if (!contractor) { setError("Choose a contractor"); return; }
    const problem = subcontractRateProblem(selected?.name ?? rate?.contractor ?? "", item.unit, type, numberOrNull(price), numberOrNull(lump), numberOrNull(pkg));
    if (problem) { setError(problem); return; }
    setBusy(true); setError("");
    const { error: failure } = await supabase.rpc("upsert_subcontract_rate", { p_project_id: projectId, p_boq_item_id: item.id, p_contractor_id: contractor, p_rate_type: type, p_rate: numberOrNull(price) ?? undefined, p_lump_sum: numberOrNull(lump) ?? undefined, p_package_qty: numberOrNull(pkg) ?? undefined, p_includes_material: included, p_active: active });
    if (failure) setError(failure.message); else await onSaved();
    setBusy(false);
  };
  const deactivate = async () => {
    if (!rate?.id) return;
    setBusy(true);
    const { error: failure } = await supabase.rpc("deactivate_subcontract_rate", { p_project_id: projectId, p_rate_id: rate.id });
    if (failure) setError(failure.message); else { setActive(false); await onSaved(); }
    setBusy(false);
  };
  return <div className="border-t border-border py-4 space-y-3">
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <div className="space-y-1"><Label>Contractor</Label><Select value={contractor} onValueChange={setContractor} disabled={busy || !!rate?.id}><SelectTrigger aria-label="Contractor" className="min-h-11"><SelectValue placeholder="Choose contractor" /></SelectTrigger><SelectContent>{rate && !contractors.some(c => c.id === rate.contractor_id) && <SelectItem value={rate.contractor_id}>{rate.contractor}</SelectItem>}{contractors.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-1"><Label>Rate type</Label><Select value={type} onValueChange={v => setType(v as "per_unit" | "lump_sum")} disabled={busy}><SelectTrigger aria-label="Rate type" className="min-h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="per_unit">Per unit</SelectItem><SelectItem value="lump_sum">Lump sum</SelectItem></SelectContent></Select></div>
      {type === "per_unit" ? <div className="space-y-1"><Label htmlFor={`${labelId}-rate`}>Rate (₹)</Label><Input id={`${labelId}-rate`} value={price} type="number" min="0" step="any" className="min-h-11" onChange={e => setPrice(e.target.value)} disabled={busy} /></div> : <><div className="space-y-1"><Label htmlFor={`${labelId}-lump`}>Lump sum (₹)</Label><Input id={`${labelId}-lump`} value={lump} type="number" min="0" step="any" className="min-h-11" onChange={e => setLump(e.target.value)} disabled={busy} /></div><div className="space-y-1"><Label htmlFor={`${labelId}-package`}>Package quantity</Label><Input id={`${labelId}-package`} value={pkg} type="number" min="0" step="any" className="min-h-11" onChange={e => setPkg(e.target.value)} disabled={busy || item.unit === "%"} /></div></>}
    </div>
    {type === "lump_sum" && Number(pkg) > 0 && <p className="text-sm text-muted-foreground">Implied rate: {money(Number(lump) / Number(pkg))} / {item.unit}</p>}
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      <Label className="min-h-11 flex items-center gap-2 cursor-pointer"><Switch aria-label="Rate includes material" checked={included} onCheckedChange={setIncluded} disabled={busy} />Rate includes material</Label>
      <Label className="min-h-11 flex items-center gap-2 cursor-pointer"><Switch aria-label="Active" checked={active} onCheckedChange={setActive} disabled={busy} />Active</Label>
      <Button className="min-h-11" disabled={busy} onClick={save}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save rate</Button>
      {rate?.active && <Button variant="outline" className="min-h-11" disabled={busy} onClick={deactivate}>Deactivate</Button>}
    </div>
    {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
  </div>;
}

export function ProjectCostRates({ projectId, role }: { projectId: string; role: string | null }) {
  const [data, setData] = useState<CostRates | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [addFor, setAddFor] = useState<string | null>(null);
  const [missingOnly, setMissingOnly] = useState(false);
  const [rows, setRows] = useState<CostUploadRow[]>([]);
  const [dryRun, setDryRun] = useState<CostDryRun | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const allowed = canViewRunningBill(role);
  const request = useRef(0);
  const activeProject = useRef(projectId);
  activeProject.current = projectId;
  const load = useCallback(async () => {
    if (!allowed || activeProject.current !== projectId) return;
    const current = ++request.current;
    const { data: result, error: failure } = await supabase.rpc("get_cost_rates", { p_project_id: projectId });
    if (current !== request.current || activeProject.current !== projectId) return;
    if (failure) { setError(failure.message); setData(null); } else { setData(result as unknown as CostRates); setError(""); }
    setLoading(false);
  }, [projectId, allowed]);
  useEffect(() => { setData(null); setLoading(true); setDryRun(null); setRows([]); setUploadOpen(false); setExpanded(null); setBusy(false); setError(""); setNotice(""); void load(); return () => { request.current++; }; }, [load]);
  const materialSave = async (item: CostRateItem, rate: number) => {
    setBusy(true); setNotice("");
    const { error: failure } = await supabase.rpc("set_material_rate", { p_project_id: projectId, p_boq_item_id: item.id, p_rate: rate });
    if (failure) setError(failure.message); else { await load(); setNotice("Material rate saved"); }
    setBusy(false); return !failure;
  };
  const upload = async (file: File) => {
    setBusy(true); setError(""); setDryRun(null); setUploadOpen(true);
    try {
      const parsed = readCostRatesWorkbook(XLSX.read(await file.arrayBuffer()));
      if (activeProject.current !== projectId) return;
      setRows(parsed);
      const { data: result, error: failure } = await supabase.rpc("validate_cost_rates_upload", { p_project_id: projectId, p_rows: parsed });
      if (failure) throw new Error(failure.message);
      if (activeProject.current !== projectId) return;
      setDryRun(result as unknown as CostDryRun);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not read rates sheet"); }
    finally { setBusy(false); }
  };
  const confirm = async () => {
    if (!canConfirmCostUpload(dryRun, busy) || !dryRun?.boq_id) return;
    setBusy(true);
    const { error: failure } = await supabase.rpc("apply_cost_rates_upload", { p_project_id: projectId, p_boq_id: dryRun.boq_id, p_rows: rows });
    if (failure) { setError(failure.message); setDryRun(null); } else { setUploadOpen(false); setRows([]); setDryRun(null); await load(); setNotice("Rates uploaded"); }
    setBusy(false);
  };
  if (!allowed) return null;
  if (loading) return <div className="py-8 flex justify-center"><Loader2 aria-label="Loading rates" className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  const missing = data?.items.filter(i => i.missing_material_rate).length ?? 0;
  const items = data?.items.filter(i => !missingOnly || i.missing_material_rate) ?? [];
  return <section className="min-w-0 space-y-4 pb-24 md:pb-6" aria-label="Project rates">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-display font-bold text-xl">Rates</h2><div className="flex flex-wrap gap-2"><Button variant="outline" className="min-h-11" disabled={busy || !data?.boq_id} onClick={() => data && XLSX.writeFile(costRatesWorkbook(data.items), "Project_Rates.xlsx")}><Download className="h-4 w-4 mr-2" />Download rates sheet</Button><Button variant="outline" className="min-h-11" disabled={busy || !data?.boq_id} onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4 mr-2" />Upload rates</Button><input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" aria-label="Upload rates file" onChange={e => { const file = e.target.files?.[0]; if (file) void upload(file); e.target.value = ""; }} /></div></div>
    <Label className="inline-flex min-h-11 items-center gap-2 cursor-pointer"><Switch aria-label="Missing material rate filter" checked={missingOnly} onCheckedChange={setMissingOnly} />Missing material rate<Badge variant="secondary">{missing}</Badge></Label>
    {error && !uploadOpen && <p role="alert" className="text-destructive text-sm">{error}</p>}
    {notice && <p role="status" className="text-primary text-sm">{notice}</p>}
    <div className="hidden xl:grid grid-cols-[2.5rem_minmax(0,1fr)_5rem_5.5rem_7rem_8rem] gap-3 border-b border-border pb-2 text-xs text-muted-foreground"><span /><span>Code · Description</span><span>Unit</span><span>Location</span><span>BOQ billing rate</span><span>Material rate (₹)</span></div>
    {!data?.boq_id ? <p className="text-muted-foreground py-6">No BOQ uploaded for this project.</p> : items.length === 0 ? <p className="text-muted-foreground py-6">{missingOnly ? "No missing material rates." : "No BOQ items."}</p> : items.map(item => <div key={item.id} className="min-w-0 border border-border rounded-md bg-card xl:border-x-0 xl:border-t-0 xl:rounded-none xl:bg-background p-3 xl:px-0">
      <div className="grid grid-cols-[2.75rem_minmax(0,1fr)] xl:grid-cols-[2.5rem_minmax(0,1fr)_5rem_5.5rem_7rem_8rem] gap-3 items-start">
        <Button variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label={`Subcontract rates ${item.sno}`} aria-expanded={expanded === item.id} onClick={() => { setExpanded(expanded === item.id ? null : item.id); setAddFor(null); }}>{expanded === item.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</Button>
        <div className="min-w-0 break-words"><span className="font-semibold">{item.sno}</span><p className="text-sm">{item.description}</p>{item.missing_material_rate && <Badge variant="outline" className="mt-2 text-warning">Missing material rate</Badge>}</div>
        <div className="col-start-2 xl:col-start-auto text-sm"><span className="xl:hidden text-muted-foreground">Unit: </span>{item.unit}</div>
        <div className="col-start-2 xl:col-start-auto"><Badge variant="secondary">{item.work_location === "factory" ? "Factory" : "Site"}</Badge></div>
        <div className="col-start-2 xl:col-start-auto text-sm"><span className="xl:hidden block text-xs text-muted-foreground">BOQ billing rate</span>{money(item.boq_rate)}</div>
        <div className="col-start-2 xl:col-start-auto min-w-0"><Label className="xl:hidden text-xs">Material rate (₹)</Label><MaterialRate item={item} disabled={busy} save={rate => materialSave(item, rate)} /></div>
      </div>
      {expanded === item.id && <div className="min-w-0 mt-3"><h3 className="text-sm font-semibold">Subcontract rates</h3>{item.subcontracts.map(rate => <SubcontractEditor key={`${rate.id}-${rate.active}-${rate.includes_material}-${rate.rate}-${rate.lump_sum}-${rate.rate_type}-${rate.package_qty}`} projectId={projectId} item={item} contractors={data.contractors} rate={rate} onSaved={load} />)}{addFor === item.id ? <SubcontractEditor projectId={projectId} item={item} contractors={data.contractors} onSaved={async () => { await load(); setAddFor(null); }} /> : <Button variant="outline" className="min-h-11 mt-3" onClick={() => setAddFor(item.id)}><Plus className="h-4 w-4 mr-2" />Add contractor rate</Button>}</div>}
    </div>)}
    <Dialog open={uploadOpen} onOpenChange={open => { if (!busy) { setUploadOpen(open); if (!open) { setDryRun(null); setRows([]); setError(""); } } }}><DialogContent aria-describedby={undefined} className="max-h-[85dvh] overflow-y-auto max-w-xl"><DialogHeader><DialogTitle>Rates upload · Dry run</DialogTitle></DialogHeader>{busy ? <Loader2 aria-label="Checking upload" className="animate-spin h-5 w-5" /> : <><p className="text-sm">{dryRun?.row_count ?? 0} rows · {dryRun?.errors.length ?? 0} rejected</p>{error && <p role="alert" className="text-destructive text-sm">{error}</p>}{dryRun?.errors.map((e, i) => <p key={i} className="text-sm text-destructive break-words">Row {e.row}: {e.reason}</p>)}</>}<DialogFooter className="gap-2"><Button variant="outline" className="min-h-11" disabled={busy} onClick={() => { setUploadOpen(false); setDryRun(null); setRows([]); setError(""); }}>Cancel</Button><Button className="min-h-11" disabled={!canConfirmCostUpload(dryRun, busy)} onClick={confirm}>Confirm</Button></DialogFooter></DialogContent></Dialog>
  </section>;
}