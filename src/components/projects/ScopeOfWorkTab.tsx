import { useState, useEffect, useCallback } from "react";
import { useProjectImportListener } from "@/lib/use-project-import";
import { SetupTemplateBanner } from "./SetupTemplateBanner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Loader2, Save, Send, CheckCircle2, Lock, Copy, Unlock, AlertTriangle, PenLine } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { format } from "date-fns";
import { SaleAgreementCard } from "./SaleAgreementCard";
import { insertNotifications } from "@/lib/notifications";

interface Props {
  projectId: string;
  userRole: string | null;
}

type Responsibility = "not_in_scope" | "habitainer" | "external_contractor";
interface ScopeItem { id?: string; item_name: string; responsibility: Responsibility; area_sqft?: number | null; remarks?: string; sort_order: number; }
interface ScopeExclusion { id?: string; exclusion_text: string; is_standard: boolean; sort_order: number; }

const SECTION_DEFINITIONS: Record<string, { label: string; items: string[]; hasArea?: boolean }> = {
  design_consultants: { label: "Design & Consultants", items: ["Architecture", "Interiors", "Structural", "External MEP Design", "Project Management", "Site Survey", "Soil Test", "Landscaping", "Liaising"] },
  builder_finish: { label: "Builder Finish", items: ["Structure", "Insulation", "Wall Boarding - Interior", "Electricals Fittings", "Plumbing Fittings", "Doors", "Windows", "Flooring", "Roof", "External Cladding", "Rain Water Gutters", "Water Proofing", "Transportation to Site", "Crane"] },
  external_structures: { label: "External Structures", items: ["Glass Passageway", "Outdoor Deck", "Gazebo", "Pergola", "Roof Top Deck Cover", "Staircase"], hasArea: true },
  site_related: { label: "Site-Related Work", items: ["Foundations/Sub-structure", "Sump + OHT", "External Plumbing", "External Electricals", "Civil Deck", "Compound Wall", "Gate", "Driveway", "Landscape", "Servant Quarters", "Swimming Pool", "External Lighting"] },
};

const DEFAULT_EXCLUSIONS = [
  "Interior woodwork (Kitchen, Vanity, Wardrobe)", "Loose Furniture and Soft Furnishings", "Appliances (AC, Fridge, TV)",
  "Labour accommodation", "Water & Electricity on site", "18% GST", "MEP Consultancy (CCTV, Plumbing, Electricals, DG)",
];

const DRAFT_EDIT_ROLES = ["planning_engineer", "super_admin", "managing_director", "sales_director", "architecture_director", "sales_executive"];
const SALES_DIRECTOR_ROLES = ["sales_director", "managing_director", "super_admin"];
const UNLOCK_ROLES = ["managing_director", "super_admin"];

const RESP_LABEL: Record<Responsibility, string> = {
  not_in_scope: "Not in Scope",
  habitainer: "Habitainer",
  external_contractor: "External Contractor",
};

export function ScopeOfWorkTab({ projectId, userRole }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scopeId, setScopeId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("draft");
  const [locked, setLocked] = useState(false);
  const [clientSignedBy, setClientSignedBy] = useState<string | null>(null);
  const [clientSignedAt, setClientSignedAt] = useState<string | null>(null);
  const [sdSignedById, setSdSignedById] = useState<string | null>(null);
  const [sdSignedAt, setSdSignedAt] = useState<string | null>(null);
  const [scopePdfUrl, setScopePdfUrl] = useState<string | null>(null);

  // Project baseline for change flagging
  const [project, setProject] = useState<any>(null);

  // General details
  const [clientName, setClientName] = useState("");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState("");
  const [division, setDivision] = useState("");
  const [builtUpArea, setBuiltUpArea] = useState("");
  const [moduleCount, setModuleCount] = useState("");
  const [deckArea, setDeckArea] = useState("");
  const [notes, setNotes] = useState("");

  const [sectionItems, setSectionItems] = useState<Record<string, ScopeItem[]>>({});
  const [exclusions, setExclusions] = useState<ScopeExclusion[]>([]);

  // Sign-off / linking state
  const [signLinkOpen, setSignLinkOpen] = useState(false);
  const [signLinkUrl, setSignLinkUrl] = useState<string | null>(null);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [unlockReason, setUnlockReason] = useState("");

  const canEditDraft = DRAFT_EDIT_ROLES.includes(userRole ?? "");
  const canSdSign = SALES_DIRECTOR_ROLES.includes(userRole ?? "");
  const canUnlock = UNLOCK_ROLES.includes(userRole ?? "");
  const readOnly = status !== "draft"; // pending_signoff & signed = read-only for content

  const loadScope = useCallback(async () => {
    setLoading(true);
    const [projRes, scopeRes] = await Promise.all([
      supabase.from("projects").select("client_name, location, built_up_area, module_count, division, type").eq("id", projectId).single(),
      (supabase as any).from("project_scope_of_work").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    setProject(projRes.data);

    const scope = scopeRes.data;
    if (scope) {
      setScopeId(scope.id);
      setStatus(scope.status);
      setLocked(!!scope.locked);
      setClientSignedBy(scope.client_signed_by ?? null);
      setClientSignedAt(scope.client_signed_at ?? null);
      setSdSignedById(scope.sales_director_signed_by ?? null);
      setSdSignedAt(scope.sales_director_signed_at ?? null);
      setScopePdfUrl(scope.scope_pdf_url ?? null);
      setClientName(scope.client_name ?? projRes.data?.client_name ?? "");
      setLocation(scope.location ?? projRes.data?.location ?? "");
      setCategory(scope.category ?? "");
      setDivision(scope.division ?? projRes.data?.division ?? "");
      setBuiltUpArea(scope.built_up_area?.toString() ?? projRes.data?.built_up_area?.toString() ?? "");
      setModuleCount(scope.module_count?.toString() ?? projRes.data?.module_count?.toString() ?? "");
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
      setExclusions((exclRes.data ?? []).map((e: any) => ({ id: e.id, exclusion_text: e.exclusion_text, is_standard: e.is_standard, sort_order: e.sort_order })));
    } else {
      // Auto-populate from project
      setClientName(projRes.data?.client_name ?? "");
      setLocation(projRes.data?.location ?? "");
      setDivision(projRes.data?.division ?? "");
      setBuiltUpArea(projRes.data?.built_up_area?.toString() ?? "");
      setModuleCount(projRes.data?.module_count?.toString() ?? "");
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
  useProjectImportListener(projectId, loadScope);

  const changedFromProject = (field: string, val: string) => {
    if (!project) return false;
    const map: Record<string, any> = {
      clientName: project.client_name,
      location: project.location,
      builtUpArea: project.built_up_area?.toString() ?? "",
      moduleCount: project.module_count?.toString() ?? "",
    };
    if (!(field in map)) return false;
    return (val ?? "").toString() !== ((map[field] ?? "").toString());
  };

  const persistScope = async (): Promise<string | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Not authenticated"); return null; }
    let currentScopeId = scopeId;
    if (!currentScopeId) {
      const { data, error } = await (supabase as any).from("project_scope_of_work").insert({
        project_id: projectId, client_name: clientName || null, location: location || null,
        category: category || null, division: division || null,
        built_up_area: builtUpArea ? Number(builtUpArea) : null,
        module_count: moduleCount ? Number(moduleCount) : null,
        deck_area: deckArea ? Number(deckArea) : null, notes: notes || null,
        created_by: user.id,
      }).select("id").single();
      if (error) { toast.error(error.message); return null; }
      currentScopeId = data.id;
      setScopeId(data.id);
    } else {
      const { error } = await (supabase as any).from("project_scope_of_work").update({
        client_name: clientName || null, location: location || null, category: category || null,
        division: division || null,
        built_up_area: builtUpArea ? Number(builtUpArea) : null,
        module_count: moduleCount ? Number(moduleCount) : null,
        deck_area: deckArea ? Number(deckArea) : null, notes: notes || null,
      }).eq("id", currentScopeId);
      if (error) { toast.error(error.message); return null; }
    }

    await supabase.from("project_scope_items").delete().eq("scope_id", currentScopeId);
    const allItems: any[] = [];
    for (const [sec, items] of Object.entries(sectionItems)) {
      items.forEach((item, i) => {
        allItems.push({ scope_id: currentScopeId, section: sec, item_name: item.item_name, responsibility: item.responsibility, area_sqft: item.area_sqft || null, remarks: item.remarks || null, sort_order: i });
      });
    }
    if (allItems.length > 0) await supabase.from("project_scope_items").insert(allItems);

    await supabase.from("project_scope_exclusions").delete().eq("scope_id", currentScopeId);
    if (exclusions.length > 0) {
      await supabase.from("project_scope_exclusions").insert(
        exclusions.map((e, i) => ({ scope_id: currentScopeId, exclusion_text: e.exclusion_text, is_standard: e.is_standard, sort_order: i }))
      );
    }
    return currentScopeId;
  };

  const handleSave = async () => {
    setSaving(true);
    const id = await persistScope();
    setSaving(false);
    if (id) toast.success("Scope of Work saved");
  };

  const submitForSignoff = async () => {
    setSaving(true);
    const id = await persistScope();
    if (!id) { setSaving(false); return; }
    const { error } = await (supabase as any).from("project_scope_of_work").update({ status: "pending_signoff" }).eq("id", id);
    if (error) { toast.error(error.message); setSaving(false); return; }
    setStatus("pending_signoff");

    // Notify Sales Director
    const { data: sds } = await supabase.from("profiles").select("auth_user_id").eq("role", "sales_director" as any).eq("is_active", true);
    if (sds?.length) {
      await insertNotifications(sds.map((p: any) => ({
        recipient_id: p.auth_user_id,
        title: "Scope of Work ready for sign-off",
        body: `Scope of Work for ${clientName || "project"} is ready for your approval.`,
        category: "approval",
        related_table: "project_scope_of_work",
        related_id: id,
        navigate_to: `/projects/${projectId}?tab=scope`,
        priority: "high",
      })));
    }
    toast.success("Submitted for sign-off");
    setSaving(false);
  };

  const generateClientLink = async () => {
    if (!scopeId) { toast.error("Save the scope first"); return; }
    const token = crypto.randomUUID().replace(/-/g, "") + Math.random().toString(36).slice(2, 10);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from("scope_signoff_tokens").insert({
      token, scope_of_work_id: scopeId, created_by: user?.id ?? null,
    });
    if (error) { toast.error(error.message); return; }
    const url = `${window.location.origin}/scope-signoff/${token}`;
    setSignLinkUrl(url);
    setSignLinkOpen(true);
  };

  const salesDirectorSign = async () => {
    if (!scopeId || !canSdSign) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: prof } = await supabase.from("profiles").select("id").eq("auth_user_id", user.id).maybeSingle();
    const { error } = await (supabase as any).from("project_scope_of_work").update({
      sales_director_signed_by: prof?.id ?? null,
      sales_director_signed_at: new Date().toISOString(),
    }).eq("id", scopeId);
    if (error) { toast.error(error.message); return; }
    toast.success("Signature recorded");
    await afterSignatureChanged();
  };

  const afterSignatureChanged = async () => {
    await loadScope();
    // Re-check both signatures
    const { data: fresh } = await (supabase as any).from("project_scope_of_work").select("*").eq("id", scopeId).single();
    if (fresh?.client_signed_at && fresh?.sales_director_signed_at && fresh?.status !== "signed") {
      // Both captured → mark signed + lock + generate PDF
      const pdfUrl = await generatePdf(fresh);
      const { error } = await (supabase as any).from("project_scope_of_work").update({
        status: "signed", locked: true, scope_pdf_url: pdfUrl,
      }).eq("id", scopeId);
      if (error) { toast.error(error.message); return; }
      setStatus("signed"); setLocked(true); setScopePdfUrl(pdfUrl);
      // Notify sales exec + planning head
      const { data: notify } = await supabase.from("profiles").select("auth_user_id").in("role", ["sales_executive", "planning_head"] as any).eq("is_active", true);
      if (notify?.length) {
        await insertNotifications(notify.map((p: any) => ({
          recipient_id: p.auth_user_id,
          title: "Scope of Work signed",
          body: `Scope of Work fully signed for ${clientName || "project"}. Sale Agreement can now be submitted.`,
          category: "milestone",
          related_table: "project_scope_of_work",
          related_id: scopeId!,
          navigate_to: `/projects/${projectId}?tab=scope`,
          priority: "high",
        })));
      }
      toast.success("Scope fully signed and locked");
    }
  };

  const generatePdf = async (fresh: any): Promise<string | null> => {
    try {
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      let y = 40;
      doc.setFontSize(16); doc.setFont("helvetica", "bold");
      doc.text("SCOPE OF WORK", pageW / 2, y, { align: "center" }); y += 24;
      doc.setFontSize(10); doc.setFont("helvetica", "normal");
      const lines = [
        `Client: ${fresh.client_name ?? "—"}`,
        `Location: ${fresh.location ?? "—"}`,
        `Category: ${fresh.category ?? "—"}    Division: ${fresh.division ?? "—"}`,
        `Built-up Area: ${fresh.built_up_area ?? "—"} sqft    Modules: ${fresh.module_count ?? "—"}`,
      ];
      for (const l of lines) { doc.text(l, 40, y); y += 14; }
      y += 10;

      // Items grouped by section
      const { data: items } = await (supabase as any).from("project_scope_items").select("*").eq("scope_id", fresh.id).order("sort_order");
      for (const sec of Object.keys(SECTION_DEFINITIONS)) {
        const secItems = (items ?? []).filter((it: any) => it.section === sec);
        if (!secItems.length) continue;
        if (y > 760) { doc.addPage(); y = 40; }
        doc.setFont("helvetica", "bold"); doc.text(SECTION_DEFINITIONS[sec].label, 40, y); y += 14;
        doc.setFont("helvetica", "normal");
        for (const it of secItems) {
          if (y > 780) { doc.addPage(); y = 40; }
          const line = `  • ${it.item_name} — ${RESP_LABEL[it.responsibility as Responsibility] ?? it.responsibility}${it.area_sqft ? ` (${it.area_sqft} sqft)` : ""}${it.remarks ? ` — ${it.remarks}` : ""}`;
          const split = doc.splitTextToSize(line, pageW - 80);
          doc.text(split, 40, y); y += split.length * 12;
        }
        y += 6;
      }

      // Exclusions
      const { data: excl } = await supabase.from("project_scope_exclusions").select("*").eq("scope_id", fresh.id).order("sort_order");
      if (y > 720) { doc.addPage(); y = 40; }
      doc.setFont("helvetica", "bold"); doc.text("Exclusions", 40, y); y += 14;
      doc.setFont("helvetica", "normal");
      (excl ?? []).forEach((e: any, i: number) => {
        if (y > 780) { doc.addPage(); y = 40; }
        const s = doc.splitTextToSize(`${i + 1}. ${e.exclusion_text}`, pageW - 80);
        doc.text(s, 40, y); y += s.length * 12;
      });

      // Signatures
      if (y > 700) { doc.addPage(); y = 40; }
      y += 20;
      doc.setFont("helvetica", "bold"); doc.text("Signatures", 40, y); y += 16;
      doc.setFont("helvetica", "normal");
      doc.text(`Client: ${fresh.client_signed_by ?? "—"}  (${fresh.client_signed_at ? format(new Date(fresh.client_signed_at), "dd/MM/yyyy HH:mm") : "—"})`, 40, y); y += 14;
      doc.text(`Sales Director: signed on ${fresh.sales_director_signed_at ? format(new Date(fresh.sales_director_signed_at), "dd/MM/yyyy HH:mm") : "—"}`, 40, y);

      const blob = doc.output("blob");
      const path = `scope-of-work/${projectId}/${fresh.id}-${Date.now()}.pdf`;
      const { error: upErr } = await supabase.storage.from("design-files").upload(path, blob, { contentType: "application/pdf", upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("design-files").getPublicUrl(path);
      return pub.publicUrl;
    } catch (e: any) {
      console.error("PDF gen failed", e);
      toast.error("PDF generation failed");
      return null;
    }
  };

  const doUnlock = async () => {
    if (!scopeId || !canUnlock) return;
    if (unlockReason.trim().length < 5) { toast.error("Reason required (min 5 chars)"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error: e1 } = await (supabase as any).from("scope_unlock_audit").insert({
      scope_of_work_id: scopeId, unlocked_by: user.id, reason: unlockReason.trim(),
    });
    if (e1) { toast.error(e1.message); return; }
    const { error: e2 } = await (supabase as any).from("project_scope_of_work").update({ locked: false, status: "draft" }).eq("id", scopeId);
    if (e2) { toast.error(e2.message); return; }
    toast.success("Scope unlocked for editing");
    setUnlockOpen(false); setUnlockReason("");
    loadScope();
  };

  const updateItem = (section: string, index: number, field: keyof ScopeItem, value: any) => {
    setSectionItems((prev) => {
      const copy = { ...prev }; copy[section] = [...copy[section]];
      copy[section][index] = { ...copy[section][index], [field]: value }; return copy;
    });
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const statusBadge = () => {
    if (status === "signed") return <Badge className="bg-[#006039] text-white">Signed & Locked</Badge>;
    if (status === "pending_signoff") return <Badge style={{ backgroundColor: "#D4860A", color: "#fff", border: "none" }}>Pending Sign-off</Badge>;
    return <Badge variant="secondary">Draft</Badge>;
  };

  return (
    <div className="space-y-6">
      <SetupTemplateBanner projectId={projectId} />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-lg font-semibold text-foreground">Scope of Work</h2>
          {statusBadge()}
          {locked && <Badge variant="outline" className="gap-1"><Lock className="h-3 w-3" /> Locked</Badge>}
        </div>
        <div className="flex gap-2">
          {canEditDraft && status === "draft" && (
            <>
              <Button size="sm" variant="outline" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />} Save Draft
              </Button>
              <Button size="sm" onClick={submitForSignoff} disabled={saving} style={{ backgroundColor: "#006039" }}>
                <Send className="h-4 w-4 mr-1" /> Submit for Sign-off
              </Button>
            </>
          )}
          {locked && canUnlock && (
            <Button size="sm" variant="outline" onClick={() => setUnlockOpen(true)}>
              <Unlock className="h-4 w-4 mr-1" /> Unlock (Admin)
            </Button>
          )}
          {scopePdfUrl && (
            <Button size="sm" variant="outline" asChild><a href={scopePdfUrl} target="_blank" rel="noreferrer">View Signed PDF</a></Button>
          )}
        </div>
      </div>

      {readOnly && (
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertDescription>
            {status === "signed"
              ? "This Scope of Work is signed and locked. Only Managing Director / Super Admin can unlock it."
              : "This Scope of Work is pending sign-off. Content is read-only until fully signed."}
          </AlertDescription>
        </Alert>
      )}

      {/* General Details */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">General Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">Client Name{changedFromProject("clientName", clientName) && <span className="ml-1 text-[10px]" style={{ color: "#D4860A" }}>(changed from project)</span>}</Label>
            <Input value={clientName} onChange={(e) => setClientName(e.target.value)} disabled={readOnly || !canEditDraft} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Location{changedFromProject("location", location) && <span className="ml-1 text-[10px]" style={{ color: "#D4860A" }}>(changed)</span>}</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} disabled={readOnly || !canEditDraft} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Category</Label>
            <Select value={category} onValueChange={setCategory} disabled={readOnly || !canEditDraft}>
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
            <Select value={division} onValueChange={setDivision} disabled={readOnly || !canEditDraft}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Habitainer">Habitainer</SelectItem>
                <SelectItem value="ADS">ADS</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Built-up Area (sqft){changedFromProject("builtUpArea", builtUpArea) && <span className="ml-1 text-[10px]" style={{ color: "#D4860A" }}>(changed)</span>}</Label>
            <Input type="number" value={builtUpArea} onChange={(e) => setBuiltUpArea(e.target.value)} disabled={readOnly || !canEditDraft} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Module Count{changedFromProject("moduleCount", moduleCount) && <span className="ml-1 text-[10px]" style={{ color: "#D4860A" }}>(changed)</span>}</Label>
            <Input type="number" value={moduleCount} onChange={(e) => setModuleCount(e.target.value)} disabled={readOnly || !canEditDraft} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Deck Area (sqft)</Label>
            <Input type="number" value={deckArea} onChange={(e) => setDeckArea(e.target.value)} disabled={readOnly || !canEditDraft} />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <Label className="text-xs text-muted-foreground">Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} disabled={readOnly || !canEditDraft} rows={2} />
          </div>
        </CardContent>
      </Card>

      {/* Sections */}
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
                    <RadioGroup value={item.responsibility} onValueChange={(v) => updateItem(sectionKey, idx, "responsibility", v)} className="flex gap-4 shrink-0" disabled={readOnly || !canEditDraft}>
                      {(["not_in_scope", "habitainer", "external_contractor"] as Responsibility[]).map((r) => (
                        <div key={r} className="flex items-center gap-1">
                          <RadioGroupItem value={r} id={`${sectionKey}-${idx}-${r}`} />
                          <Label htmlFor={`${sectionKey}-${idx}-${r}`} className="text-xs cursor-pointer">{RESP_LABEL[r]}</Label>
                        </div>
                      ))}
                    </RadioGroup>
                    {def.hasArea && (
                      <Input type="number" placeholder="Area sqft" className="w-24 text-xs"
                        value={item.area_sqft ?? ""}
                        onChange={(e) => updateItem(sectionKey, idx, "area_sqft", e.target.value ? Number(e.target.value) : null)}
                        disabled={readOnly || !canEditDraft} />
                    )}
                    <Input placeholder="Remarks" className="flex-1 text-xs"
                      value={item.remarks ?? ""}
                      onChange={(e) => updateItem(sectionKey, idx, "remarks", e.target.value)}
                      disabled={readOnly || !canEditDraft} />
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {/* Exclusions */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Exclusions</CardTitle>
          {canEditDraft && !readOnly && (
            <Button variant="ghost" size="sm" onClick={() => setExclusions((prev) => [...prev, { exclusion_text: "", is_standard: false, sort_order: prev.length }])}>
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {exclusions.map((excl, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-5 shrink-0">{idx + 1}.</span>
              <Input value={excl.exclusion_text}
                onChange={(e) => setExclusions((prev) => prev.map((ex, i) => i === idx ? { ...ex, exclusion_text: e.target.value } : ex))}
                className="text-sm flex-1"
                disabled={readOnly || !canEditDraft} />
              {canEditDraft && !readOnly && !excl.is_standard && (
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setExclusions((prev) => prev.filter((_, i) => i !== idx))}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Sign-off block */}
      {status !== "draft" && (
        <Card style={{ borderColor: "#006039", borderWidth: 2 }}>
          <CardHeader className="pb-3"><CardTitle className="text-base">Sign-off</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Client */}
              <div className="rounded-lg border p-3 space-y-2">
                <p className="text-sm font-semibold">Client Signature</p>
                {clientSignedAt ? (
                  <div className="text-sm">
                    <p className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" style={{ color: "#006039" }} /> Signed by <strong>{clientSignedBy}</strong></p>
                    <p className="text-xs text-muted-foreground">{format(new Date(clientSignedAt), "dd/MM/yyyy HH:mm")}</p>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">Client signs via a single-use magic link.</p>
                    <Button size="sm" variant="outline" onClick={generateClientLink}><PenLine className="h-4 w-4 mr-1" /> Generate client sign link</Button>
                  </>
                )}
              </div>
              {/* Sales Director */}
              <div className="rounded-lg border p-3 space-y-2">
                <p className="text-sm font-semibold">Sales Director Signature</p>
                {sdSignedAt ? (
                  <div className="text-sm">
                    <p className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" style={{ color: "#006039" }} /> Approved by Sales Director</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(sdSignedAt), "dd/MM/yyyy HH:mm")}</p>
                  </div>
                ) : canSdSign ? (
                  <Button size="sm" onClick={salesDirectorSign} style={{ backgroundColor: "#006039" }}><CheckCircle2 className="h-4 w-4 mr-1" /> Approve as Sales Director</Button>
                ) : (
                  <p className="text-xs text-muted-foreground">Awaiting Sales Director approval.</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sale Agreement card (visible always; gated internally) */}
      {scopeId && (
        <SaleAgreementCard
          projectId={projectId}
          scopeId={scopeId}
          scopeStatus={status}
          projectName={clientName || "Project"}
          clientName={clientName}
          contractValue={0}
          userRole={userRole}
        />
      )}

      {/* Client link dialog */}
      <Dialog open={signLinkOpen} onOpenChange={setSignLinkOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Client sign-off link</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Share this single-use link with the client. It expires in 14 days.</p>
          <div className="flex gap-2 items-center">
            <Input readOnly value={signLinkUrl ?? ""} />
            <Button size="sm" variant="outline" onClick={() => { if (signLinkUrl) { navigator.clipboard.writeText(signLinkUrl); toast.success("Copied"); }}}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setSignLinkOpen(false)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unlock dialog */}
      <Dialog open={unlockOpen} onOpenChange={setUnlockOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Unlock signed Scope of Work</DialogTitle></DialogHeader>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>This action will be logged. Provide a clear reason.</AlertDescription>
          </Alert>
          <Textarea placeholder="Reason for unlocking (min 5 characters)" value={unlockReason} onChange={(e) => setUnlockReason(e.target.value)} rows={3} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnlockOpen(false)}>Cancel</Button>
            <Button onClick={doUnlock} style={{ backgroundColor: "#F40009" }}>Unlock & Log</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
