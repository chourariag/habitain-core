import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}

export function NewTransferDialog({ open, onOpenChange, onCreated }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [inventoryItems, setInventoryItems] = useState<string[]>([]);

  const [materialName, setMaterialName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("Nos");
  const [fromLocation, setFromLocation] = useState("");
  const [toLocation, setToLocation] = useState("");
  const [toProjectId, setToProjectId] = useState("");
  const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 10));
  const [driverDetails, setDriverDetails] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    supabase.from("projects").select("id, name").eq("is_archived", false).then(({ data }) => setProjects(data ?? []));
    (supabase as any).from("grn_entries").select("material_name").then(({ data }: any) => {
      const unique = [...new Set((data ?? []).map((d: any) => d.material_name).filter(Boolean))] as string[];
      setInventoryItems(unique.sort());
    });
  }, [open]);

  const reset = () => {
    setMaterialName(""); setQuantity(""); setUnit("Nos");
    setFromLocation(""); setToLocation(""); setToProjectId("");
    setTransferDate(new Date().toISOString().slice(0, 10));
    setDriverDetails(""); setNotes("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!materialName.trim() || !quantity || !fromLocation || !toLocation || !user) {
      toast.error("Please fill all required fields"); return;
    }
    setLoading(true);
    try {
      const { error } = await (supabase.from("material_transfers") as any).insert({
        material_name: materialName.trim(),
        quantity: Number(quantity),
        unit,
        from_location: fromLocation,
        to_location: toLocation,
        to_project_id: toProjectId || null,
        transfer_date: transferDate,
        driver_details: driverDetails.trim() || null,
        notes: notes.trim() || null,
        status: "in_transit",
        created_by: user.id,
      });
      if (error) throw error;
      toast.success("Transfer created — status: In Transit");
      reset();
      onOpenChange(false);
      onCreated();
    } catch (err: any) {
      toast.error(err.message || "Failed to create transfer");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle className="font-display">New Material Transfer</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Material *</Label>
            <Input list="inv-items" value={materialName} onChange={(e) => setMaterialName(e.target.value)} placeholder="Search or type material name" required />
            <datalist id="inv-items">
              {inventoryItems.map((i) => <option key={i} value={i} />)}
            </datalist>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Quantity *</Label>
              <Input type="number" min="0.01" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Unit</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Nos", "Kg", "MT", "Sqft", "Sqm", "Rft", "Litres", "Set", "Bag"].map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>From Location *</Label>
              <Select value={fromLocation} onValueChange={setFromLocation}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Factory">Factory</SelectItem>
                  <SelectItem value="Site">Site</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>To Location *</Label>
              <Select value={toLocation} onValueChange={setToLocation}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Factory">Factory</SelectItem>
                  <SelectItem value="Site">Site</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {toLocation === "Site" && (
            <div className="space-y-2">
              <Label>Destination Project</Label>
              <Select value={toProjectId} onValueChange={setToProjectId}>
                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Transfer Date *</Label>
            <Input type="date" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label>Driver / Transport Details</Label>
            <Input value={driverDetails} onChange={(e) => setDriverDetails(e.target.value)} placeholder="e.g. Raju — KA-01-AB-1234" />
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Any additional info" />
          </div>

          <Button type="submit" className="w-full" style={{ backgroundColor: "#006039" }} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Create Transfer
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
