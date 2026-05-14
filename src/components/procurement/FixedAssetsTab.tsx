import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Wrench, AlertTriangle, Loader2, MoveRight, Trash2, ShieldCheck, History, ArrowDownToLine } from "lucide-react";
import { toast } from "sonner";
import { format, differenceInDays, parseISO } from "date-fns";

const EDIT_ROLES = ["super_admin", "managing_director", "procurement", "stores_executive"];
const SERVICE_ROLES = ["super_admin", "managing_director", "procurement", "production_head"];
const MD_ROLES = ["super_admin", "managing_director"];

const ASSET_CATEGORIES = [
  { value: "machinery", label: "Machinery" },
  { value: "vehicle", label: "Vehicle" },
  { value: "it_equipment", label: "IT Equipment" },
  { value: "furniture", label: "Furniture" },
  { value: "safety_equipment", label: "Safety Equipment" },
  { value: "other", label: "Other" },
];
const TOOL_CATEGORIES = [
  { value: "hand_tool", label: "Hand Tool" },
  { value: "power_tool", label: "Power Tool" },
  { value: "measuring", label: "Measuring" },
  { value: "safety", label: "Safety" },
  { value: "other", label: "Other" },
];
const CONDITIONS = [
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "poor", label: "Poor" },
];
const LOCATIONS = ["Factory", "Site", "Office"];
const STATUS_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  active: { label: "Active", bg: "#E8F2ED", color: "#006039" },
  under_repair: { label: "Under Repair", bg: "#FFF3CD", color: "#856404" },
  pending_disposal: { label: "Pending Disposal", bg: "#FFF8E8", color: "#D4860A" },
  disposed: { label: "Disposed", bg: "#F0F0F0", color: "#666" },
};

interface FixedAsset {
  id: string;
  asset_name: string;
  asset_tag: string;
  category: string;
  make_model: string | null;
  serial_number: string | null;
  purchase_date: string | null;
  purchase_value: number | null;
  current_location: string | null;
  service_interval_days: number | null;
  last_service_date: string | null;
  next_service_due: string | null;
  insurance_expiry: string | null;
  warranty_expiry: string | null;
  condition: string;
  status: string;
  disposal_requested_at: string | null;
  disposal_reason: string | null;
  notes: string | null;
}

interface ServiceLog {
  id: string;
  service_date: string;
  service_type: string;
  done_by: string | null;
  cost: number | null;
  next_service_date_override: string | null;
  notes: string | null;
  attachment_url: string | null;
}

interface Tool {
  id: string;
  item_name: string;
  category: string;
  qty_total: number;
  qty_in_use: number;
  qty_available: number;
  location: string | null;
  condition: string;
  last_checked_date: string | null;
  notes: string | null;
}

interface Issuance {
  id: string;
  tool_id: string;
  qty: number;
  issued_to_name: string;
  issued_to_team: string | null;
  project_id: string | null;
  issued_on: string;
  expected_return_date: string | null;
  returned_on: string | null;
  return_qty: number | null;
  return_condition: string | null;
}

function dueBadge(due: string | null) {
  if (!due) return <Badge variant="secondary">—</Badge>;
  const days = differenceInDays(parseISO(due), new Date());
  if (days < 0) return <Badge style={{ backgroundColor: "#F40009", color: "#fff" }}>Overdue {-days}d</Badge>;
  if (days <= 7) return <Badge style={{ backgroundColor: "#D4860A", color: "#fff" }}>Due in {days}d</Badge>;
  return <Badge variant="outline">{format(parseISO(due), "dd/MM/yyyy")}</Badge>;
}

async function nextAssetTag(): Promise<string> {
  const { count } = await supabase.from("fixed_assets").select("id", { count: "exact", head: true });
  return `ASSET-${String((count ?? 0) + 1).padStart(4, "0")}`;
}
async function nextToolTag(): Promise<string> {
  const { count } = await supabase.from("tools_inventory").select("id", { count: "exact", head: true });
  return `TOOL-${String((count ?? 0) + 1).padStart(4, "0")}`;
}

const SEED_ASSETS = [
  { asset_name: "CNC Plasma Cutter", category: "machinery", make_model: "Esab Cutmaster 100", serial_number: "ESB-100-2023-08", purchase_date: "2023-04-15", purchase_value: 850000, current_location: "Factory", condition: "good", service_interval_days: 180, last_service_date: "2025-09-12", insurance_expiry: "2026-04-15" },
  { asset_name: "Tata Ace Mini Truck", category: "vehicle", make_model: "Tata Ace Gold", serial_number: "KA-04-AB-1234", purchase_date: "2022-06-10", purchase_value: 525000, current_location: "Factory", condition: "fair", service_interval_days: 90, last_service_date: "2025-10-02", insurance_expiry: "2026-06-09" },
  { asset_name: "Forklift 2.5T", category: "machinery", make_model: "Toyota 8FBN25", serial_number: "TY-FB25-77231", purchase_date: "2021-11-20", purchase_value: 1250000, current_location: "Factory", condition: "good", service_interval_days: 120, last_service_date: "2025-08-22", insurance_expiry: "2026-11-20" },
  { asset_name: "Mahindra Bolero Pickup", category: "vehicle", make_model: "Bolero Pik-Up 1.7T", serial_number: "KA-04-CD-5678", purchase_date: "2024-02-18", purchase_value: 720000, current_location: "Site", condition: "good", service_interval_days: 90, last_service_date: "2025-10-25", insurance_expiry: "2026-02-17" },
  { asset_name: "MIG Welding Machine", category: "machinery", make_model: "Lincoln Power MIG 256", serial_number: "LIN-256-44712", purchase_date: "2023-08-05", purchase_value: 165000, current_location: "Factory", condition: "good", service_interval_days: 365, last_service_date: "2025-08-05", insurance_expiry: null },
  { asset_name: "Dell OptiPlex Workstation", category: "it_equipment", make_model: "OptiPlex 7090", serial_number: "DLL-7090-W12", purchase_date: "2024-01-12", purchase_value: 78000, current_location: "Office", condition: "good", service_interval_days: null, last_service_date: null, insurance_expiry: null },
];

const SEED_TOOLS = [
  { item_name: "Cordless Drill 18V", category: "power_tool", qty_total: 12, location: "Factory Tool Crib", condition: "good" },
  { item_name: "Angle Grinder 4\"", category: "power_tool", qty_total: 18, location: "Factory Tool Crib", condition: "good" },
  { item_name: "Spirit Level 4ft", category: "measuring", qty_total: 15, location: "Factory Tool Crib", condition: "good" },
  { item_name: "Digital Vernier Caliper", category: "measuring", qty_total: 8, location: "QC Bench", condition: "good" },
  { item_name: "Tape Measure 5m", category: "measuring", qty_total: 30, location: "Factory Tool Crib", condition: "good" },
  { item_name: "Combination Wrench Set", category: "hand_tool", qty_total: 10, location: "Factory Tool Crib", condition: "good" },
  { item_name: "Screwdriver Set (12pc)", category: "hand_tool", qty_total: 14, location: "Factory Tool Crib", condition: "good" },
  { item_name: "Safety Harness Full Body", category: "safety", qty_total: 20, location: "Site Safety Bay", condition: "good" },
  { item_name: "Welding Helmet Auto-Dark", category: "safety", qty_total: 8, location: "Welding Bay", condition: "good" },
  { item_name: "Laser Distance Meter 60m", category: "measuring", qty_total: 4, location: "QC Bench", condition: "good" },
];

async function seedIfEmpty(canEdit: boolean) {
  if (!canEdit) return;
  const [{ count: assetCount }, { count: toolCount }] = await Promise.all([
    supabase.from("fixed_assets").select("id", { count: "exact", head: true }),
    supabase.from("tools_inventory").select("id", { count: "exact", head: true }),
  ]);

  if ((assetCount ?? 0) === 0) {
    const rows = await Promise.all(SEED_ASSETS.map(async (a, i) => ({
      ...a,
      asset_tag: `ASSET-${String(i + 1).padStart(4, "0")}`,
    })));
    await supabase.from("fixed_assets").insert(rows as any);
  }
  if ((toolCount ?? 0) === 0) {
    await supabase.from("tools_inventory").insert(SEED_TOOLS.map(t => ({ ...t, qty_in_use: 0 })) as any);
  }
}

export function FixedAssetsTab() {
  const { role } = useUserRole();
  const canEdit = EDIT_ROLES.includes(role || "");
  const canLogService = SERVICE_ROLES.includes(role || "");
  const isMD = MD_ROLES.includes(role || "");

  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [issuances, setIssuances] = useState<Issuance[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [addAssetOpen, setAddAssetOpen] = useState(false);
  const [addToolOpen, setAddToolOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    await seedIfEmpty(canEdit);
    const [{ data: a }, { data: t }, { data: i }, { data: p }] = await Promise.all([
      supabase.from("fixed_assets").select("*").eq("is_archived", false).order("asset_tag"),
      supabase.from("tools_inventory").select("*").eq("is_archived", false).order("item_name"),
      (supabase.from("tool_issuance") as any).select("*").order("issued_on", { ascending: false }),
      supabase.from("projects").select("id, name").eq("is_archived", false).order("name"),
    ]);
    setAssets((a as any) || []);
    setTools((t as any) || []);
    setIssuances((i as any) || []);
    setProjects((p as any) || []);
    setLoading(false);
  }, [canEdit]);

  useEffect(() => { load(); }, [load]);

  const projectName = useCallback((id: string | null) => projects.find(p => p.id === id)?.name ?? "—", [projects]);

  if (loading) {
    return <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  // Service alerts (active assets only)
  const activeAssets = assets.filter(a => a.status !== "disposed");
  const overdueCount = activeAssets.filter(a => a.next_service_due && differenceInDays(parseISO(a.next_service_due), new Date()) < 0).length;
  const dueSoonCount = activeAssets.filter(a => {
    if (!a.next_service_due) return false;
    const d = differenceInDays(parseISO(a.next_service_due), new Date());
    return d >= 0 && d <= 7;
  }).length;
  const insuranceSoonCount = activeAssets.filter(a => {
    if (!a.insurance_expiry) return false;
    const d = differenceInDays(parseISO(a.insurance_expiry), new Date());
    return d >= 0 && d <= 30;
  }).length;
  const pendingDisposal = assets.filter(a => a.status === "pending_disposal").length;

  // Tool overdue returns
  const overdueIssuances = issuances.filter(i => !i.returned_on && i.expected_return_date && differenceInDays(new Date(), parseISO(i.expected_return_date)) > 0);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-bold" style={{ color: "#1A1A1A" }}>Asset Register</h2>
        <p className="text-xs mt-0.5" style={{ color: "#666" }}>Equipment, vehicles &amp; tools owned by the company.</p>
      </div>

      {(overdueCount > 0 || dueSoonCount > 0 || insuranceSoonCount > 0 || pendingDisposal > 0 || overdueIssuances.length > 0) && (
        <Card style={{ borderLeft: "4px solid #D4860A" }}>
          <CardContent className="p-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <AlertTriangle className="h-4 w-4" style={{ color: "#D4860A" }} />
            {overdueCount > 0 && <span style={{ color: "#F40009", fontWeight: 600 }}>{overdueCount} service overdue</span>}
            {dueSoonCount > 0 && <span>{dueSoonCount} service due in 7 days</span>}
            {insuranceSoonCount > 0 && <span>{insuranceSoonCount} insurance expiring in 30d</span>}
            {pendingDisposal > 0 && <span style={{ color: "#D4860A" }}>{pendingDisposal} pending disposal approval</span>}
            {overdueIssuances.length > 0 && <span style={{ color: "#F40009", fontWeight: 600 }}>{overdueIssuances.length} tool return overdue</span>}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="assets">
        <TabsList>
          <TabsTrigger value="assets">Fixed Assets ({activeAssets.length})</TabsTrigger>
          <TabsTrigger value="tools">Tools Inventory ({tools.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="assets" className="space-y-3">
          {canEdit && (
            <div className="flex justify-end">
              <Dialog open={addAssetOpen} onOpenChange={setAddAssetOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" style={{ backgroundColor: "#006039" }}><Plus className="h-4 w-4 mr-1" /> Add Asset</Button>
                </DialogTrigger>
                <AddAssetDialog onSaved={() => { setAddAssetOpen(false); load(); }} />
              </Dialog>
            </div>
          )}
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow style={{ backgroundColor: "#F7F7F7" }}>
                    <TableHead className="text-xs">Asset ID</TableHead>
                    <TableHead className="text-xs">Name</TableHead>
                    <TableHead className="text-xs">Category</TableHead>
                    <TableHead className="text-xs">Location</TableHead>
                    <TableHead className="text-xs">Condition</TableHead>
                    <TableHead className="text-xs">Next Service</TableHead>
                    <TableHead className="text-xs">Insurance</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assets.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No assets registered yet.</TableCell></TableRow>
                  ) : assets.map(a => {
                    const st = STATUS_BADGE[a.status] || STATUS_BADGE.active;
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="font-mono text-xs">{a.asset_tag}</TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{a.asset_name}</div>
                          {a.make_model && <div className="text-[11px] text-muted-foreground">{a.make_model}</div>}
                          {a.serial_number && <div className="text-[10px] font-mono" style={{ color: "#999" }}>SN: {a.serial_number}</div>}
                        </TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{ASSET_CATEGORIES.find(c => c.value === a.category)?.label || a.category}</Badge></TableCell>
                        <TableCell className="text-sm">{a.current_location || "—"}</TableCell>
                        <TableCell className="text-xs capitalize" style={{ color: a.condition === "poor" ? "#F40009" : "#666" }}>{a.condition}</TableCell>
                        <TableCell>{dueBadge(a.next_service_due)}</TableCell>
                        <TableCell>{dueBadge(a.insurance_expiry)}</TableCell>
                        <TableCell><Badge style={{ backgroundColor: st.bg, color: st.color, border: "none" }} className="text-[10px]">{st.label}</Badge></TableCell>
                        <TableCell>
                          <AssetActions asset={a} canLog={canLogService} canEdit={canEdit} isMD={isMD} onChange={load} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tools" className="space-y-3">
          {canEdit && (
            <div className="flex justify-end">
              <Dialog open={addToolOpen} onOpenChange={setAddToolOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" style={{ backgroundColor: "#006039" }}><Plus className="h-4 w-4 mr-1" /> Add Tool</Button>
                </DialogTrigger>
                <AddToolDialog onSaved={() => { setAddToolOpen(false); load(); }} />
              </Dialog>
            </div>
          )}

          {overdueIssuances.length > 0 && (
            <Card style={{ borderLeft: "4px solid #F40009" }}>
              <CardContent className="p-3 text-sm">
                <div className="font-medium mb-1" style={{ color: "#F40009" }}>Overdue Tool Returns</div>
                <div className="space-y-0.5 text-xs">
                  {overdueIssuances.slice(0, 5).map(i => {
                    const tool = tools.find(t => t.id === i.tool_id);
                    const days = differenceInDays(new Date(), parseISO(i.expected_return_date!));
                    return <div key={i.id}>• {tool?.item_name ?? "Tool"} × {i.qty} — {i.issued_to_name} <span style={{ color: "#F40009" }}>({days}d late)</span></div>;
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow style={{ backgroundColor: "#F7F7F7" }}>
                    <TableHead className="text-xs">Tool</TableHead>
                    <TableHead className="text-xs">Category</TableHead>
                    <TableHead className="text-xs text-right">Owned</TableHead>
                    <TableHead className="text-xs text-right">Issued</TableHead>
                    <TableHead className="text-xs text-right">Available</TableHead>
                    <TableHead className="text-xs">Location</TableHead>
                    <TableHead className="text-xs">Condition</TableHead>
                    <TableHead className="text-xs">Last Checked</TableHead>
                    <TableHead className="text-xs">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tools.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No tools registered yet.</TableCell></TableRow>
                  ) : tools.map(t => (
                    <ToolRow
                      key={t.id} tool={t} canEdit={canEdit}
                      issuances={issuances.filter(i => i.tool_id === t.id)}
                      projects={projects} projectName={projectName}
                      onChange={load}
                    />
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ─────────── Asset row actions ─────────── */

function AssetActions({ asset, canLog, canEdit, isMD, onChange }: { asset: FixedAsset; canLog: boolean; canEdit: boolean; isMD: boolean; onChange: () => void }) {
  const [transferOpen, setTransferOpen] = useState(false);
  const [disposeOpen, setDisposeOpen] = useState(false);
  return (
    <div className="flex flex-wrap gap-1">
      <Sheet>
        <SheetTrigger asChild>
          <Button size="sm" variant="outline" className="h-7 text-xs"><History className="h-3 w-3 mr-1" /> Service</Button>
        </SheetTrigger>
        <ServiceHistorySheet assetId={asset.id} assetName={asset.asset_name} canLog={canLog} onChange={onChange} />
      </Sheet>
      {canEdit && (
        <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="h-7 text-xs"><MoveRight className="h-3 w-3 mr-1" /> Transfer</Button>
          </DialogTrigger>
          <TransferLocationDialog asset={asset} onSaved={() => { setTransferOpen(false); onChange(); }} />
        </Dialog>
      )}
      {canEdit && asset.status !== "disposed" && asset.status !== "pending_disposal" && (
        <Dialog open={disposeOpen} onOpenChange={setDisposeOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="h-7 text-xs" style={{ color: "#F40009", borderColor: "#F40009" }}><Trash2 className="h-3 w-3 mr-1" /> Dispose</Button>
          </DialogTrigger>
          <DisposalRequestDialog asset={asset} onSaved={() => { setDisposeOpen(false); onChange(); }} />
        </Dialog>
      )}
      {isMD && asset.status === "pending_disposal" && (
        <ApproveDisposalButton assetId={asset.id} onChange={onChange} />
      )}
    </div>
  );
}

function ApproveDisposalButton({ assetId, onChange }: { assetId: string; onChange: () => void }) {
  const [saving, setSaving] = useState(false);
  return (
    <Button size="sm" className="h-7 text-xs" style={{ backgroundColor: "#006039" }} disabled={saving}
      onClick={async () => {
        setSaving(true);
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from("fixed_assets").update({
          status: "disposed",
          disposal_approved_at: new Date().toISOString(),
          disposal_approved_by: user?.id ?? null,
        } as any).eq("id", assetId);
        setSaving(false);
        if (error) { toast.error(error.message); return; }
        toast.success("Disposal approved — asset retired");
        onChange();
      }}>
      <ShieldCheck className="h-3 w-3 mr-1" /> Approve Disposal
    </Button>
  );
}

function TransferLocationDialog({ asset, onSaved }: { asset: FixedAsset; onSaved: () => void }) {
  const [location, setLocation] = useState(asset.current_location ?? "Factory");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    const { error } = await supabase.from("fixed_assets").update({
      current_location: location,
      notes: notes ? `${asset.notes ?? ""}\n[${format(new Date(), "dd/MM/yyyy")}] Transferred to ${location}: ${notes}`.trim() : asset.notes,
    }).eq("id", asset.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Transferred to ${location}`);
    onSaved();
  };
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Transfer Location — {asset.asset_name}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <Label className="text-xs">New Location</Label>
          <Select value={location} onValueChange={setLocation}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>{LOCATIONS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Notes (optional)</Label>
          <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="mt-1" />
        </div>
      </div>
      <DialogFooter><Button onClick={submit} disabled={saving} style={{ backgroundColor: "#006039" }}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Transfer"}</Button></DialogFooter>
    </DialogContent>
  );
}

function DisposalRequestDialog({ asset, onSaved }: { asset: FixedAsset; onSaved: () => void }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!reason.trim()) { toast.error("Reason required"); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("fixed_assets").update({
      status: "pending_disposal",
      disposal_requested_at: new Date().toISOString(),
      disposal_requested_by: user?.id ?? null,
      disposal_reason: reason.trim(),
    } as any).eq("id", asset.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Disposal request sent to MD");
    onSaved();
  };
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Request Disposal — {asset.asset_name}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="text-xs p-2 rounded" style={{ backgroundColor: "#FFF8E8", color: "#856404" }}>
          MD approval required. Asset moves to <strong>Pending Disposal</strong> until approved.
        </div>
        <div>
          <Label className="text-xs">Reason for Disposal *</Label>
          <Textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} className="mt-1" placeholder="e.g. Beyond economic repair; replaced by new unit." />
        </div>
      </div>
      <DialogFooter><Button onClick={submit} disabled={saving} style={{ backgroundColor: "#F40009" }}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Request"}</Button></DialogFooter>
    </DialogContent>
  );
}

/* ─────────── Add Asset / Add Tool dialogs ─────────── */

function AddAssetDialog({ onSaved }: { onSaved: () => void }) {
  const [form, setForm] = useState({
    asset_name: "", category: "machinery", make_model: "", serial_number: "",
    purchase_date: "", purchase_value: "", current_location: "Factory", condition: "good",
    service_interval_days: "180", last_service_date: "", insurance_expiry: "", notes: "",
  });
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!form.asset_name.trim()) { toast.error("Asset name is required"); return; }
    setSaving(true);
    const tag = await nextAssetTag();
    const { error } = await supabase.from("fixed_assets").insert({
      asset_tag: tag,
      asset_name: form.asset_name.trim(),
      category: form.category as any,
      make_model: form.make_model || null,
      serial_number: form.serial_number || null,
      purchase_date: form.purchase_date || null,
      purchase_value: form.purchase_value ? Number(form.purchase_value) : null,
      current_location: form.current_location || null,
      condition: form.condition,
      service_interval_days: form.service_interval_days ? Number(form.service_interval_days) : null,
      last_service_date: form.last_service_date || null,
      insurance_expiry: form.insurance_expiry || null,
      notes: form.notes || null,
    } as any);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${tag} added`);
    onSaved();
  };
  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle>Add Fixed Asset</DialogTitle></DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><Label>Asset Name *</Label><Input value={form.asset_name} onChange={e => setForm({ ...form, asset_name: e.target.value })} /></div>
        <div>
          <Label>Category</Label>
          <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{ASSET_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Condition</Label>
          <Select value={form.condition} onValueChange={v => setForm({ ...form, condition: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CONDITIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Make / Model</Label><Input value={form.make_model} onChange={e => setForm({ ...form, make_model: e.target.value })} /></div>
        <div><Label>Serial Number</Label><Input value={form.serial_number} onChange={e => setForm({ ...form, serial_number: e.target.value })} /></div>
        <div>
          <Label>Current Location</Label>
          <Select value={form.current_location} onValueChange={v => setForm({ ...form, current_location: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{LOCATIONS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Purchase Date</Label><Input type="date" value={form.purchase_date} onChange={e => setForm({ ...form, purchase_date: e.target.value })} /></div>
        <div><Label>Purchase Cost (₹)</Label><Input type="number" value={form.purchase_value} onChange={e => setForm({ ...form, purchase_value: e.target.value })} /></div>
        <div><Label>Service Interval (days)</Label><Input type="number" value={form.service_interval_days} onChange={e => setForm({ ...form, service_interval_days: e.target.value })} /></div>
        <div><Label>Last Service Date</Label><Input type="date" value={form.last_service_date} onChange={e => setForm({ ...form, last_service_date: e.target.value })} /></div>
        <div><Label>Insurance Expiry</Label><Input type="date" value={form.insurance_expiry} onChange={e => setForm({ ...form, insurance_expiry: e.target.value })} /></div>
        <div className="col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
      </div>
      <DialogFooter><Button onClick={submit} disabled={saving} style={{ backgroundColor: "#006039" }}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Asset"}</Button></DialogFooter>
    </DialogContent>
  );
}

function AddToolDialog({ onSaved }: { onSaved: () => void }) {
  const [form, setForm] = useState({ item_name: "", category: "hand_tool", qty_total: "1", location: "Factory Tool Crib", condition: "good", notes: "" });
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!form.item_name.trim()) { toast.error("Item name required"); return; }
    setSaving(true);
    const { error } = await supabase.from("tools_inventory").insert({
      item_name: form.item_name.trim(),
      category: form.category,
      qty_total: Number(form.qty_total) || 0,
      qty_in_use: 0,
      location: form.location || null,
      condition: form.condition as any,
      last_checked_date: format(new Date(), "yyyy-MM-dd"),
      notes: form.notes || null,
    } as any);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Tool added");
    onSaved();
  };
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Add Tool</DialogTitle></DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><Label>Tool Name *</Label><Input value={form.item_name} onChange={e => setForm({ ...form, item_name: e.target.value })} /></div>
        <div>
          <Label>Category</Label>
          <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{TOOL_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Quantity Owned</Label><Input type="number" value={form.qty_total} onChange={e => setForm({ ...form, qty_total: e.target.value })} /></div>
        <div className="col-span-2"><Label>Location</Label><Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></div>
        <div>
          <Label>Condition</Label>
          <Select value={form.condition} onValueChange={v => setForm({ ...form, condition: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CONDITIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
      </div>
      <DialogFooter><Button onClick={submit} disabled={saving} style={{ backgroundColor: "#006039" }}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Tool"}</Button></DialogFooter>
    </DialogContent>
  );
}

/* ─────────── Tool row + issuance ─────────── */

function ToolRow({ tool, canEdit, issuances, projects, projectName, onChange }: {
  tool: Tool; canEdit: boolean; issuances: Issuance[];
  projects: { id: string; name: string }[]; projectName: (id: string | null) => string;
  onChange: () => void;
}) {
  const [issueOpen, setIssueOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const openIssuances = issuances.filter(i => !i.returned_on);
  const hasOpen = openIssuances.length > 0;

  return (
    <TableRow>
      <TableCell className="font-medium text-sm">{tool.item_name}</TableCell>
      <TableCell><Badge variant="outline" className="text-[10px]">{TOOL_CATEGORIES.find(c => c.value === tool.category)?.label || tool.category}</Badge></TableCell>
      <TableCell className="text-right text-sm">{tool.qty_total}</TableCell>
      <TableCell className="text-right text-sm" style={{ color: tool.qty_in_use > 0 ? "#D4860A" : "#666" }}>{tool.qty_in_use}</TableCell>
      <TableCell className="text-right font-medium text-sm" style={{ color: tool.qty_available === 0 ? "#F40009" : "#006039" }}>{tool.qty_available}</TableCell>
      <TableCell className="text-xs">{tool.location || "—"}</TableCell>
      <TableCell><Badge variant="outline" className="text-[10px] capitalize">{tool.condition}</Badge></TableCell>
      <TableCell className="text-xs">{tool.last_checked_date ? format(parseISO(tool.last_checked_date), "dd/MM/yyyy") : "—"}</TableCell>
      <TableCell>
        <div className="flex gap-1 flex-wrap">
          {canEdit && tool.qty_available > 0 && (
            <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="h-7 text-xs"><MoveRight className="h-3 w-3 mr-1" /> Issue</Button>
              </DialogTrigger>
              <IssueDialog tool={tool} projects={projects} onSaved={() => { setIssueOpen(false); onChange(); }} />
            </Dialog>
          )}
          {canEdit && hasOpen && (
            <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="h-7 text-xs"><ArrowDownToLine className="h-3 w-3 mr-1" /> Return</Button>
              </DialogTrigger>
              <ReturnDialog tool={tool} openIssuances={openIssuances} onSaved={() => { setReturnOpen(false); onChange(); }} />
            </Dialog>
          )}
          <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
            <SheetTrigger asChild>
              <Button size="sm" variant="outline" className="h-7 text-xs"><History className="h-3 w-3" /></Button>
            </SheetTrigger>
            <SheetContent className="overflow-y-auto">
              <SheetHeader><SheetTitle>Issuance History — {tool.item_name}</SheetTitle></SheetHeader>
              <div className="space-y-2 mt-4 text-sm">
                {issuances.length === 0 ? <p className="text-muted-foreground">No issuances.</p> :
                  issuances.map(i => {
                    const overdue = !i.returned_on && i.expected_return_date && differenceInDays(new Date(), parseISO(i.expected_return_date)) > 0;
                    return (
                      <Card key={i.id}>
                        <CardContent className="p-3 text-xs space-y-0.5">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{i.issued_to_name} {i.issued_to_team ? `(${i.issued_to_team})` : ""}</span>
                            <span>{i.qty} pcs</span>
                          </div>
                          <div style={{ color: "#666" }}>Project: {projectName(i.project_id)}</div>
                          <div style={{ color: "#666" }}>Issued: {format(parseISO(i.issued_on), "dd/MM/yyyy")} · Expected: {i.expected_return_date ? format(parseISO(i.expected_return_date), "dd/MM/yyyy") : "—"}</div>
                          {i.returned_on ? (
                            <div style={{ color: "#006039" }}>Returned {format(parseISO(i.returned_on), "dd/MM/yyyy")} · {i.return_qty}/{i.qty} · {i.return_condition}</div>
                          ) : overdue ? (
                            <div style={{ color: "#F40009", fontWeight: 600 }}>Overdue {differenceInDays(new Date(), parseISO(i.expected_return_date!))} day(s)</div>
                          ) : (
                            <div style={{ color: "#D4860A" }}>Open</div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })
                }
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </TableCell>
    </TableRow>
  );
}

function IssueDialog({ tool, projects, onSaved }: { tool: Tool; projects: { id: string; name: string }[]; onSaved: () => void }) {
  const [form, setForm] = useState({
    qty: "1", issued_to_name: "", issued_to_team: "", project_id: "",
    expected_return_date: "", notes: "",
  });
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!form.issued_to_name.trim()) { toast.error("Worker / team name required"); return; }
    const qty = Number(form.qty);
    if (qty <= 0 || qty > tool.qty_available) { toast.error(`Qty must be 1..${tool.qty_available}`); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await (supabase.from("tool_issuance") as any).insert({
      tool_id: tool.id,
      qty,
      issued_to_name: form.issued_to_name.trim(),
      issued_to_team: form.issued_to_team || null,
      project_id: form.project_id || null,
      issued_on: format(new Date(), "yyyy-MM-dd"),
      expected_return_date: form.expected_return_date || null,
      notes: form.notes || null,
      issued_by: user?.id ?? null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Issued ${qty} × ${tool.item_name}`);
    onSaved();
  };
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Issue Tool — {tool.item_name}</DialogTitle></DialogHeader>
      <div className="text-xs mb-2" style={{ color: "#666" }}>Available: <strong>{tool.qty_available}</strong> of {tool.qty_total}</div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Quantity</Label><Input type="number" min="1" max={tool.qty_available} value={form.qty} onChange={e => setForm({ ...form, qty: e.target.value })} /></div>
        <div><Label>Issued To (Worker)</Label><Input value={form.issued_to_name} onChange={e => setForm({ ...form, issued_to_name: e.target.value })} /></div>
        <div><Label>Team (optional)</Label><Input value={form.issued_to_team} onChange={e => setForm({ ...form, issued_to_team: e.target.value })} /></div>
        <div>
          <Label>Project (optional)</Label>
          <Select value={form.project_id} onValueChange={v => setForm({ ...form, project_id: v })}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="col-span-2"><Label>Expected Return Date</Label><Input type="date" value={form.expected_return_date} onChange={e => setForm({ ...form, expected_return_date: e.target.value })} /></div>
        <div className="col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
      </div>
      <DialogFooter><Button onClick={submit} disabled={saving} style={{ backgroundColor: "#006039" }}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Issue Tool"}</Button></DialogFooter>
    </DialogContent>
  );
}

function ReturnDialog({ tool, openIssuances, onSaved }: { tool: Tool; openIssuances: Issuance[]; onSaved: () => void }) {
  const [issuanceId, setIssuanceId] = useState<string>(openIssuances[0]?.id ?? "");
  const selected = useMemo(() => openIssuances.find(i => i.id === issuanceId), [openIssuances, issuanceId]);
  const [returnQty, setReturnQty] = useState<string>(selected ? String(selected.qty) : "1");
  const [returnCondition, setReturnCondition] = useState("good");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (selected) setReturnQty(String(selected.qty)); }, [selected]);

  const submit = async () => {
    if (!selected) { toast.error("Pick an issuance"); return; }
    const q = Number(returnQty);
    if (q <= 0 || q > selected.qty) { toast.error(`Return qty must be 1..${selected.qty}`); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await (supabase.from("tool_issuance") as any).update({
      returned_on: format(new Date(), "yyyy-MM-dd"),
      return_qty: q,
      return_condition: returnCondition,
      returned_by: user?.id ?? null,
    }).eq("id", selected.id);
    if (!error) {
      // bump last_checked_date when returned, and update tool condition if poor
      await supabase.from("tools_inventory").update({
        last_checked_date: format(new Date(), "yyyy-MM-dd"),
        ...(returnCondition === "poor" ? { condition: "poor" } : {}),
      } as any).eq("id", tool.id);
    }
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${q} × ${tool.item_name} returned`);
    onSaved();
  };
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Return Tool — {tool.item_name}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Open Issuance</Label>
          <Select value={issuanceId} onValueChange={setIssuanceId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {openIssuances.map(i => (
                <SelectItem key={i.id} value={i.id}>
                  {i.issued_to_name} · {i.qty} pcs · {format(parseISO(i.issued_on), "dd/MM/yyyy")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Return Qty</Label><Input type="number" min="1" max={selected?.qty} value={returnQty} onChange={e => setReturnQty(e.target.value)} /></div>
          <div>
            <Label>Condition on Return</Label>
            <Select value={returnCondition} onValueChange={setReturnCondition}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CONDITIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <DialogFooter><Button onClick={submit} disabled={saving || !selected} style={{ backgroundColor: "#006039" }}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Return"}</Button></DialogFooter>
    </DialogContent>
  );
}

/* ─────────── Service history sheet ─────────── */

function ServiceHistorySheet({ assetId, assetName, canLog, onChange }: { assetId: string; assetName: string; canLog: boolean; onChange: () => void }) {
  const [logs, setLogs] = useState<ServiceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLog, setShowLog] = useState(false);
  const [form, setForm] = useState({
    service_date: format(new Date(), "yyyy-MM-dd"),
    service_type: "Routine",
    done_by: "",
    cost: "",
    next_service_date_override: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("fixed_asset_service_log").select("*").eq("asset_id", assetId).order("service_date", { ascending: false });
    setLogs((data as ServiceLog[]) || []);
    setLoading(false);
  }, [assetId]);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    setSaving(true);
    const { error } = await supabase.from("fixed_asset_service_log").insert({
      asset_id: assetId,
      service_date: form.service_date,
      service_type: form.service_type,
      done_by: form.done_by || null,
      cost: form.cost ? Number(form.cost) : null,
      next_service_date_override: form.next_service_date_override || null,
      notes: form.notes || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Service logged");
    setShowLog(false);
    setForm({ service_date: format(new Date(), "yyyy-MM-dd"), service_type: "Routine", done_by: "", cost: "", next_service_date_override: "", notes: "" });
    load();
    onChange();
  };

  return (
    <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
      <SheetHeader><SheetTitle>Service History — {assetName}</SheetTitle></SheetHeader>
      {canLog && (
        <div className="my-4">
          {!showLog ? (
            <Button size="sm" onClick={() => setShowLog(true)} style={{ backgroundColor: "#006039" }}>
              <Plus className="h-4 w-4 mr-1" /> Log Service
            </Button>
          ) : (
            <Card><CardContent className="p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Service Date</Label><Input type="date" value={form.service_date} onChange={e => setForm({ ...form, service_date: e.target.value })} /></div>
                <div>
                  <Label className="text-xs">Service Type</Label>
                  <Select value={form.service_type} onValueChange={v => setForm({ ...form, service_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Routine">Routine</SelectItem>
                      <SelectItem value="Breakdown">Breakdown</SelectItem>
                      <SelectItem value="AMC">AMC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2"><Label className="text-xs">Service Provider</Label><Input value={form.done_by} onChange={e => setForm({ ...form, done_by: e.target.value })} /></div>
                <div><Label className="text-xs">Cost (₹)</Label><Input type="number" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} /></div>
                <div><Label className="text-xs">Next Service Due</Label><Input type="date" value={form.next_service_date_override} onChange={e => setForm({ ...form, next_service_date_override: e.target.value })} /></div>
                <div className="col-span-2"><Label className="text-xs">Work Done</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button size="sm" variant="ghost" onClick={() => setShowLog(false)}>Cancel</Button>
                <Button size="sm" onClick={submit} disabled={saving} style={{ backgroundColor: "#006039" }}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}</Button>
              </div>
            </CardContent></Card>
          )}
        </div>
      )}
      <div className="space-y-2 mt-4">
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No service history yet.</p>
        ) : logs.map(log => (
          <Card key={log.id}><CardContent className="p-3 text-sm">
            <div className="flex items-center justify-between mb-1">
              <Badge variant="outline" className="text-[10px]">{log.service_type}</Badge>
              <span className="text-xs text-muted-foreground">{format(parseISO(log.service_date), "dd/MM/yyyy")}</span>
            </div>
            {log.done_by && <div className="text-xs"><strong>Provider:</strong> {log.done_by}</div>}
            {log.cost != null && <div className="text-xs"><strong>Cost:</strong> ₹{Number(log.cost).toLocaleString("en-IN")}</div>}
            {log.next_service_date_override && <div className="text-xs"><strong>Next due:</strong> {format(parseISO(log.next_service_date_override), "dd/MM/yyyy")}</div>}
            {log.notes && <div className="text-xs mt-1" style={{ color: "#666" }}>{log.notes}</div>}
          </CardContent></Card>
        ))}
      </div>
    </SheetContent>
  );
}
