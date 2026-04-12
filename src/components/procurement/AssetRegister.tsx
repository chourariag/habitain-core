import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Plus, Factory, Truck } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type AssetType = "factory_permanent" | "site_mobile";

const ASSET_TYPE_CONFIG: Record<AssetType, { label: string; color: string; bg: string; icon: typeof Factory }> = {
  factory_permanent: { label: "Factory (Permanent)", color: "#006039", bg: "#E8F2ED", icon: Factory },
  site_mobile: { label: "Site (Mobile)", color: "#4F46E5", bg: "#EEF2FF", icon: Truck },
};

const CONDITION_COLORS: Record<string, string> = {
  good: "#006039",
  fair: "#D4860A",
  poor: "#F40009",
  under_repair: "#B45309",
};

export function AssetRegister() {
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [filter, setFilter] = useState<AssetType | "all">("all");
  const [form, setForm] = useState({
    asset_name: "",
    asset_code: "",
    asset_type: "factory_permanent" as AssetType,
    category: "",
    purchase_date: "",
    purchase_value: "",
    condition: "good",
    location: "",
  });
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const { data } = await (supabase.from("asset_register" as any) as any)
      .select("*")
      .eq("is_archived", false)
      .order("asset_type", { ascending: true });
    setAssets(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreate = async () => {
    if (!form.asset_name || !form.asset_type) { toast.error("Asset name and type required"); return; }
    setSaving(true);
    const { error } = await (supabase.from("asset_register" as any) as any).insert({
      asset_name: form.asset_name,
      asset_code: form.asset_code || null,
      asset_type: form.asset_type,
      category: form.category || null,
      purchase_date: form.purchase_date || null,
      purchase_value: form.purchase_value ? parseFloat(form.purchase_value) : null,
      condition: form.condition,
      location: form.location || null,
    });
    if (error) { toast.error(error.message); } else {
      toast.success("Asset registered");
      setAddOpen(false);
      setForm({ asset_name: "", asset_code: "", asset_type: "factory_permanent", category: "", purchase_date: "", purchase_value: "", condition: "good", location: "" });
      fetchData();
    }
    setSaving(false);
  };

  const handleConditionUpdate = async (id: string, condition: string) => {
    await (supabase.from("asset_register" as any) as any).update({ condition }).eq("id", id);
    toast.success("Condition updated");
    fetchData();
  };

  const filtered = filter === "all" ? assets : assets.filter((a) => a.asset_type === filter);
  const factoryCount = assets.filter((a) => a.asset_type === "factory_permanent").length;
  const siteCount = assets.filter((a) => a.asset_type === "site_mobile").length;

  if (loading) {
    return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-md border border-border p-0.5 bg-muted/30">
            <Button variant="ghost" size="sm" className={`h-7 text-xs ${filter === "all" ? "bg-background shadow-sm" : ""}`} onClick={() => setFilter("all")}>
              All ({assets.length})
            </Button>
            <Button variant="ghost" size="sm" className={`h-7 text-xs ${filter === "factory_permanent" ? "bg-background shadow-sm" : ""}`} onClick={() => setFilter("factory_permanent")}>
              <Factory className="h-3.5 w-3.5 mr-1" /> Factory ({factoryCount})
            </Button>
            <Button variant="ghost" size="sm" className={`h-7 text-xs ${filter === "site_mobile" ? "bg-background shadow-sm" : ""}`} onClick={() => setFilter("site_mobile")}>
              <Truck className="h-3.5 w-3.5 mr-1" /> Site ({siteCount})
            </Button>
          </div>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)} style={{ backgroundColor: "#006039" }} className="text-white">
          <Plus className="h-3.5 w-3.5 mr-1" /> Register Asset
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-10 text-sm text-muted-foreground">No assets registered.</div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {filtered.map((a: any) => {
            const typeConfig = ASSET_TYPE_CONFIG[a.asset_type as AssetType] ?? ASSET_TYPE_CONFIG.factory_permanent;
            const condColor = CONDITION_COLORS[a.condition] ?? "#666";
            return (
              <Card key={a.id}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-[10px]" style={{ color: typeConfig.color, borderColor: typeConfig.color, backgroundColor: typeConfig.bg }}>
                          <typeConfig.icon className="h-2.5 w-2.5 mr-1" />
                          {typeConfig.label}
                        </Badge>
                      </div>
                      <p className="font-medium text-sm" style={{ color: "#1A1A1A" }}>{a.asset_name}</p>
                      {a.asset_code && <p className="text-[10px] font-mono" style={{ color: "#999" }}>{a.asset_code}</p>}
                      {a.category && <p className="text-xs" style={{ color: "#666" }}>{a.category}</p>}
                      {a.location && <p className="text-xs" style={{ color: "#666" }}>Location: {a.location}</p>}
                      {a.purchase_value && (
                        <p className="text-xs" style={{ color: "#006039" }}>₹{Number(a.purchase_value).toLocaleString("en-IN")}</p>
                      )}
                      {a.purchase_date && (
                        <p className="text-[10px]" style={{ color: "#999" }}>Purchased: {format(new Date(a.purchase_date), "dd/MM/yyyy")}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <Badge variant="outline" className="text-[10px]" style={{ color: condColor, borderColor: condColor }}>
                        {a.condition.replace(/_/g, " ")}
                      </Badge>
                      <Select value={a.condition} onValueChange={(v) => handleConditionUpdate(a.id, v)}>
                        <SelectTrigger className="h-6 text-[10px] w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="good">Good</SelectItem>
                          <SelectItem value="fair">Fair</SelectItem>
                          <SelectItem value="poor">Poor</SelectItem>
                          <SelectItem value="under_repair">Under Repair</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Register Asset</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Asset Name *</Label>
                <Input value={form.asset_name} onChange={(e) => setForm((f) => ({ ...f, asset_name: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Asset Code</Label>
                <Input value={form.asset_code} onChange={(e) => setForm((f) => ({ ...f, asset_code: e.target.value }))} className="mt-1" placeholder="e.g. AST-001" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Asset Type *</Label>
              <Select value={form.asset_type} onValueChange={(v) => setForm((f) => ({ ...f, asset_type: v as AssetType }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="factory_permanent">Factory (Permanent)</SelectItem>
                  <SelectItem value="site_mobile">Site (Mobile)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Category</Label>
                <Input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className="mt-1" placeholder="e.g. Power Tool" />
              </div>
              <div>
                <Label className="text-xs">Condition</Label>
                <Select value={form.condition} onValueChange={(v) => setForm((f) => ({ ...f, condition: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="good">Good</SelectItem>
                    <SelectItem value="fair">Fair</SelectItem>
                    <SelectItem value="poor">Poor</SelectItem>
                    <SelectItem value="under_repair">Under Repair</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Location</Label>
              <Input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} className="mt-1" placeholder="e.g. Bay 3, Factory Floor" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Purchase Date</Label>
                <Input type="date" value={form.purchase_date} onChange={(e) => setForm((f) => ({ ...f, purchase_date: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Purchase Value (₹)</Label>
                <Input type="number" value={form.purchase_value} onChange={(e) => setForm((f) => ({ ...f, purchase_value: e.target.value }))} className="mt-1" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} disabled={saving} style={{ backgroundColor: "#006039" }} className="text-white">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Register
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
