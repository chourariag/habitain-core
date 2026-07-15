import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthedClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileText, Camera, Loader2, Check, X, PartyPopper, Mail, AlertTriangle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Props {
  projectId: string;
  clientName: string | null;
  userRole: string | null;
  installationComplete: boolean;
  onHandedOver: () => void;
}

type Readiness = {
  qc_ok: boolean;
  ncr_ok: boolean;
  dq_ok: boolean;
  snag_ok: boolean;
  dispatch_ok: boolean;
  final_qc_ok: boolean;
};

const ChecklistRow = ({ ok, label }: { ok: boolean; label: string }) => (
  <div className="flex items-center gap-2 text-xs py-1">
    {ok ? <Check className="h-3.5 w-3.5 text-primary" /> : <X className="h-3.5 w-3.5 text-destructive" />}
    <span className={ok ? "text-foreground" : "text-destructive"}>{label}</span>
    <span className="ml-auto text-[10px] uppercase tracking-wide">{ok ? "Complete" : "Missing"}</span>
  </div>
);

export function HandoverPack({ projectId, clientName, userRole, installationComplete, onHandedOver }: Props) {
  const [existing, setExisting] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [project, setProject] = useState<any>(null);
  const [readiness, setReadiness] = useState<Readiness | null>(null);

  // Manual uploads / confirmations
  const [completionCertUrl, setCompletionCertUrl] = useState("");
  const [asBuiltUrl, setAsBuiltUrl] = useState("");
  const [warrantyUrl, setWarrantyUrl] = useState("");
  const [measurementConfirmed, setMeasurementConfirmed] = useState(false);
  const [keysConfirmed, setKeysConfirmed] = useState(false);

  const [snagList, setSnagList] = useState("");
  const [omUrl, setOmUrl] = useState("");
  const [handoverDate, setHandoverDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [signoffName, setSignoffName] = useState("");
  const [handoverNotes, setHandoverNotes] = useState("");
  const [declaration, setDeclaration] = useState(false);
  const [snagPhotos, setSnagPhotos] = useState<File[]>([]);
  const [snagPreviews, setSnagPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [approving, setApproving] = useState(false);

  const canInitiate = ["head_of_projects", "super_admin"].includes(userRole ?? "");
  const canApprove = ["managing_director", "super_admin"].includes(userRole ?? "");

  useEffect(() => { loadAll(); }, [projectId]);

  const loadAll = async () => {
    setLoading(true);
    const [{ data: proj }, { data: hp }, { data: rd }] = await Promise.all([
      supabase.from("projects").select("*").eq("id", projectId).single(),
      (supabase.from("handover_pack") as any).select("*").eq("project_id", projectId).order("created_at", { ascending: false }).limit(1),
      (supabase.rpc as any)("get_handover_readiness", { _project_id: projectId }),
    ]);
    setProject(proj);
    setExisting((hp as any[])?.[0] ?? null);
    setReadiness(rd as Readiness | null);
    setLoading(false);
  };

  const handlePhotoAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setSnagPhotos((prev) => [...prev, ...files]);
    setSnagPreviews((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))]);
  };

  const allReady = readiness && readiness.qc_ok && readiness.ncr_ok && readiness.dq_ok && readiness.snag_ok && readiness.dispatch_ok;
  const finalQcDone = !!readiness?.final_qc_ok;
  const manualReady = !!completionCertUrl.trim() && !!asBuiltUrl.trim() && measurementConfirmed && keysConfirmed;

  const handleSubmit = async () => {
    if (!signoffName.trim()) { toast.error("Client sign-off name is required."); return; }
    if (!declaration) { toast.error("Please confirm the declaration checkbox."); return; }
    if (!allReady) { toast.error("All auto-checks must be complete."); return; }
    if (!finalQcDone) { toast.error("Final QC inspection required."); return; }
    if (!manualReady) { toast.error("Upload all mandatory documents and confirm checklist."); return; }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const urls: string[] = [];
      for (const photo of snagPhotos) {
        const path = `handover/${projectId}/${Date.now()}-${photo.name}`;
        const { error } = await supabase.storage.from("site-photos").upload(path, photo);
        if (error) throw error;
        const { data: urlData } = supabase.storage.from("site-photos").getPublicUrl(path);
        urls.push(urlData.publicUrl);
      }

      const { client } = await getAuthedClient();
      const { data: inserted, error: hErr } = await (client.from("handover_pack") as any).insert({
        project_id: projectId,
        client_name: clientName || "",
        snag_list: snagList.trim() || null,
        snag_photos: urls,
        om_document_url: omUrl.trim() || null,
        handover_date: handoverDate,
        client_signoff_name: signoffName.trim(),
        handover_notes: handoverNotes.trim() || null,
        submitted_by: user.id,
        client_completion_certificate_url: completionCertUrl.trim(),
        as_built_drawings_url: asBuiltUrl.trim(),
        warranty_docs_url: warrantyUrl.trim() || null,
        snagging_list_closed: readiness!.snag_ok,
        dispatch_records_confirmed: readiness!.dispatch_ok,
        measurement_sheets_confirmed: measurementConfirmed,
        keys_manuals_checklist_confirmed: keysConfirmed,
        md_approval_status: "pending",
      }).select().single();
      if (hErr) throw hErr;

      // Update project status to handover_pending
      await supabase.from("projects").update({ status: "handover_pending" }).eq("id", projectId);

      // Notify managing_director
      const { data: mdRoles } = await supabase
        .from("user_roles")
        .select("user_id, profiles!inner(is_active)")
        .eq("role", "managing_director" as any)
        .eq("profiles.is_active", true);
      if (mdRoles?.length) {
        const projName = project?.name || "Project";
        await supabase.from("notifications").insert(
          mdRoles.map((r: any) => ({
            recipient_id: r.user_id,
            title: `${projName} — Handover Pack complete`,
            body: "Your approval required to close the project.",
            content: "Your approval required to close the project.",
            type: "handover_approval",
            category: "approval",
            related_table: "handover_pack",
            related_id: inserted?.id,
          }))
        );
      }

      setJustSubmitted(true);
      onHandedOver();
      await loadAll();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  const handleMdApprove = async () => {
    if (!existing?.id) return;
    setApproving(true);
    try {
      const { error } = await (supabase.rpc as any)("approve_handover_and_close", { _handover_id: existing.id });
      if (error) throw error;
      toast.success("Project closed successfully");
      await loadAll();
    } catch (err: any) {
      toast.error(err.message || "Approval failed");
    } finally {
      setApproving(false);
    }
  };

  const handleSendToClient = () => {
    const email = project?.client_email || "";
    const projName = project?.name || "Project";
    const cName = project?.client_name || "Client";
    const subject = encodeURIComponent(`Handover Document — ${projName}`);
    const body = encodeURIComponent(
      `Dear ${cName},\n\nPlease find attached the handover document for your ${projName} project.\n\nThank you for choosing The Habitainer.\n\nRegards,\nThe Habitainer Team`
    );
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, "_self");
  };

  if (loading) return null;

  // Already submitted handover pack
  if (justSubmitted || existing) {
    const data = existing;
    const isClosed = project?.status === "closed";
    const isPending = data?.md_approval_status === "pending";
    return (
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm flex items-center gap-2 text-primary">
            {isClosed ? <PartyPopper className="h-4 w-4" /> : <Check className="h-4 w-4" />}
            {isClosed ? "Project Closed" : isPending ? "Handover Pack Submitted — Awaiting MD Approval" : "Handed Over"}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3 space-y-2">
          {data && (
            <>
              <p className="text-xs text-foreground/70">Client: {data.client_name}</p>
              <p className="text-xs text-foreground/70">Date: {format(new Date(data.handover_date), "dd/MM/yyyy")}</p>
              <p className="text-xs text-foreground/70">Signed off by: {data.client_signoff_name}</p>
              <p className="text-xs text-foreground/70">MD Approval: <span className="font-medium">{data.md_approval_status}</span></p>
            </>
          )}
          {isPending && canApprove && (
            <Button size="sm" onClick={handleMdApprove} disabled={approving} className="mt-2 gap-1.5">
              {approving && <Loader2 className="h-4 w-4 animate-spin" />}
              <ShieldCheck className="h-4 w-4" /> Approve & Close Project
            </Button>
          )}
          {project?.client_email && (
            <Button size="sm" variant="outline" onClick={handleSendToClient} className="mt-2 gap-1.5">
              <Mail className="h-4 w-4" /> Send to Client
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (!canInitiate) {
    return (
      <Card><CardContent className="py-8 text-center">
        <p className="text-sm text-muted-foreground">Only the Head of Projects can initiate the handover pack.</p>
      </CardContent></Card>
    );
  }

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm flex items-center gap-2 text-card-foreground">
          <FileText className="h-4 w-4" /> Initiate Handover
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-4">
        {/* Final QC gate */}
        {!finalQcDone && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Final QC inspection by QC Inspector required before handover can be initiated.
            </AlertDescription>
          </Alert>
        )}

        {/* Auto-checks */}
        <div className="rounded border border-border p-3 bg-muted/20">
          <p className="text-xs font-semibold mb-2 text-foreground">Auto-Confirmed from HStack</p>
          {readiness && (
            <>
              <ChecklistRow ok={readiness.qc_ok} label="QC Reports (all stages passed)" />
              <ChecklistRow ok={readiness.ncr_ok} label="NCR Records (all closed)" />
              <ChecklistRow ok={readiness.dq_ok} label="DQ Resolutions (all closed)" />
              <ChecklistRow ok={readiness.snag_ok} label="Snagging List (all closed)" />
              <ChecklistRow ok={readiness.dispatch_ok} label="Dispatch Records (all modules)" />
              <ChecklistRow ok={readiness.final_qc_ok} label="Final QC Inspection passed" />
            </>
          )}
        </div>

        {/* Manual uploads */}
        <div className="rounded border border-border p-3 space-y-3">
          <p className="text-xs font-semibold text-foreground">Mandatory Document Uploads</p>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Client Completion Certificate URL *</label>
            <Input value={completionCertUrl} onChange={(e) => setCompletionCertUrl(e.target.value)} placeholder="https://..." className="mt-1 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">As-Built Drawings URL *</label>
            <Input value={asBuiltUrl} onChange={(e) => setAsBuiltUrl(e.target.value)} placeholder="https://..." className="mt-1 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Warranty Documents URL (optional)</label>
            <Input value={warrantyUrl} onChange={(e) => setWarrantyUrl(e.target.value)} placeholder="https://..." className="mt-1 text-sm" />
          </div>
          <div className="flex items-start gap-2">
            <Checkbox id="meas" checked={measurementConfirmed} onCheckedChange={(c) => setMeasurementConfirmed(c === true)} className="mt-0.5" />
            <label htmlFor="meas" className="text-xs text-muted-foreground cursor-pointer">Measurement sheets confirmed</label>
          </div>
          <div className="flex items-start gap-2">
            <Checkbox id="keys" checked={keysConfirmed} onCheckedChange={(c) => setKeysConfirmed(c === true)} className="mt-0.5" />
            <label htmlFor="keys" className="text-xs text-muted-foreground cursor-pointer">Keys & Manuals checklist confirmed</label>
          </div>
        </div>

        {/* Sign-off details */}
        <div>
          <label className="text-xs font-medium text-muted-foreground">Client Name</label>
          <Input value={clientName || ""} disabled className="mt-1 text-sm bg-muted/30" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Handover Date</label>
          <Input type="date" value={handoverDate} onChange={(e) => setHandoverDate(e.target.value)} className="mt-1 text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Snag List (residual)</label>
          <Textarea value={snagList} onChange={(e) => setSnagList(e.target.value)} placeholder="List any outstanding items..." className="mt-1 text-sm" rows={2} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Snag Photos</label>
          <div className="flex flex-wrap gap-2 mt-2">
            {snagPreviews.map((url, idx) => (
              <img key={idx} src={url} alt={`Snag ${idx + 1}`} className="h-14 w-14 rounded object-cover border border-border" />
            ))}
            <label className="h-14 w-14 rounded border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary/50">
              <Camera className="h-5 w-5 text-muted-foreground" />
              <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoAdd} />
            </label>
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">O&M Document Link</label>
          <Input value={omUrl} onChange={(e) => setOmUrl(e.target.value)} placeholder="https://..." className="mt-1 text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Handover Notes</label>
          <Textarea value={handoverNotes} onChange={(e) => setHandoverNotes(e.target.value)} placeholder="Additional notes..." className="mt-1 text-sm" rows={2} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Client Digital Sign-off (typed name) *</label>
          <Input value={signoffName} onChange={(e) => setSignoffName(e.target.value)} placeholder="Client representative full name" className="mt-1 text-sm" />
        </div>
        <div className="flex items-start gap-2 pt-1">
          <Checkbox id="declaration" checked={declaration} onCheckedChange={(checked) => setDeclaration(checked === true)} className="mt-0.5" />
          <label htmlFor="declaration" className="text-xs text-muted-foreground leading-snug cursor-pointer">
            I confirm the above information is accurate and the project is ready for handover.
          </label>
        </div>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={submitting || !declaration || !allReady || !finalQcDone || !manualReady}
          className="w-full"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
          Initiate Handover (sends to MD for approval)
        </Button>
      </CardContent>
    </Card>
  );
}
