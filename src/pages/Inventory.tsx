import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsWrapper } from "@/components/ui/scrollable-tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Package, FileText, Plus } from "lucide-react";
import { toast } from "sonner";
import { getAuthedClient } from "@/lib/auth-client";

interface InventoryItem {
  id: string;
  material_name: string;
  category: string;
  current_stock: number;
  unit: string;
  reorder_level: number;
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

function AddInventoryItemDialog({ onCreated, canAdd }: { onCreated: () => void; canAdd: boolean }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    material_name: "",
    category: "",
    current_stock: "",
    unit: "units",
    reorder_level: "",
  });

  const handleSubmit = async () => {
    if (!form.material_name.trim() || !form.category.trim()) {
      toast.error("Material name and category are required.");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { client } = await getAuthedClient();
      const { error } = await (client.from("inventory_items" as any) as any).insert({
        material_name: form.material_name.trim(),
        category: form.category.trim(),
        current_stock: Number(form.current_stock) || 0,
        unit: form.unit.trim() || "units",
        reorder_level: Number(form.reorder_level) || 0,
        created_by: user.id,
      });

      if (error) throw error;

      toast.success("Inventory item added");
      setOpen(false);
      setForm({ material_name: "", category: "", current_stock: "", unit: "units", reorder_level: "" });
      onCreated();
    } catch (err: any) {
      toast.error(err.message || "Failed to add item");
    } finally {
      setLoading(false);
    }
  };

  if (!canAdd) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" /> Add Item
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Inventory Item</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Material Name</Label>
            <Input value={form.material_name} onChange={(e) => setForm((prev) => ({ ...prev, material_name: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Input value={form.category} onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Current Stock</Label>
              <Input type="number" value={form.current_stock} onChange={(e) => setForm((prev) => ({ ...prev, current_stock: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Unit</Label>
              <Input value={form.unit} onChange={(e) => setForm((prev) => ({ ...prev, unit: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Reorder Level</Label>
            <Input type="number" value={form.reorder_level} onChange={(e) => setForm((prev) => ({ ...prev, reorder_level: e.target.value }))} />
          </div>
          <Button onClick={handleSubmit} disabled={loading} className="w-full">
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Save Item
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddPurchaseOrderDialog({ onCreated, canAdd }: { onCreated: () => void; canAdd: boolean }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    vendor_name: "",
    items_summary: "",
    amount: "",
    status: "Pending",
    po_date: new Date().toISOString().slice(0, 10),
  });

  const handleSubmit = async () => {
    if (!form.vendor_name.trim() || !form.items_summary.trim()) {
      toast.error("Vendor and items are required.");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { client } = await getAuthedClient();
      const { error } = await (client.from("purchase_orders" as any) as any).insert({
        vendor_name: form.vendor_name.trim(),
        items_summary: form.items_summary.trim(),
        amount: Number(form.amount) || 0,
        status: form.status.toLowerCase(),
        po_date: form.po_date,
        raised_by: user.id,
      });

      if (error) throw error;

      toast.success("Purchase order added");
      setOpen(false);
      setForm({ vendor_name: "", items_summary: "", amount: "", status: "Pending", po_date: new Date().toISOString().slice(0, 10) });
      onCreated();
    } catch (err: any) {
      toast.error(err.message || "Failed to add purchase order");
    } finally {
      setLoading(false);
    }
  };

  if (!canAdd) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" /> Add PO
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Purchase Order</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Vendor</Label>
            <Input value={form.vendor_name} onChange={(e) => setForm((prev) => ({ ...prev, vendor_name: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Items</Label>
            <Input value={form.items_summary} onChange={(e) => setForm((prev) => ({ ...prev, items_summary: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input type="number" value={form.amount} onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={form.po_date} onChange={(e) => setForm((prev) => ({ ...prev, po_date: e.target.value }))} />
            </div>
          </div>
          <Button onClick={handleSubmit} disabled={loading} className="w-full">
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Save PO
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Inventory() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);

    const rolePromise = supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return null;
      const { data } = await supabase.rpc("get_user_role", { _user_id: user.id });
      return data;
    });

    const [{ data: itemsData }, { data: purchaseOrdersData }, role] = await Promise.all([
      (supabase.from("inventory_items" as any) as any)
        .select("*")
        .eq("is_archived", false)
        .order("material_name", { ascending: true }),
      (supabase.from("purchase_orders" as any) as any)
        .select("*")
        .eq("is_archived", false)
        .order("po_date", { ascending: false }),
      rolePromise,
    ]);

    setItems((itemsData ?? []) as InventoryItem[]);
    setPurchaseOrders((purchaseOrdersData ?? []) as PurchaseOrder[]);
    setUserRole(role as string | null);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const canAddItem = STOCK_CREATOR_ROLES.includes(userRole ?? "");
  const canAddPurchaseOrder = PO_CREATOR_ROLES.includes(userRole ?? "");

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Inventory</h1>
        <p className="text-muted-foreground text-sm mt-1">Material stock and purchase order oversight</p>
      </div>

      <Tabs defaultValue="stock" className="space-y-4">
        <ScrollableTabsWrapper>
          <TabsList>
            <TabsTrigger value="stock" className="gap-1.5">
              <Package className="h-4 w-4" /> Stock
            </TabsTrigger>
            <TabsTrigger value="purchase-orders" className="gap-1.5">
              <FileText className="h-4 w-4" /> Purchase Orders
            </TabsTrigger>
          </TabsList>
        </ScrollableTabsWrapper>

        <TabsContent value="stock" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold text-foreground">Stock</h2>
            <AddInventoryItemDialog onCreated={fetchData} canAdd={canAddItem} />
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : items.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center space-y-4">
                <p className="text-sm text-muted-foreground">No inventory items yet.</p>
                {canAddItem && <AddInventoryItemDialog onCreated={fetchData} canAdd={canAddItem} />}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Current Stock</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Reorder Level</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => {
                      const isLowStock = Number(item.current_stock) <= Number(item.reorder_level);
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium text-foreground">{item.material_name}</TableCell>
                          <TableCell>{item.category}</TableCell>
                          <TableCell>{item.current_stock}</TableCell>
                          <TableCell>{item.unit}</TableCell>
                          <TableCell>{item.reorder_level}</TableCell>
                          <TableCell>
                            {isLowStock ? (
                              <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">LOW STOCK</Badge>
                            ) : (
                              <Badge variant="outline" className="bg-success/10 text-success border-success/30">Healthy</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="purchase-orders" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold text-foreground">Purchase Orders</h2>
            <AddPurchaseOrderDialog onCreated={fetchData} canAdd={canAddPurchaseOrder} />
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : purchaseOrders.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center space-y-4">
                <p className="text-sm text-muted-foreground">No purchase orders yet.</p>
                {canAddPurchaseOrder && <AddPurchaseOrderDialog onCreated={fetchData} canAdd={canAddPurchaseOrder} />}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Raised By</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchaseOrders.map((po) => (
                      <TableRow key={po.id}>
                        <TableCell className="font-medium text-foreground">{po.vendor_name}</TableCell>
                        <TableCell className="max-w-[280px] truncate">{po.items_summary}</TableCell>
                        <TableCell>₹{Number(po.amount).toLocaleString("en-IN")}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize bg-accent/10 text-accent-foreground border-border">
                            {po.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{po.raised_by ?? "—"}</TableCell>
                        <TableCell>{new Date(po.po_date).toLocaleDateString("en-GB")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
