import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsWrapper } from "@/components/ui/scrollable-tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Package, FileText, Plus, Info } from "lucide-react";
import { toast } from "sonner";
import { getAuthedClient } from "@/lib/auth-client";

interface InventoryItem {
  id: string;
  material_name: string;
  category: string;
  current_stock: number;
  unit: string;
  reorder_level: number;
  delivery_destination?: string;
}

interface PurchaseOrder {
  id: string;
  vendor_name: string;
  items_summary: string;
  amount: number;
  status: string;
  raised_by: string | null;
  po_date: string;
}

const STOCK_CREATOR_ROLES = ["stores_executive", "managing_director", "super_admin"];
const PO_CREATOR_ROLES = ["procurement", "stores_executive", "managing_director", "super_admin"];

function DeliveryDestinationRadio({ value, onChange }: { value: "factory" | "site_direct"; onChange: (v: "factory" | "site_direct") => void }) {
  return (
    <div className="space-y-2">
      <Label className="font-display text-sm font-bold">Delivery Destination</Label>
      <RadioGroup value={value} onValueChange={(v) => onChange(v as "factory" | "site_direct")} className="flex gap-3">
        <label className={`flex items-center gap-2 rounded-lg border px-4 py-3 cursor-pointer transition-all ${value === "factory" ? "border-[#006039] bg-[#E8F2ED]" : "border-border bg-card"}`}>
          <RadioGroupItem value="factory" />
          <span className="text-sm font-medium">Factory / Stores</span>
        </label>
        <label className={`flex items-center gap-2 rounded-lg border px-4 py-3 cursor-pointer transition-all ${value === "site_direct" ? "border-[#D4860A] bg-[#FFF8E8]" : "border-border bg-card"}`}>
          <RadioGroupItem value="site_direct" />
          <span className="text-sm font-medium">Direct to Site</span>
        </label>
      </RadioGroup>
    </div>
  );
}

function SiteDirectInfoCard() {
  return (
    <div className="flex items-start gap-2 rounded-lg p-3" style={{ backgroundColor: "#FFF8E8", border: "1px solid #D4860A33" }}>
      <Info className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "#D4860A" }} />
      <p className="text-xs" style={{ color: "#D4860A" }}>This item will not be added to factory inventory. It will be logged directly to the site inventory for this project.</p>
    </div>
  );
}

function AddInventoryItemDialog({ onCreated, canAdd, projects }: { onCreated: () => void; canAdd: boolean; projects: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deliveryDest, setDeliveryDest] = useState<"factory" | "site_direct">("factory");
  const [form, setForm] = useState({
    material_name: "", category: "", current_stock: "", unit: "units", reorder_level: "",
    project_id: "", vendor_name: "", received_by_on_site: "", site_receipt_notes: "",
  });

  const resetForm = () => {
    setForm({ material_name: "", category: "", current_stock: "", unit: "units", reorder_level: "", project_id: "", vendor_name: "", received_by_on_site: "", site_receipt_notes: "" });
    setDeliveryDest("factory");
  };

  const handleSubmit = async () => {
    if (!form.material_name.trim() || !form.category.trim()) { toast.error("Material name and category are required."); return; }
    if (deliveryDest === "site_direct" && !form.project_id) { toast.error("Project is required for site direct delivery."); return; }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { client } = await getAuthedClient();
      if (deliveryDest === "site_direct") {
        const { error } = await (client.from("site_direct_receipts" as any) as any).insert({
          project_id: form.project_id, material_name: form.material_name.trim(), category: form.category.trim(),
          qty: Number(form.current_stock) || 0, unit: form.unit.trim() || "units",
          vendor_name: form.vendor_name.trim() || null, received_by_on_site: form.received_by_on_site.trim() || null,
          site_receipt_notes: form.site_receipt_notes.trim() || null, created_by: user.id,
        });
        if (error) throw error;
      } else {
        const { error } = await (client.from("inventory_items" as any) as any).insert({
          material_name: form.material_name.trim(), category: form.category.trim(),
          current_stock: Number(form.current_stock) || 0, unit: form.unit.trim() || "units",
          reorder_level: Number(form.reorder_level) || 0, delivery_destination: "factory",
          project_id: form.project_id || null, created_by: user.id,
        });
        if (error) throw error;
      }
      toast.success(deliveryDest === "site_direct" ? "Logged to site inventory" : "Inventory item added");
      setOpen(false);
      resetForm();
      onCreated();
    } catch (err: any) { toast.error(err.message || "Failed to add item"); } finally { setLoading(false); }
  };

  if (!canAdd) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Item</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add Inventory Item</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <DeliveryDestinationRadio value={deliveryDest} onChange={setDeliveryDest} />
          {deliveryDest === "site_direct" && <SiteDirectInfoCard />}
          <div className="space-y-2">
            <Label>{deliveryDest === "site_direct" ? "Project *" : "Project (optional)"}</Label>
            <Select value={form.project_id} onValueChange={(v) => setForm((p) => ({ ...p, project_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
              <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Material Name</Label><Input value={form.material_name} onChange={(e) => setForm((p) => ({ ...p, material_name: e.target.value }))} /></div>
          <div className="space-y-2"><Label>Category</Label><Input value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>{deliveryDest === "site_direct" ? "Quantity" : "Current Stock"}</Label><Input type="number" value={form.current_stock} onChange={(e) => setForm((p) => ({ ...p, current_stock: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Unit</Label><Input value={form.unit} onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))} /></div>
          </div>
          {deliveryDest === "factory" && (
            <div className="space-y-2"><Label>Reorder Level</Label><Input type="number" value={form.reorder_level} onChange={(e) => setForm((p) => ({ ...p, reorder_level: e.target.value }))} /></div>
          )}
          {deliveryDest === "site_direct" && (
            <>
              <div className="space-y-2"><Label>Vendor Name (optional)</Label><Input value={form.vendor_name} onChange={(e) => setForm((p) => ({ ...p, vendor_name: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Received By on Site</Label><Input value={form.received_by_on_site} onChange={(e) => setForm((p) => ({ ...p, received_by_on_site: e.target.value }))} placeholder="Name of person who received on site" /></div>
              <div className="space-y-2"><Label>Site Receipt Notes (optional)</Label><Textarea value={form.site_receipt_notes} onChange={(e) => setForm((p) => ({ ...p, site_receipt_notes: e.target.value }))} placeholder="Any notes about this delivery" rows={2} /></div>
            </>
          )}
          <Button onClick={handleSubmit} disabled={loading} className="w-full">
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            {deliveryDest === "site_direct" ? "Log Site Receipt" : "Save Item"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddPurchaseOrderDialog({ onCreated, canAdd }: { onCreated: () => void; canAdd: boolean }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ vendor_name: "", items_summary: "", amount: "", status: "Pending", po_date: new Date().toISOString().slice(0, 10) });

  const handleSubmit = async () => {
    if (!form.vendor_name.trim() || !form.items_summary.trim()) { toast.error("Vendor and items are required."); return; }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { client } = await getAuthedClient();
      const { error } = await (client.from("purchase_orders" as any) as any).insert({
        vendor_name: form.vendor_name.trim(), items_summary: form.items_summary.trim(),
        amount: Number(form.amount) || 0, status: form.status.toLowerCase(),
        po_date: form.po_date, raised_by: user.id,
      });
      if (error) throw error;
      toast.success("Purchase order added");
      setOpen(false);
      setForm({ vendor_name: "", items_summary: "", amount: "", status: "Pending", po_date: new Date().toISOString().slice(0, 10) });
      onCreated();
    } catch (err: any) { toast.error(err.message || "Failed to add purchase order"); } finally { setLoading(false); }
  };

  if (!canAdd) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add PO</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Purchase Order</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label>Vendor</Label><Input value={form.vendor_name} onChange={(e) => setForm((p) => ({ ...p, vendor_name: e.target.value }))} /></div>
          <div className="space-y-2"><Label>Items</Label><Input value={form.items_summary} onChange={(e) => setForm((p) => ({ ...p, items_summary: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Amount</Label><Input type="number" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Date</Label><Input type="date" value={form.po_date} onChange={(e) => setForm((p) => ({ ...p, po_date: e.target.value }))} /></div>
          </div>
          <Button onClick={handleSubmit} disabled={loading} className="w-full">
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Save PO
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Inventory() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [siteReceipts, setSiteReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [projectsMap, setProjectsMap] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    const rolePromise = supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return null;
      const { data } = await supabase.rpc("get_user_role", { _user_id: user.id });
      return data;
    });

    const [{ data: itemsData }, { data: poData }, { data: siteData }, { data: projData }, role] = await Promise.all([
      (supabase.from("inventory_items" as any) as any).select("*").eq("is_archived", false).order("material_name", { ascending: true }),
      (supabase.from("purchase_orders" as any) as any).select("*").eq("is_archived", false).order("po_date", { ascending: false }),
      (supabase.from("site_direct_receipts" as any) as any).select("*").order("received_at", { ascending: false }),
      supabase.from("projects").select("id,name").eq("is_archived", false),
      rolePromise,
    ]);

    setItems((itemsData ?? []) as InventoryItem[]);
    setPurchaseOrders((poData ?? []) as PurchaseOrder[]);
    setSiteReceipts(siteData ?? []);
    const pl = projData ?? [];
    setProjects(pl);
    const pm: Record<string, string> = {};
    pl.forEach((p: any) => { pm[p.id] = p.name; });
    setProjectsMap(pm);
    setUserRole(role as string | null);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const canAddItem = STOCK_CREATOR_ROLES.includes(userRole ?? "");
  const canAddPO = PO_CREATOR_ROLES.includes(userRole ?? "");

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Inventory</h1>
        <p className="text-muted-foreground text-sm mt-1">Material stock and purchase order oversight</p>
      </div>

      <Tabs defaultValue="stock" className="space-y-4">
        <ScrollableTabsWrapper>
          <TabsList>
            <TabsTrigger value="stock" className="gap-1.5"><Package className="h-4 w-4" /> Stock</TabsTrigger>
            <TabsTrigger value="purchase-orders" className="gap-1.5"><FileText className="h-4 w-4" /> Purchase Orders</TabsTrigger>
          </TabsList>
        </ScrollableTabsWrapper>

        <TabsContent value="stock" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold text-foreground">Stock</h2>
            <AddInventoryItemDialog onCreated={fetchData} canAdd={canAddItem} projects={projects} />
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : items.length === 0 && siteReceipts.length === 0 ? (
            <Card><CardContent className="py-10 text-center space-y-4">
              <p className="text-sm text-muted-foreground">No inventory items yet.</p>
              {canAddItem && <AddInventoryItemDialog onCreated={fetchData} canAdd={canAddItem} projects={projects} />}
            </CardContent></Card>
          ) : (
            <>
              {items.length > 0 && (
                <Card><CardContent className="p-0 overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Material Name</TableHead><TableHead>Category</TableHead><TableHead>Current Stock</TableHead>
                      <TableHead>Unit</TableHead><TableHead>Reorder Level</TableHead><TableHead>Destination</TableHead><TableHead>Status</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {items.map((item) => {
                        const isLow = Number(item.current_stock) <= Number(item.reorder_level);
                        return (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium text-foreground">{item.material_name}</TableCell>
                            <TableCell>{item.category}</TableCell>
                            <TableCell>{item.current_stock}</TableCell>
                            <TableCell>{item.unit}</TableCell>
                            <TableCell>{item.reorder_level}</TableCell>
                            <TableCell><span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: "#E8F2ED", color: "#006039" }}>Factory</span></TableCell>
                            <TableCell>{isLow
                              ? <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">LOW STOCK</Badge>
                              : <Badge variant="outline" className="bg-success/10 text-success border-success/30">Healthy</Badge>}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent></Card>
              )}

              {siteReceipts.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-display text-sm font-semibold text-foreground">Direct to Site Receipts</h3>
                  <Card><CardContent className="p-0 overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>Material Name</TableHead><TableHead>Project</TableHead><TableHead>Qty</TableHead>
                        <TableHead>Unit</TableHead><TableHead>Vendor</TableHead><TableHead>Destination</TableHead><TableHead>Received At</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {siteReceipts.map((r: any) => (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium text-foreground">{r.material_name}</TableCell>
                            <TableCell>{projectsMap[r.project_id] ?? "—"}</TableCell>
                            <TableCell>{r.qty}</TableCell>
                            <TableCell>{r.unit}</TableCell>
                            <TableCell>{r.vendor_name ?? "—"}</TableCell>
                            <TableCell><span className="text-xs font-medium px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: "#D4860A" }}>Site Direct</span></TableCell>
                            <TableCell>{new Date(r.received_at).toLocaleDateString("en-GB")}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent></Card>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="purchase-orders" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold text-foreground">Purchase Orders</h2>
            <AddPurchaseOrderDialog onCreated={fetchData} canAdd={canAddPO} />
          </div>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : purchaseOrders.length === 0 ? (
            <Card><CardContent className="py-10 text-center space-y-4">
              <p className="text-sm text-muted-foreground">No purchase orders yet.</p>
              {canAddPO && <AddPurchaseOrderDialog onCreated={fetchData} canAdd={canAddPO} />}
            </CardContent></Card>
          ) : (
            <Card><CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Vendor</TableHead><TableHead>Items</TableHead><TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead><TableHead>Raised By</TableHead><TableHead>Date</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {purchaseOrders.map((po) => (
                    <TableRow key={po.id}>
                      <TableCell className="font-medium text-foreground">{po.vendor_name}</TableCell>
                      <TableCell className="max-w-[280px] truncate">{po.items_summary}</TableCell>
                      <TableCell>₹{Number(po.amount).toLocaleString("en-IN")}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize bg-accent/10 text-accent-foreground border-border">{po.status}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{po.raised_by ?? "—"}</TableCell>
                      <TableCell>{new Date(po.po_date).toLocaleDateString("en-GB")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent></Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
