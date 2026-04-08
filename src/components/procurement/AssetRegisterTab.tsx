import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthedClient } from "@/lib/auth-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Plus, AlertTriangle, Wrench } from "lucide-react";
import { toast } from "sonner";
import { format, differenceInDays, addDays } from "date-fns";

interface Asset {
  id: string;
  asset_id: string;
  asset_name: string;
  category: string;
  condition: string;
  current_location: string;
  assigned_project_id: string | null;
  dispatch_date: string | null;
  expected_return_date: string | null;
  actual_return_date: string | null;
  status: string;
  notes: string | null;
  created_at: string;
}

const STATUS_STYLES: Record<string, { label: string; bg: string; color: string }> = {
  in_factory: { label: "In Factory", bg: "#E8F2ED", color: "#006039" },
  on_site: { label: "On Site", bg: "#FFF3CD", color: "#856404" },
  overdue_return: { label: "Overdue Return", bg: "#FDE8E8", color: "#F40009" },
  under_maintenance: { label: "Under Maintenance", bg: "#F7F7F7", color: "#666666" },
};

const CONDITION_OPTIONS = [
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "damaged", label: "Damaged" },
  { value: "under_maintenance", label: "Under Maintenance" },
];

const CATEGORY_OPTIONS = [
  { value: "factory_permanent", label: "Factory Permanent" },
  { value: "site_mobile", label: "Site Mobile" },
];

const EDITOR_ROLES = ["stores_executive", "procurement", "super_admin", "managing_director"];

interface Props {
  userRole: string | null;
}

export function AssetRegisterTab({ userRole }: Props) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [projectsMap, setProjectsMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [form, setForm] = useState({
    asset_name: "", category: "site_mobile", condition: "good", notes: "",
  });

  const canEdit = EDITOR_ROLES.includes(userRole || "");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [assetRes, projRes] = await Promise.all([
      supabase.from("asset_register").select("*").order("asset_id"),
      supabase.from("projects").select("id, name").eq("is_archived", false),
    ]);
    const pm: Record<string, string> = {};
    (projRes.data || []).forEach((p: any) => { pm[p.id] = p.name; });
    setProjectsMap(pm);

    // Compute overdue status
    const today = new Date();
    const processed = (assetRes.data || []).map((a: any) => {
      if (a.status === "on_site" && a.expected_return_date && differenceInDays(today, new Date(a.expected_return_date)) > 0) {
        return { ...a, status: "overdue_return" };
      }
      return a;
    });
    setAssets(processed as Asset[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAdd = async () => {
    if (!form.asset_name.trim()) { toast.error("Asset name required"); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      // Generate asset ID
      const count = assets.length + 1;
      const assetId = `ASSET-${String(count).padStart(3, "0")}`;
      const { client } = await getAuthedClient();
      const { error } = await (client.from("asset_register") as any).insert({
        asset_id: assetId,
        asset_name: form.asset_name.trim(),
        category: form.category,
        condition: form.condition,
        notes: form.notes.trim() || null,
        status: "in_factory",
        current_location: "factory",
      });
      if (error) throw error;
      toast.success(`Asset ${assetId} added`);
      setDialogOpen(false);
      setForm({ asset_name: "", category: "site_mobile", condition: "good", notes: "" });
      fetchData();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleConfirmReturn = async (asset: Asset) => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { client } = await getAuthedClient();
      const { error } = await (client.from("asset_register") as any)
        .update({
          status: "in_factory",
          current_location: "factory",
          actual_return_date: new Date().toISOString().slice(0, 10),
          assigned_project_id: null,
        })
        .eq("id", asset.id);
      if (error) throw error;
      toast.success(`${asset.asset_name} returned to factory`);
      fetchData();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const filteredAssets = filter === "all" ? assets : assets.filter(a => a.status === filter);

  const overdueCount = assets.filter(a => a.status === "overdue_return").length;
  const onSiteCount = assets.filter(a => a.status === "on_site" || a.status === "overdue_return").length;
  const maintenanceCount = assets.filter(a => a.condition === "under_maintenance").length;

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" style={{ color: "#666" }} /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Assets", value: assets.length, color: "#1A1A1A", bg: "#F7F7F7" },
          { label: "On Site", value: onSiteCount, color: onSiteCount > 0 ? "#856404" : "#1A1A1A", bg: onSiteCount > 0 ? "#FFF3CD" : "#F7F7F7" },
          { label: "Overdue Returns", value: overdueCount, color: overdueCount > 0 ? "#F40009" : "#1A1A1A", bg: overdueCount > 0 ? "#FDE8E8" : "#F7F7F7" },
          { label: "Under Maintenance", value: maintenanceCount, color: "#666", bg: "#F7F7F7" },
        ].map(t => (
          <div key={t.label} className="rounded-lg p-3" style={{ backgroundColor: t.bg }}>
            <p className="text-xl font-bold" style={{ color: t.color }}>{t.value}</p>
            <p className="text-[11px] font-medium mt-0.5" style={{ color: "#666" }}>{t.label}</p>
          </div>
        ))}
      </div>

      {/* Overdue alerts */}
      {overdueCount > 0 && (
        <Card className="border-l-4" style={{ borderLeftColor: "#F40009", borderColor: "#E0E0E0" }}>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" style={{ color: "#F40009" }} />
              <p className="text-sm font-medium" style={{ color: "#F40009" }}>
                {overdueCount} tool(s) overdue for return from site
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          {[
            { value: "all", label: "All" },
            { value: "in_factory", label: "In Factory" },
            { value: "on_site", label: "On Site" },
            { value: "overdue_return", label: "Overdue" },
            { value: "under_maintenance", label: "Maintenance" },
          ].map(f => (
            <Button
              key={f.value}
              size="sm"
              variant={filter === f.value ? "default" : "outline"}
              className="text-xs"
              onClick={() => setFilter(f.value)}
              style={filter === f.value ? { backgroundColor: "#006039" } : {}}
            >
              {f.label}
            </Button>
          ))}
        </div>
        {canEdit && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" style={{ backgroundColor: "#006039" }}>
                <Plus className="h-4 w-4 mr-1" /> Add Asset
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="font-display">Add New Asset</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Asset Name *</Label>
                  <Input value={form.asset_name} onChange={e => setForm(f => ({ ...f, asset_name: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Category</Label>
                  <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Condition</Label>
                  <Select value={form.condition} onValueChange={v => setForm(f => ({ ...f, condition: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CONDITION_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Notes</Label>
                  <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="mt-1" />
                </div>
                <Button onClick={handleAdd} disabled={saving} className="w-full" style={{ backgroundColor: "#006039" }}>
                  {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Add Asset
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Table */}
      <Card className="border" style={{ borderColor: "#E0E0E0" }}>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow style={{ backgroundColor: "#F7F7F7" }}>
                {["Asset ID", "Name", "Category", "Condition", "Location", "Project", "Dispatched", "Expected Return", "Status", canEdit ? "Action" : ""].filter(Boolean).map(h => (
                  <TableHead key={h} className="text-xs font-semibold whitespace-nowrap" style={{ color: "#666" }}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAssets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canEdit ? 10 : 9} className="text-center py-8" style={{ color: "#999" }}>
                    No assets found
                  </TableCell>
                </TableRow>
              ) : filteredAssets.map(a => {
                const st = STATUS_STYLES[a.status] || STATUS_STYLES.in_factory;
                const isOverdue = a.status === "overdue_return";
                const daysOverdue = a.expected_return_date ? differenceInDays(new Date(), new Date(a.expected_return_date)) : 0;

                return (
                  <TableRow key={a.id}>
                    <TableCell className="text-xs font-mono font-semibold" style={{ color: "#1A1A1A" }}>{a.asset_id}</TableCell>
                    <TableCell className="text-sm font-medium whitespace-nowrap" style={{ color: "#1A1A1A" }}>{a.asset_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {a.category === "factory_permanent" ? "Permanent" : "Mobile"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs capitalize" style={{ color: a.condition === "damaged" ? "#F40009" : "#666" }}>
                      {a.condition === "under_maintenance" && <Wrench className="h-3 w-3 inline mr-1" />}
                      {a.condition.replace("_", " ")}
                    </TableCell>
                    <TableCell className="text-xs" style={{ color: "#666" }}>{a.current_location}</TableCell>
                    <TableCell className="text-xs" style={{ color: "#666" }}>
                      {a.assigned_project_id ? (projectsMap[a.assigned_project_id] || "—") : "—"}
                    </TableCell>
                    <TableCell className="text-xs" style={{ color: "#666" }}>
                      {a.dispatch_date ? format(new Date(a.dispatch_date), "dd/MM/yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap" style={{ color: isOverdue ? "#F40009" : "#666", fontWeight: isOverdue ? 600 : 400 }}>
                      {a.expected_return_date ? format(new Date(a.expected_return_date), "dd/MM/yyyy") : "—"}
                      {isOverdue && <span className="ml-1">({daysOverdue}d late)</span>}
                    </TableCell>
                    <TableCell>
                      <Badge className="text-[10px]" style={{ backgroundColor: st.bg, color: st.color, border: "none" }}>
                        {st.label}
                      </Badge>
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        {(a.status === "on_site" || a.status === "overdue_return") && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7"
                            onClick={() => handleConfirmReturn(a)}
                            disabled={saving}
                            style={{ borderColor: "#006039", color: "#006039" }}
                          >
                            Confirm Return
                          </Button>
                        )}
                      </TableCell>
                    )}
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
