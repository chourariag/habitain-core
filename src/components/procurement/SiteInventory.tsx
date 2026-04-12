import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Plus, RotateCcw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { insertNotifications } from "@/lib/notifications";

export function SiteInventory({ projectId }: { projectId?: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [returnQty, setReturnQty] = useState("");
  const [returnNote, setReturnNote] = useState("");
  const [form, setForm] = useState({
    item_name: "",
    category: "",
    quantity: "",
    unit: "units",
    dispatched_to: "",
  });
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const query = (supabase.from("site_inventory" as any) as any)
      .select("*")
      .eq("is_archived", false)
      .order("created_at", { ascending: false });
    if (projectId) query.eq("project_id", projectId);
    const { data } = await query;
    setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null);
    });
  }, [projectId]);

  const handleCreate = async () => {
    if (!form.item_name || !form.quantity) { toast.error("Item name and quantity required"); return; }
    setSaving(true);
    const { error } = await (supabase.from("site_inventory" as any) as any).insert({
      project_id: projectId ?? null,
      item_name: form.item_name,
      category: form.category || null,
      quantity: parseFloat(form.quantity),
      quantity_remaining: parseFloat(form.quantity),
      unit: form.unit,
      dispatched_to: form.dispatched_to || null,
      dispatched_by: userId,
      dispatched_at: new Date().toISOString(),
    });
    if (error) { toast.error(error.message); } else {
      toast.success("Item added to site inventory");
      setAddOpen(false);
      setForm({ item_name: "", category: "", quantity: "", unit: "units", dispatched_to: "" });
      fetchData();
    }
    setSaving(false);
  };

  const handleReturn = async () => {
    if (!selectedItem || !returnQty) { toast.error("Return quantity required"); return; }
    const qty = parseFloat(returnQty);
    if (qty > selectedItem.quantity_remaining) {
      toast.error("Cannot return more than remaining quantity");
      return;
    }
    setSaving(true);
    const newRemaining = selectedItem.quantity_remaining - qty;
    const { error } = await (supabase.from("site_inventory" as any) as any)
      .update({
        quantity_remaining: newRemaining,
        last_return_qty: qty,
        last_return_at: new Date().toISOString(),
        last_return_note: returnNote || null,
        returned_by: userId,
        is_archived: newRemaining <= 0,
      })
      .eq("id", selectedItem.id);

    if (error) { toast.error(error.message); setSaving(false); return; }

    // Notify stores team of return
    const { data: stores } = await supabase
      .from("profiles")
      .select("auth_user_id")
      .eq("role", "stores_executive" as any)
      .eq("is_active", true);
    for (const u of stores ?? []) {
      await insertNotifications({
        recipient_id: u.auth_user_id,
        title: "Site Inventory Return",
        body: `${qty} ${selectedItem.unit} of "${selectedItem.item_name}" returned from site. Remaining: ${newRemaining} ${selectedItem.unit}.`,
        category: "procurement",
        related_table: "site_inventory",
        related_id: selectedItem.id,
      });
    }

    toast.success("Return recorded — stores team notified");
    setReturnOpen(false);
    setSelectedItem(null);
    setReturnQty("");
    setReturnNote("");
    fetchData();
    setSaving(false);
  };

  const openReturn = (item: any) => {
    setSelectedItem(item);
    setReturnQty("");
    setReturnNote("");
    setReturnOpen(true);
  };

  if (loading) {
    return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  const lowStock = items.filter((i) => i.quantity_remaining < i.quantity * 0.2);

  return (
    <div className="space-y-4">
      {lowStock.length > 0 && (
        <div className="flex items-start gap-2 rounded-md p-3 text-sm" style={{ backgroundColor: "#FFF8E8", color: "#D4860A" }}>
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>{lowStock.length} item(s) at low stock (&lt;20% remaining). Consider restocking.</p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold" style={{ color: "#1A1A1A" }}>Site Inventory ({items.length})</p>
        <Button size="sm" onClick={() => setAddOpen(true)} style={{ backgroundColor: "#006039" }} className="text-white">
          <Plus className="h-3.5 w-3.5 mr-1" /> Dispatch to Site
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-10 text-sm text-muted-foreground">No items dispatched to site.</div>
      ) : (
        <div className="space-y-2">
          {items.map((item: any) => {
            const pct = item.quantity > 0 ? Math.round((item.quantity_remaining / item.quantity) * 100) : 0;
            const isLow = pct < 20;
            const color = isLow ? "#F40009" : pct < 50 ? "#D4860A" : "#006039";

            return (
              <Card key={item.id}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-medium text-sm" style={{ color: "#1A1A1A" }}>{item.item_name}</p>
                      {item.category && <p className="text-xs" style={{ color: "#666" }}>{item.category}</p>}
                      {item.dispatched_to && <p className="text-xs" style={{ color: "#999" }}>Dispatched to: {item.dispatched_to}</p>}
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="flex-1 bg-muted rounded-full h-1.5">
                          <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                        </div>
                        <span className="text-xs font-medium" style={{ color }}>
                          {item.quantity_remaining}/{item.quantity} {item.unit}
                        </span>
                      </div>
                      {item.last_return_at && (
                        <p className="text-[10px] mt-1" style={{ color: "#999" }}>
                          Last return: {format(new Date(item.last_return_at), "dd/MM/yyyy")} ({item.last_return_qty} {item.unit})
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <Badge variant="outline" className="text-[10px]" style={{ color, borderColor: color }}>
                        {pct}% remaining
                      </Badge>
                      {item.quantity_remaining > 0 && (
                        <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => openReturn(item)}>
                          <RotateCcw className="h-3 w-3 mr-1" /> Return
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Item Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Dispatch to Site</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Item Name *</Label>
                <Input value={form.item_name} onChange={(e) => setForm((f) => ({ ...f, item_name: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Category</Label>
                <Input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className="mt-1" placeholder="e.g. Tools" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Quantity *</Label>
                <Input type="number" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Unit</Label>
                <Select value={form.unit} onValueChange={(v) => setForm((f) => ({ ...f, unit: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="units">Units</SelectItem>
                    <SelectItem value="kg">Kg</SelectItem>
                    <SelectItem value="litres">Litres</SelectItem>
                    <SelectItem value="metres">Metres</SelectItem>
                    <SelectItem value="rolls">Rolls</SelectItem>
                    <SelectItem value="bags">Bags</SelectItem>
                    <SelectItem value="sets">Sets</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Dispatched To (Location/Person)</Label>
              <Input value={form.dispatched_to} onChange={(e) => setForm((f) => ({ ...f, dispatched_to: e.target.value }))} className="mt-1" placeholder="e.g. Site Foreman, Block A" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} disabled={saving} style={{ backgroundColor: "#006039" }} className="text-white">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Dispatch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return Dialog */}
      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="font-display">Record Return</DialogTitle></DialogHeader>
          {selectedItem && (
            <div className="space-y-3">
              <div className="rounded-md p-2 text-sm" style={{ backgroundColor: "#E8F2ED", color: "#006039" }}>
                Returning: <strong>{selectedItem.item_name}</strong> — {selectedItem.quantity_remaining} {selectedItem.unit} remaining
              </div>
              <div>
                <Label className="text-xs">Quantity Returned *</Label>
                <Input
                  type="number"
                  value={returnQty}
                  max={selectedItem.quantity_remaining}
                  onChange={(e) => setReturnQty(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Notes (optional)</Label>
                <Input value={returnNote} onChange={(e) => setReturnNote(e.target.value)} className="mt-1" placeholder="Condition, reason..." />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={handleReturn} disabled={saving} style={{ backgroundColor: "#006039" }} className="text-white">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Record Return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
