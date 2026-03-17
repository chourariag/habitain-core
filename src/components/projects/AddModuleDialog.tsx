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
  projectId: string;
  onCreated: () => void;
}

const MODULE_TYPES = [
  { value: "standard", label: "Standard Module" },
  { value: "bathroom_pod", label: "Bathroom Pod" },
  { value: "other_pod", label: "Other Pod" },
];

export function AddModuleDialog({ open, onOpenChange, projectId, onCreated }: Props) {
  const [loading, setLoading] = useState(false);
  const [moduleId, setModuleId] = useState("");
  const [name, setName] = useState("");
  const [moduleType, setModuleType] = useState("standard");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moduleId.trim() || !name.trim()) {
      toast.error("Module ID and Module Name are required");
      return;
    }
    setLoading(true);
    try {
      const { client, session } = await getAuthedClient();
      const { error } = await client.from("modules").insert({
        name: name.trim(),
        module_code: moduleId.trim(),
        module_type: moduleType,
        project_id: projectId,
        created_by: session.user.id,
      } as any);
      if (error) throw error;
      toast.success(`Module ${moduleId.trim()} created`);
      setModuleId("");
      setName("");
      setModuleType("standard");
      onOpenChange(false);
      onCreated();
    } catch (err: any) {
      toast.error(err.message || "Failed to add module");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Add Module</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="modId">Module ID *</Label>
            <Input id="modId" value={moduleId} onChange={(e) => setModuleId(e.target.value)} placeholder="e.g. MOD-NDH-001" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="modName">Module Name *</Label>
            <Input id="modName" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Master Bedroom" required />
          </div>

          <div className="space-y-2">
            <Label>Module Type</Label>
            <Select value={moduleType} onValueChange={setModuleType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MODULE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Creating…" : "Add Module"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
