import { useCallback, useEffect, useState } from "react";
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
import { Plus, Wrench, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format, differenceInDays, parseISO } from "date-fns";

const EDIT_ROLES = ["super_admin", "managing_director", "procurement", "stores_executive"];
const SERVICE_ROLES = ["super_admin", "managing_director", "procurement", "production_head"];

const CATEGORIES = [
  { value: "machinery", label: "Machinery" },
  { value: "vehicle", label: "Vehicle" },
  { value: "it_equipment", label: "IT Equipment" },
  { value: "furniture", label: "Furniture" },
  { value: "safety_equipment", label: "Safety Equipment" },
  { value: "tools", label: "Tools" },
  { value: "other", label: "Other" },
];

const CONDITIONS = [
  { value: "new", label: "New" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "damaged", label: "Damaged" },
  { value: "retired", label: "Retired" },
];

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
  warranty_expiry: string | null;
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
  qty_total: number;
  qty_in_use: number;
  qty_available: number;
  location: string | null;
  condition: string;
  notes: string | null;
}

function dueBadge(due: string | null) {
  if (!due) return <Badge variant="secondary">Not scheduled</Badge>;
  const days = differenceInDays(parseISO(due), new Date());
  if (days < 0) return <Badge style={{ backgroundColor: "#F40009", color: "#fff" }}>Overdue</Badge>;
  if (days <= 7) return <Badge style={{ backgroundColor: "#D4860A", color: "#fff" }}>Due in {days}d</Badge>;
  return <Badge variant="outline">{format(parseISO(due), "dd/MM/yyyy")}</Badge>;
}

export function FixedAssetsTab() {
  const { role } = useUserRole();
  const canEdit = EDIT_ROLES.includes(role || "");
  const canLogService = SERVICE_ROLES.includes(role || "");

  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [addAssetOpen, setAddAssetOpen] = useState(false);
  const [addToolOpen, setAddToolOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: a }, { data: t }] = await Promise.all([
      supabase.from("fixed_assets").select("*").eq("is_archived", false).order("asset_name"),
      supabase.from("tools_inventory").select("*").eq("is_archived", false).order("item_name"),
    ]);
    setAssets((a as FixedAsset[]) || []);
    setTools((t as Tool[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const overdueCount = assets.filter(a => a.next_service_due && differenceInDays(parseISO(a.next_service_due), new Date()) < 0).length;
  const dueSoonCount = assets.filter(a => {
    if (!a.next_service_due) return false;
    const d = differenceInDays(parseISO(a.next_service_due), new Date());
    return d >= 0 && d <= 7;
  }).length;

  return (
    <div className="space-y-4">
      {(overdueCount > 0 || dueSoonCount > 0) && (
        <Card style={{ borderLeft: "4px solid #D4860A" }}>
          <CardContent className="p-3 flex items-center gap-3 text-sm">
            <AlertTriangle className="h-4 w-4" style={{ color: "#D4860A" }} />
            <span>
              {overdueCount > 0 && <span style={{ color: "#F40009", fontWeight: 600 }}>{overdueCount} overdue</span>}
              {overdueCount > 0 && dueSoonCount > 0 && " · "}
              {dueSoonCount > 0 && <span>{dueSoonCount} due within 7 days</span>}
            </span>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="assets">
        <TabsList>
          <TabsTrigger value="assets">Fixed Assets ({assets.length})</TabsTrigger>
          <TabsTrigger value="tools">Tools Inventory ({tools.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="assets" className="space-y-3">
          {canEdit && (
            <div className="flex justify-end">
              <Dialog open={addAssetOpen} onOpenChange={setAddAssetOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Asset</Button>
                </DialogTrigger>
                <AddAssetDialog onSaved={() => { setAddAssetOpen(false); load(); }} />
              </Dialog>
            </div>
          )}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset Tag</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Last Service</TableHead>
                    <TableHead>Next Service</TableHead>
                    <TableHead>Warranty</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assets.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">No assets registered</TableCell></TableRow>
                  ) : assets.map(a => (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono text-xs">{a.asset_tag}</TableCell>
                      <TableCell>
                        <div className="font-medium">{a.asset_name}</div>
                        {a.make_model && <div className="text-xs text-muted-foreground">{a.make_model}</div>}
                      </TableCell>
                      <TableCell><Badge variant="outline">{CATEGORIES.find(c => c.value === a.category)?.label || a.category}</Badge></TableCell>
                      <TableCell className="text-sm">{a.current_location || "—"}</TableCell>
                      <TableCell className="text-sm">{a.last_service_date ? format(parseISO(a.last_service_date), "dd/MM/yyyy") : "—"}</TableCell>
                      <TableCell>{dueBadge(a.next_service_due)}</TableCell>
                      <TableCell className="text-sm">{a.warranty_expiry ? format(parseISO(a.warranty_expiry), "dd/MM/yyyy") : "—"}</TableCell>
                      <TableCell>
                        <Sheet>
                          <SheetTrigger asChild>
                            <Button size="sm" variant="outline"><Wrench className="h-3 w-3 mr-1" /> Service</Button>
                          </SheetTrigger>
                          <ServiceHistorySheet assetId={a.id} assetName={a.asset_name} canLog={canLogService} onChange={load} />
                        </Sheet>
                      </TableCell>
                    </TableRow>
                  ))}
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
                  <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Tool</Button>
                </DialogTrigger>
                <AddToolDialog onSaved={() => { setAddToolOpen(false); load(); }} />
              </Dialog>
            </div>
          )}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">In Use</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Condition</TableHead>
                    {canEdit && <TableHead>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tools.length === 0 ? (
                    <TableRow><TableCell colSpan={canEdit ? 7 : 6} className="text-center py-6 text-muted-foreground">No tools registered</TableCell></TableRow>
                  ) : tools.map(t => <ToolRow key={t.id} tool={t} canEdit={canEdit} onChange={load} />)}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AddAssetDialog({ onSaved }: { onSaved: () => void }) {
  const [form, setForm] = useState({
    asset_name: "", asset_tag: "", category: "machinery", make_model: "", serial_number: "",
    purchase_date: "", purchase_value: "", current_location: "",
    service_interval_days: "", last_service_date: "", warranty_expiry: "", notes: "",
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.asset_name.trim() || !form.asset_tag.trim()) {
      toast.error("Asset name and tag are required");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("fixed_assets").insert({
      asset_name: form.asset_name.trim(),
      asset_tag: form.asset_tag.trim(),
      category: form.category as any,
      make_model: form.make_model || null,
      serial_number: form.serial_number || null,
      purchase_date: form.purchase_date || null,
      purchase_value: form.purchase_value ? Number(form.purchase_value) : null,
      current_location: form.current_location || null,
      service_interval_days: form.service_interval_days ? Number(form.service_interval_days) : null,
      last_service_date: form.last_service_date || null,
      warranty_expiry: form.warranty_expiry || null,
      notes: form.notes || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Asset added");
    onSaved();
  };

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle>Add Fixed Asset</DialogTitle></DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Asset Name *</Label><Input value={form.asset_name} onChange={e => setForm({ ...form, asset_name: e.target.value })} /></div>
        <div><Label>Asset Tag *</Label><Input placeholder="e.g. HSTK-MCH-001" value={form.asset_tag} onChange={e => setForm({ ...form, asset_tag: e.target.value })} /></div>
        <div>
          <Label>Category</Label>
          <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Make / Model</Label><Input value={form.make_model} onChange={e => setForm({ ...form, make_model: e.target.value })} /></div>
        <div><Label>Serial Number</Label><Input value={form.serial_number} onChange={e => setForm({ ...form, serial_number: e.target.value })} /></div>
        <div><Label>Location</Label><Input value={form.current_location} onChange={e => setForm({ ...form, current_location: e.target.value })} /></div>
        <div><Label>Purchase Date</Label><Input type="date" value={form.purchase_date} onChange={e => setForm({ ...form, purchase_date: e.target.value })} /></div>
        <div><Label>Purchase Value (₹)</Label><Input type="number" value={form.purchase_value} onChange={e => setForm({ ...form, purchase_value: e.target.value })} /></div>
        <div><Label>Service Interval (days)</Label><Input type="number" value={form.service_interval_days} onChange={e => setForm({ ...form, service_interval_days: e.target.value })} /></div>
        <div><Label>Last Service Date</Label><Input type="date" value={form.last_service_date} onChange={e => setForm({ ...form, last_service_date: e.target.value })} /></div>
        <div><Label>Warranty Expiry</Label><Input type="date" value={form.warranty_expiry} onChange={e => setForm({ ...form, warranty_expiry: e.target.value })} /></div>
        <div className="col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Asset"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function AddToolDialog({ onSaved }: { onSaved: () => void }) {
  const [form, setForm] = useState({ item_name: "", qty_total: "0", qty_in_use: "0", location: "", condition: "good", notes: "" });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.item_name.trim()) { toast.error("Item name required"); return; }
    const total = Number(form.qty_total);
    const inUse = Number(form.qty_in_use);
    if (inUse > total) { toast.error("In-use cannot exceed total"); return; }
    setSaving(true);
    const { error } = await supabase.from("tools_inventory").insert({
      item_name: form.item_name.trim(),
      qty_total: total,
      qty_in_use: inUse,
      location: form.location || null,
      condition: form.condition as any,
      notes: form.notes || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Tool added");
    onSaved();
  };

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Add Tool</DialogTitle></DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><Label>Item Name *</Label><Input value={form.item_name} onChange={e => setForm({ ...form, item_name: e.target.value })} /></div>
        <div><Label>Qty Total</Label><Input type="number" value={form.qty_total} onChange={e => setForm({ ...form, qty_total: e.target.value })} /></div>
        <div><Label>Qty In Use</Label><Input type="number" value={form.qty_in_use} onChange={e => setForm({ ...form, qty_in_use: e.target.value })} /></div>
        <div><Label>Location</Label><Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></div>
        <div>
          <Label>Condition</Label>
          <Select value={form.condition} onValueChange={v => setForm({ ...form, condition: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CONDITIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Tool"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function ToolRow({ tool, canEdit, onChange }: { tool: Tool; canEdit: boolean; onChange: () => void }) {
  const [inUse, setInUse] = useState(tool.qty_in_use);
  const [total, setTotal] = useState(tool.qty_total);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (inUse > total) { toast.error("In-use cannot exceed total"); return; }
    if (inUse === tool.qty_in_use && total === tool.qty_total) return;
    setSaving(true);
    const { error } = await supabase.from("tools_inventory").update({ qty_in_use: inUse, qty_total: total }).eq("id", tool.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Updated");
    onChange();
  };

  return (
    <TableRow>
      <TableCell className="font-medium">{tool.item_name}</TableCell>
      <TableCell className="text-right">
        {canEdit ? <Input type="number" className="w-20 text-right ml-auto" value={total} onChange={e => setTotal(Number(e.target.value))} onBlur={save} /> : total}
      </TableCell>
      <TableCell className="text-right">
        {canEdit ? <Input type="number" className="w-20 text-right ml-auto" value={inUse} onChange={e => setInUse(Number(e.target.value))} onBlur={save} /> : inUse}
      </TableCell>
      <TableCell className="text-right font-medium">{Math.max(total - inUse, 0)}</TableCell>
      <TableCell className="text-sm">{tool.location || "—"}</TableCell>
      <TableCell><Badge variant="outline">{tool.condition}</Badge></TableCell>
      {canEdit && <TableCell>{saving && <Loader2 className="h-3 w-3 animate-spin" />}</TableCell>}
    </TableRow>
  );
}

function ServiceHistorySheet({ assetId, assetName, canLog, onChange }: { assetId: string; assetName: string; canLog: boolean; onChange: () => void }) {
  const [logs, setLogs] = useState<ServiceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLog, setShowLog] = useState(false);
  const [form, setForm] = useState({ service_date: format(new Date(), "yyyy-MM-dd"), service_type: "", done_by: "", cost: "", next_service_date_override: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("fixed_asset_service_log").select("*").eq("asset_id", assetId).order("service_date", { ascending: false });
    setLogs((data as ServiceLog[]) || []);
    setLoading(false);
  }, [assetId]);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!form.service_type.trim()) { toast.error("Service type required"); return; }
    setSaving(true);
    const { error } = await supabase.from("fixed_asset_service_log").insert({
      asset_id: assetId,
      service_date: form.service_date,
      service_type: form.service_type.trim(),
      done_by: form.done_by || null,
      cost: form.cost ? Number(form.cost) : null,
      next_service_date_override: form.next_service_date_override || null,
      notes: form.notes || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Service logged");
    setShowLog(false);
    setForm({ service_date: format(new Date(), "yyyy-MM-dd"), service_type: "", done_by: "", cost: "", next_service_date_override: "", notes: "" });
    load();
    onChange();
  };

  return (
    <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
      <SheetHeader><SheetTitle>Service History — {assetName}</SheetTitle></SheetHeader>
      {canLog && (
        <div className="my-4">
          {!showLog ? (
            <Button size="sm" onClick={() => setShowLog(true)}><Plus className="h-4 w-4 mr-1" /> Log Service</Button>
          ) : (
            <Card><CardContent className="p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Date</Label><Input type="date" value={form.service_date} onChange={e => setForm({ ...form, service_date: e.target.value })} /></div>
                <div><Label className="text-xs">Type *</Label><Input value={form.service_type} onChange={e => setForm({ ...form, service_type: e.target.value })} placeholder="e.g. Annual" /></div>
                <div><Label className="text-xs">Done By</Label><Input value={form.done_by} onChange={e => setForm({ ...form, done_by: e.target.value })} /></div>
                <div><Label className="text-xs">Cost (₹)</Label><Input type="number" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} /></div>
                <div className="col-span-2"><Label className="text-xs">Next Due Override</Label><Input type="date" value={form.next_service_date_override} onChange={e => setForm({ ...form, next_service_date_override: e.target.value })} /></div>
                <div className="col-span-2"><Label className="text-xs">Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button size="sm" variant="ghost" onClick={() => setShowLog(false)}>Cancel</Button>
                <Button size="sm" onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}</Button>
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
              <span className="font-medium">{log.service_type}</span>
              <span className="text-xs text-muted-foreground">{format(parseISO(log.service_date), "dd/MM/yyyy")}</span>
            </div>
            {log.done_by && <div className="text-xs text-muted-foreground">By: {log.done_by}</div>}
            {log.cost != null && <div className="text-xs">Cost: ₹{log.cost.toLocaleString("en-IN")}</div>}
            {log.notes && <div className="text-xs mt-1">{log.notes}</div>}
          </CardContent></Card>
        ))}
      </div>
    </SheetContent>
  );
}
