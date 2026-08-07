import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getAuthedClient } from "@/lib/auth-client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

const UNITS = ["units", "kg", "tonnes", "litres", "sqm", "sqft", "metres", "nos", "bags", "sheets", "rolls"];

const ALL_MODULES = "__all__";

export function NewMaterialRequestDialog({ open, onOpenChange, onCreated }: Props) {
  const [loading, setLoading] = useState(false);
  const [materialName, setMaterialName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [asPerIndent, setAsPerIndent] = useState(false);
  const [unit, setUnit] = useState("units");
  const [urgency, setUrgency] = useState("standard");
  const [daysRequired, setDaysRequired] = useState("");
  const [projectId, setProjectId] = useState("");
  const [moduleId, setModuleId] = useState("");
  const [notes, setNotes] = useState("");
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [modules, setModules] = useState<{ id: string; name: string; module_code: string | null }[]>([]);

  useEffect(() => {
    if (open) {
      supabase.from("projects").select("id, name").eq("is_archived", false).order("name").then(({ data }) => {
        setProjects(data ?? []);
      });
    }
  }, [open]);

  useEffect(() => {
    if (projectId) {
      supabase.from("modules").select("id, name, module_code").eq("project_id", projectId).eq("is_archived", false).order("name").then(({ data }) => {
        setModules((data as any) ?? []);
      });
    } else {
      setModules([]);
      setModuleId("");
    }
  }, [projectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!materialName.trim() || (!asPerIndent && !quantity) || !projectId) {
      toast.error("Material name, quantity, and project are required");
      return;
    }
    setLoading(true);
    try {
      const { client, session } = await getAuthedClient();
      const { error } = await client.from("material_requests" as any).insert({
        material_name: materialName.trim(),
        quantity: asPerIndent ? 0 : Number(quantity),
        quantity_note: asPerIndent ? "As per indent" : null,
        unit,
        urgency,
        days_required: urgency === "immediate" || !daysRequired ? null : Number(daysRequired),
        project_id: projectId,
        module_id: moduleId && moduleId !== ALL_MODULES ? moduleId : null,
        applies_to_all_modules: moduleId === ALL_MODULES,
        notes: notes.trim() || null,
        requested_by: session.user.id,
      });
      if (error) throw error;
      toast.success("Material request submitted");
      setMaterialName("");
      setQuantity("");
      setAsPerIndent(false);
      setUnit("units");
      setUrgency("standard");
      setDaysRequired("");
      setProjectId("");
      setModuleId("");
      setNotes("");
      onOpenChange(false);
      onCreated();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit request");
    } finally {
      setLoading(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">New Material Request</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="matName">Material Name *</Label>
            <Input id="matName" value={materialName} onChange={(e) => setMaterialName(e.target.value)} placeholder="e.g. 12mm Plywood Sheet" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="qty">Quantity *</Label>
              <Input id="qty" type="number" min={0.01} step="any" value={asPerIndent ? "" : quantity} onChange={(e) => setQuantity(e.target.value)} placeholder={asPerIndent ? "As per indent" : "e.g. 50"} disabled={asPerIndent} required={!asPerIndent} />
              <div className="flex items-center gap-2 pt-1">
                <Checkbox id="asPerIndent" checked={asPerIndent} onCheckedChange={(c) => setAsPerIndent(c === true)} />
                <Label htmlFor="asPerIndent" className="text-xs font-normal text-muted-foreground cursor-pointer">As per indent</Label>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Unit</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Linked Project *</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Linked Module (optional)</Label>
            <Select value={moduleId} onValueChange={setModuleId}>
              <SelectTrigger><SelectValue placeholder="Select module" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_MODULES}>All modules</SelectItem>
                {modules.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.module_code ? `${m.module_code} — ` : ""}{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Urgency</Label>
              <Select value={urgency} onValueChange={setUrgency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="immediate">Immediate</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {urgency !== "immediate" && (
              <div className="space-y-2">
                <Label htmlFor="daysReq">No. of days required</Label>
                <Input id="daysReq" type="number" min={1} step={1} value={daysRequired} onChange={(e) => setDaysRequired(e.target.value)} placeholder="e.g. 7" />
              </div>
            )}
          </div>


          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional details..." rows={3} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Submitting…" : "Submit Request"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
