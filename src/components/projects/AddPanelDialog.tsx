import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { getAuthedClient } from "@/lib/auth-client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moduleId: string;
  onCreated: () => void;
}

const PANEL_TYPES = [
  { value: "wall", label: "Wall" },
  { value: "floor", label: "Floor" },
  { value: "ceiling", label: "Ceiling" },
  { value: "partition", label: "Partition" },
  { value: "facade", label: "Facade" },
];

export function AddPanelDialog({ open, onOpenChange, moduleId, onCreated }: Props) {
  const [loading, setLoading] = useState(false);
  const [panelId, setPanelId] = useState("");
  const [panelType, setPanelType] = useState("wall");
  const [length, setLength] = useState("");
  const [height, setHeight] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!panelId.trim()) {
      toast.error("Panel ID is required");
      return;
    }
    setLoading(true);
    try {
      const { client, session } = await getAuthedClient();
      const { error } = await client.from("panels" as any).insert({
        module_id: moduleId,
        panel_code: panelId.trim(),
        panel_type: panelType,
        length_mm: length ? Number(length) : null,
        height_mm: height ? Number(height) : null,
        created_by: session.user.id,
      });
      if (error) throw error;
      toast.success(`Panel ${panelId.trim()} created`);
      setPanelId("");
      setPanelType("wall");
      setLength("");
      setHeight("");
      onOpenChange(false);
      onCreated();
    } catch (err: any) {
      toast.error(err.message || "Failed to add panel");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Add Panel</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="pnlId">Panel ID *</Label>
            <Input id="pnlId" value={panelId} onChange={(e) => setPanelId(e.target.value)} placeholder="e.g. PNL-NDH-001-W1" required />
          </div>

          <div className="space-y-2">
            <Label>Panel Type *</Label>
            <Select value={panelType} onValueChange={setPanelType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PANEL_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="pLength">Length (mm)</Label>
              <Input id="pLength" type="number" min={0} value={length} onChange={(e) => setLength(e.target.value)} placeholder="e.g. 3600" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pHeight">Height (mm)</Label>
              <Input id="pHeight" type="number" min={0} value={height} onChange={(e) => setHeight(e.target.value)} placeholder="e.g. 2700" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Creating…" : "Add Panel"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
