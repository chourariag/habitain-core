import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Plus, Trash2, FileDown, Loader2, Save, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  projectId: string;
  userRole: string | null;
}

type Responsibility = "not_in_scope" | "habitainer" | "external_contractor";

interface ScopeItem {
  id?: string;
  item_name: string;
  responsibility: Responsibility;
  area_sqft?: number | null;
  remarks?: string;
  sort_order: number;
}

interface ScopeExclusion {
  id?: string;
  exclusion_text: string;
  is_standard: boolean;
  sort_order: number;
}

const SECTION_DEFINITIONS: Record<string, { label: string; items: string[]; hasArea?: boolean }> = {
  design_consultants: {
    label: "Design & Consultants",
    items: ["Architecture", "Interiors", "Structural", "External MEP Design", "Project Management", "Site Survey", "Soil Test", "Landscaping", "Liaising"],
  },
  builder_finish: {
    label: "Builder Finish",
    items: ["Structure", "Insulation", "Wall Boarding - Interior", "Electricals Fittings", "Plumbing Fittings", "Doors", "Windows", "Flooring", "Roof", "External Cladding", "Rain Water Gutters", "Water Proofing", "Transportation to Site", "Crane"],
  },
  external_structures: {
    label: "External Structures",
    items: ["Glass Passageway", "Outdoor Deck", "Gazebo", "Pergola", "Roof Top Deck Cover", "Staircase"],
    hasArea: true,
  },
  site_related: {
    label: "Site-Related Work",
    items: ["Foundations/Sub-structure", "Sump + OHT", "External Plumbing", "External Electricals", "Civil Deck", "Compound Wall", "Gate", "Driveway", "Landscape", "Servant Quarters", "Swimming Pool", "External Lighting"],
  },
};

const DEFAULT_EXCLUSIONS = [
  "Interior woodwork (Kitchen, Vanity, Wardrobe)",
  "Loose Furniture and Soft Furnishings",
  "Appliances (AC, Fridge, TV)",
  "Labour accommodation",
  "Water & Electricity on site",
  "18% GST",
  "MEP Consultancy (CCTV, Plumbing, Electricals, DG)",
];

const EDIT_ROLES = ["planning_engineer", "super_admin", "managing_director", "finance_director", "sales_director", "architecture_director"];

export function ScopeOfWorkTab({ projectId, userRole }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scopeId, setScopeId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("draft");

  // General details
  const [clientName, setClientName] = useState("");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState("");
  const [division, setDivision] = useState("");
  const [builtUpArea, setBuiltUpArea] = useState("");
  const [moduleCount, setModuleCount] = useState("");
  const [deckArea, setDeckArea] = useState("");
  const [notes, setNotes] = useState("");

  // Items by section
  const [sectionItems, setSectionItems] = useState<Record<string, ScopeItem[]>>({});
  // Exclusions
  const [exclusions, setExclusions] = useState<ScopeExclusion[]>([]);

  const canEdit = EDIT_ROLES.includes(userRole ?? "");

  const loadScope = useCallback(async () => {
    setLoading(true);
    const { data: scope } = await supabase
      .from("project_scope_of_work")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (scope) {
      setScopeId(scope.id);
      setStatus(scope.status);
      setClientName(scope.client_name ?? "");
      setLocation(scope.location ?? "");
      setCategory(scope.category ?? "");
      setDivision(scope.division ?? "");
      setBuiltUpArea(scope.built_up_area?.toString() ?? "");
      setModuleCount(scope.module_count?.toString() ?? "");
      setDeckArea(scope.deck_area?.toString() ?? "");
      setNotes(scope.notes ?? "");

      const [itemsRes, exclRes] = await Promise.all([
        supabase.from("project_scope_items").select("*").eq("scope_id", scope.id).order("sort_order"),
        supabase.from("project_scope_exclusions").select("*").eq("scope_id", scope.id).order("sort_order"),
      ]);

      const grouped: Record<string, ScopeItem[]> = {};
      for (const sec of Object.keys(SECTION_DEFINITIONS)) {
        grouped[sec] = SECTION_DEFINITIONS[sec].items.map((name, i) => {
          const existing = (itemsRes.data ?? []).find((it: any) => it.section === sec && it.item_name === name);
          return existing
            ? { id: existing.id, item_name: existing.item_name, responsibility: existing.responsibility as Responsibility, area_sqft: existing.area_sqft, remarks: existing.remarks ?? "", sort_order: existing.sort_order }
            : { item_name: name, responsibility: "not_in_scope" as Responsibility, area_sqft: null, remarks: "", sort_order: i };
        });
      }
      setSectionItems(grouped);
      setExclusions(
        (exclRes.data ?? []).map((e: any) => ({ id: e.id, exclusion_text: e.exclusion_text, is_standard: e.is_standard, sort_order: e.sort_order }))
      );
    } else {
      // Initialize defaults
      const grouped: Record<string, ScopeItem[]> = {};
      for (const sec of Object.keys(SECTION_DEFINITIONS)) {
        grouped[sec] = SECTION_DEFINITIONS[sec].items.map((name, i) => ({
          item_name: name, responsibility: "not_in_scope" as Responsibility, area_sqft: null, remarks: "", sort_order: i,
        }));
      }
      setSectionItems(grouped);
      setExclusions(DEFAULT_EXCLUSIONS.map((t, i) => ({ exclusion_text: t, is_standard: true, sort_order: i })));
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { loadScope(); }, [loadScope]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Not authenticated"); setSaving(false); return; }

      let currentScopeId = scopeId;
      if (!currentScopeId) {
        const { data, error } = await supabase.from("project_scope_of_work").insert({
          project_id: projectId,
          client_name: clientName || null,
          location: location || null,
          category: category || null,
          division: division || null,
          built_up_area: builtUpArea ? Number(builtUpArea) : null,
          module_count: moduleCount ? Number(moduleCount) : null,
          deck_area: deckArea ? Number(deckArea) : null,
          notes: notes || null,
          created_by: user.id,
        }).select("id").single();
        if (error) throw error;
        currentScopeId = data.id;
        setScopeId(data.id);
      } else {
        await supabase.from("project_scope_of_work").update({
          client_name: clientName || null,
          location: location || null,
          category: category || null,
          division: division || null,
          built_up_area: builtUpArea ? Number(builtUpArea) : null,
          module_count: moduleCount ? Number(moduleCount) : null,
          deck_area: deckArea ? Number(deckArea) : null,
          notes: notes || null,
        }).eq("id", currentScopeId);
      }

      // Upsert items — delete and re-insert for simplicity
      await supabase.from("project_scope_items").delete().eq("scope_id", currentScopeId);
      const allItems: any[] = [];
      for (const [sec, items] of Object.entries(sectionItems)) {
        items.forEach((item, i) => {
          allItems.push({
            scope_id: currentScopeId,
            section: sec,
            item_name: item.item_name,
            responsibility: item.responsibility,
            area_sqft: item.area_sqft || null,
            remarks: item.remarks || null,
            sort_order: i,
          });
        });
      }
      if (allItems.length > 0) {
        await supabase.from("project_scope_items").insert(allItems);
      }

      // Exclusions
      await supabase.from("project_scope_exclusions").delete().eq("scope_id", currentScopeId);
      if (exclusions.length > 0) {
        await supabase.from("project_scope_exclusions").insert(
          exclusions.map((e, i) => ({ scope_id: currentScopeId, exclusion_text: e.exclusion_text, is_standard: e.is_standard, sort_order: i }))
        );
      }

      toast.success("Scope of Work saved");
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    }
    setSaving(false);
  };

  const handleFinalise = async () => {
    if (!scopeId) { toast.error("Please save first"); return; }
    await supabase.from("project_scope_of_work").update({ status: "finalised" }).eq("id", scopeId);
    setStatus("finalised");
    toast.success("Scope of Work finalised");
  };

  const updateItem = (section: string, index: number, field: keyof ScopeItem, value: any) => {
    setSectionItems((prev) => {
      const copy = { ...prev };
      copy[section] = [...copy[section]];
      copy[section][index] = { ...copy[section][index], [field]: value };
      return copy;
    });
  };

  const addExclusion = () => {
    setExclusions((prev) => [...prev, { exclusion_text: "", is_standard: false, sort_order: prev.length }]);
  };

  const removeExclusion = (index: number) => {
    setExclusions((prev) => prev.filter((_, i) => i !== index));
  };

  const renderResponsibilityLabel = (r: Responsibility) => {
    if (r === "habitainer") return "Habitainer";
    if (r === "external_contractor") return "External Contractor";
    return "Not in Scope";
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-lg font-semibold text-foreground">Scope of Work</h2>
          <Badge variant={status === "finalised" ? "default" : "secondary"} className={status === "finalised" ? "bg-[#006039] text-white" : ""}>
            {status === "finalised" ? "Finalised" : "Draft"}
          </Badge>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Save
            </Button>
            {status === "draft" && scopeId && (
              <Button size="sm" variant="outline" onClick={handleFinalise}>
                <CheckCircle2 className="h-4 w-4 mr-1" /> Finalise
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Section 1: General Details */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">General Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div><Label className="text-xs text-muted-foreground">Client Name</Label><Input value={clientName} onChange={(e) => setClientName(e.target.value)} disabled={!canEdit} /></div>
          <div><Label className="text-xs text-muted-foreground">Location</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} disabled={!canEdit} /></div>
          <div>
            <Label className="text-xs text-muted-foreground">Category</Label>
            <Select value={category} onValueChange={setCategory} disabled={!canEdit}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Residential">Residential</SelectItem>
                <SelectItem value="Commercial">Commercial</SelectItem>
                <SelectItem value="Resort">Resort</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Division</Label>
            <Select value={division} onValueChange={setDivision} disabled={!canEdit}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Habitainer">Habitainer</SelectItem>
                <SelectItem value="ADS">ADS</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs text-muted-foreground">Built-up Area (sqft)</Label><Input type="number" value={builtUpArea} onChange={(e) => setBuiltUpArea(e.target.value)} disabled={!canEdit} /></div>
          <div><Label className="text-xs text-muted-foreground">Module Count</Label><Input type="number" value={moduleCount} onChange={(e) => setModuleCount(e.target.value)} disabled={!canEdit} /></div>
          <div><Label className="text-xs text-muted-foreground">Deck Area (sqft)</Label><Input type="number" value={deckArea} onChange={(e) => setDeckArea(e.target.value)} disabled={!canEdit} /></div>
          <div className="sm:col-span-2 lg:col-span-3">
            <Label className="text-xs text-muted-foreground">Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!canEdit} rows={2} />
          </div>
        </CardContent>
      </Card>

      {/* Sections 2-5: Scope Items */}
      <Accordion type="multiple" defaultValue={Object.keys(SECTION_DEFINITIONS)} className="space-y-3">
        {Object.entries(SECTION_DEFINITIONS).map(([sectionKey, def]) => (
          <AccordionItem key={sectionKey} value={sectionKey} className="bg-card rounded-lg shadow-sm border">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-sm">{def.label}</span>
                <Badge variant="secondary" className="text-xs">
                  {(sectionItems[sectionKey] ?? []).filter((i) => i.responsibility !== "not_in_scope").length} / {(sectionItems[sectionKey] ?? []).length}
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-3">
                {(sectionItems[sectionKey] ?? []).map((item, idx) => (
                  <div key={idx} className="flex flex-col sm:flex-row sm:items-center gap-2 py-2 border-b last:border-b-0">
                    <span className="text-sm font-medium min-w-[180px] shrink-0">{item.item_name}</span>
                    <RadioGroup
                      value={item.responsibility}
                      onValueChange={(v) => updateItem(sectionKey, idx, "responsibility", v)}
                      className="flex gap-4 shrink-0"
                      disabled={!canEdit}
                    >
                      {(["not_in_scope", "habitainer", "external_contractor"] as Responsibility[]).map((r) => (
                        <div key={r} className="flex items-center gap-1">
                          <RadioGroupItem value={r} id={`${sectionKey}-${idx}-${r}`} />
                          <Label htmlFor={`${sectionKey}-${idx}-${r}`} className="text-xs cursor-pointer">{renderResponsibilityLabel(r)}</Label>
                        </div>
                      ))}
                    </RadioGroup>
                    {def.hasArea && (
                      <Input
                        type="number"
                        placeholder="Area sqft"
                        className="w-24 text-xs"
                        value={item.area_sqft ?? ""}
                        onChange={(e) => updateItem(sectionKey, idx, "area_sqft", e.target.value ? Number(e.target.value) : null)}
                        disabled={!canEdit}
                      />
                    )}
                    <Input
                      placeholder="Remarks"
                      className="flex-1 text-xs"
                      value={item.remarks ?? ""}
                      onChange={(e) => updateItem(sectionKey, idx, "remarks", e.target.value)}
                      disabled={!canEdit}
                    />
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {/* Section 6: Exclusions */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Exclusions</CardTitle>
          {canEdit && (
            <Button variant="ghost" size="sm" onClick={addExclusion}><Plus className="h-4 w-4 mr-1" /> Add</Button>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {exclusions.map((excl, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-5 shrink-0">{idx + 1}.</span>
              <Input
                value={excl.exclusion_text}
                onChange={(e) => setExclusions((prev) => prev.map((ex, i) => i === idx ? { ...ex, exclusion_text: e.target.value } : ex))}
                className="text-sm flex-1"
                disabled={!canEdit}
              />
              {canEdit && !excl.is_standard && (
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeExclusion(idx)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
