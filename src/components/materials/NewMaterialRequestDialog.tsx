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

export function NewMaterialRequestDialog({ open, onOpenChange, onCreated }: Props) {
  const [loading, setLoading] = useState(false);
  const [materialName, setMaterialName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("units");
  const [urgency, setUrgency] = useState("standard");
  const [projectId, setProjectId] = useState("");
  const [moduleId, setModuleId] = useState("");
  const [notes, setNotes] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("");
  const [numQuotesAttached, setNumQuotesAttached] = useState("");
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [modules, setModules] = useState<{ id: string; name: string; module_code: string | null }[]>([]);

  const getQuoteRequirement = (cost: number) => {
    if (cost <= 0) return null;
    if (cost < 3000) return { required: 0, label: "No quotes required (<₹3,000)" };
    if (cost <= 7000) return { required: 1, label: "1 quote required (₹3,000–₹7,000)" };
    return { required: 3, label: "3 quotes required (>₹7,000)" };
  };

  const quoteReq = getQuoteRequirement(Number(estimatedCost));
  const quotesOk = !quoteReq || quoteReq.required === 0 || Number(numQuotesAttached) >= quoteReq.required;

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
    if (!materialName.trim() || !quantity || !projectId) {
      toast.error("Material name, quantity, and project are required");
      return;
    }
    if (!quotesOk) {
      toast.error(`Quote requirement not met: ${quoteReq?.label}. Please attach ${quoteReq?.required} quote(s).`);
      return;
    }
    setLoading(true);
    try {
      const { client, session } = await getAuthedClient();
      const { error } = await client.from("material_requests" as any).insert({
        material_name: materialName.trim(),
        quantity: Number(quantity),
        unit,
        urgency,
        project_id: projectId,
        module_id: moduleId || null,
        notes: notes.trim() || null,
        requested_by: session.user.id,
        estimated_cost: estimatedCost ? Number(estimatedCost) : null,
        num_quotes_attached: numQuotesAttached ? Number(numQuotesAttached) : null,
      });
      if (error) throw error;
      toast.success("Material request submitted");
      setMaterialName("");
      setQuantity("");
      setUnit("units");
      setUrgency("standard");
      setProjectId("");
      setModuleId("");
      setNotes("");
      setEstimatedCost("");
      setNumQuotesAttached("");
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
              <Input id="qty" type="number" min={0.01} step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="e.g. 50" required />
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

          {modules.length > 0 && (
            <div className="space-y-2">
              <Label>Linked Module (optional)</Label>
              <Select value={moduleId} onValueChange={setModuleId}>
                <SelectTrigger><SelectValue placeholder="Select module" /></SelectTrigger>
                <SelectContent>
                  {modules.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.module_code ? `${m.module_code} — ` : ""}{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Urgency</Label>
            <Select value={urgency} onValueChange={setUrgency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Quote Threshold Enforcement */}
          <div className="space-y-2">
            <Label htmlFor="estimatedCost">Estimated Cost (₹)</Label>
            <Input
              id="estimatedCost"
              type="number"
              min={0}
              value={estimatedCost}
              onChange={(e) => setEstimatedCost(e.target.value)}
              placeholder="Optional — triggers quote requirement"
            />
            {quoteReq && (
              <div
                className="rounded-md p-2 text-xs"
                style={{
                  backgroundColor: quoteReq.required === 0 ? "#E8F2ED" : quotesOk ? "#E8F2ED" : "#FFF8E8",
                  color: quoteReq.required === 0 ? "#006039" : quotesOk ? "#006039" : "#D4860A",
                }}
              >
                {quoteReq.label}
              </div>
            )}
          </div>

          {quoteReq && quoteReq.required > 0 && (
            <div className="space-y-2">
              <Label htmlFor="numQuotes">Number of Quotes Attached *</Label>
              <Input
                id="numQuotes"
                type="number"
                min={0}
                max={10}
                value={numQuotesAttached}
                onChange={(e) => setNumQuotesAttached(e.target.value)}
                placeholder={`Minimum ${quoteReq.required} required`}
                style={{ borderColor: !quotesOk ? "#D4860A" : undefined }}
              />
              {!quotesOk && (
                <p className="text-xs" style={{ color: "#D4860A" }}>
                  ⚠ You must attach at least {quoteReq.required} quote(s) before submitting.
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional details..." rows={3} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !quotesOk}>{loading ? "Submitting…" : "Submit Request"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
