import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, Upload, Check, FileText, Image as ImageIcon, X, Truck } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { insertNotifications } from "@/lib/notifications";

type DocKey =
  | "qc_certificate"
  | "module_id_label"
  | "packing_photos"
  | "loading_photo";

interface DocSpec {
  key: DocKey;
  label: string;
  accept: string;
  multiple?: boolean;
  minCount?: number;
  hint?: string;
}

const DOC_SPECS: DocSpec[] = [
  { key: "qc_certificate", label: "QC Certificate", accept: "application/pdf", hint: "PDF" },
  { key: "module_id_label", label: "Module ID Label photo", accept: "image/*", hint: "Image" },
  { key: "packing_photos", label: "Packing photo — all 4 faces", accept: "image/*", multiple: true, minCount: 3, hint: "3+ images" },
  { key: "loading_photo", label: "Loading photo at lifting points", accept: "image/*", hint: "Image" },
];

interface UploadedDoc {
  key: DocKey;
  name: string;
  url: string;
}

export default function DispatchPackForm() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const projectId = params.get("projectId") ?? "";
  const projectName = params.get("projectName") ?? "";

  const [moduleId, setModuleId] = useState("");
  const [dispatchDate, setDispatchDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [pieces, setPieces] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [destination, setDestination] = useState("");
  const [notes, setNotes] = useState("");
  const [docs, setDocs] = useState<UploadedDoc[]>([]);
  const [uploadingKey, setUploadingKey] = useState<DocKey | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadProject = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("projects")
      .select("location")
      .eq("id", projectId)
      .maybeSingle();
    if (data?.location) setDestination(data.location);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { loadProject(); }, [loadProject]);

  const docsForKey = (key: DocKey) => docs.filter((d) => d.key === key);

  const removeDoc = (url: string) => setDocs((prev) => prev.filter((d) => d.url !== url));

  const uploadFiles = async (spec: DocSpec, files: FileList) => {
    setUploadingKey(spec.key);
    try {
      const newDocs: UploadedDoc[] = [];
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop();
        const path = `dispatch-packs/${projectId}/${Date.now()}_${spec.key}.${ext}`;
        const bucket = spec.accept.startsWith("application/pdf") ? "drawings" : "site-photos";
        const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
        if (error) throw error;
        const url = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
        newDocs.push({ key: spec.key, name: file.name, url });
      }
      setDocs((prev) => {
        // For single-file slots, replace existing
        if (!spec.multiple) {
          return [...prev.filter((d) => d.key !== spec.key), ...newDocs];
        }
        return [...prev, ...newDocs];
      });
      toast.success(`${spec.label} uploaded`);
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploadingKey(null);
    }
  };

  const docStatus = (spec: DocSpec) => {
    const count = docsForKey(spec.key).length;
    const required = spec.minCount ?? 1;
    return count >= required ? "ok" : "missing";
  };

  const allDocsComplete = DOC_SPECS.every((s) => docStatus(s) === "ok");
  const computedStatus = allDocsComplete ? "ready_to_dispatch" : "draft";

  const validateBasic = () => {
    if (!moduleId.trim()) { toast.error("Module ID is required"); return false; }
    if (!dispatchDate) { toast.error("Dispatch date is required"); return false; }
    if (!vehicleNumber.trim()) { toast.error("Vehicle number is required"); return false; }
    if (!driverName.trim()) { toast.error("Driver name is required"); return false; }
    if (driverPhone.replace(/\D/g, "").length !== 10) { toast.error("Driver phone must be 10 digits"); return false; }
    if (!pieces.trim() || Number(pieces) <= 0) { toast.error("Number of pieces required"); return false; }
    return true;
  };

  const save = async (markDispatched: boolean) => {
    if (!validateBasic()) return;
    if (markDispatched && !allDocsComplete) {
      toast.error("All documents must be uploaded to mark as dispatched");
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const dateStr = dispatchDate.replace(/-/g, "");
      const { data: existing } = await (supabase.from("dispatch_packs") as any)
        .select("dispatch_pack_id")
        .like("dispatch_pack_id", `DP-${dateStr}-%`);
      const seq = (existing?.length ?? 0) + 1;
      const packId = `DP-${dateStr}-${String(seq).padStart(3, "0")}`;

      const status = markDispatched ? "dispatched" : computedStatus;

      const { error } = await (supabase.from("dispatch_packs") as any).insert({
        dispatch_pack_id: packId,
        project_id: projectId,
        dispatch_date: dispatchDate,
        module_id: moduleId.trim(),
        vehicle_number: vehicleNumber.trim(),
        driver_name: driverName.trim(),
        driver_phone: driverPhone.trim(),
        pieces_count: Number(pieces),
        weight_kg: weightKg.trim() ? Number(weightKg) : null,
        destination: destination.trim() || null,
        documents: docs,
        notes: notes.trim() || null,
        loading_checklist_complete: allDocsComplete,
        created_by: user.id,
        status,
      });
      if (error) throw error;

      // Notify SIMs of new pack
      const { data: sims } = await supabase
        .from("profiles")
        .select("auth_user_id")
        .eq("role", "site_installation_mgr" as any)
        .eq("is_active", true);
      if (sims?.length) {
        await insertNotifications(sims.map((r: any) => ({
          recipient_id: r.auth_user_id,
          title: markDispatched ? "Module Dispatched" : "Dispatch Pack Created",
          body: `${packId} — Module ${moduleId.trim()} on ${vehicleNumber.trim()}.`,
          category: "Production",
          related_table: "dispatch_packs",
          navigate_to: "/dispatch-delivery",
        })));
      }

      toast.success(markDispatched ? "Marked as dispatched" : "Saved as draft");
      navigate("/dispatch-delivery");
    } catch (err: any) {
      toast.error(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#FFFFFF" }}>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dispatch-delivery")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-display text-xl md:text-2xl font-bold" style={{ color: "#1A1A1A" }}>
              Create Dispatch Pack
            </h1>
            <p className="text-sm" style={{ color: "#666666" }}>{projectName}</p>
          </div>
          <Badge variant="outline" style={{
            backgroundColor: computedStatus === "ready_to_dispatch" ? "#E8F2ED" : "#FFF8E8",
            color: computedStatus === "ready_to_dispatch" ? "#006039" : "#D4860A",
            border: "none",
          }}>
            {computedStatus === "ready_to_dispatch" ? "Ready to Dispatch" : "Incomplete"}
          </Badge>
        </div>

        {/* Module & Vehicle */}
        <section className="rounded-lg border p-4 space-y-3" style={{ backgroundColor: "#F7F7F7" }}>
          <h2 className="font-display text-sm font-bold uppercase flex items-center gap-2" style={{ color: "#006039" }}>
            <Truck className="h-4 w-4" /> Module & Vehicle
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Module ID <span style={{ color: "#F40009" }}>*</span></Label>
              <Input value={moduleId} onChange={(e) => setModuleId(e.target.value)} placeholder="e.g. M1, Panel-01" className="mt-1 text-sm bg-white" />
            </div>
            <div>
              <Label className="text-xs">Dispatch Date <span style={{ color: "#F40009" }}>*</span></Label>
              <Input type="date" value={dispatchDate} onChange={(e) => setDispatchDate(e.target.value)} className="mt-1 text-sm bg-white" />
            </div>
            <div>
              <Label className="text-xs">Vehicle Number <span style={{ color: "#F40009" }}>*</span></Label>
              <Input value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} placeholder="KA01AB1234" className="mt-1 text-sm bg-white" />
            </div>
            <div>
              <Label className="text-xs">Driver Name <span style={{ color: "#F40009" }}>*</span></Label>
              <Input value={driverName} onChange={(e) => setDriverName(e.target.value)} placeholder="Full name" className="mt-1 text-sm bg-white" />
            </div>
            <div>
              <Label className="text-xs">Driver Phone <span style={{ color: "#F40009" }}>*</span></Label>
              <Input type="tel" maxLength={10} value={driverPhone} onChange={(e) => setDriverPhone(e.target.value.replace(/\D/g, ""))} placeholder="10 digits" className="mt-1 text-sm bg-white" />
            </div>
            <div>
              <Label className="text-xs">Pieces Loaded <span style={{ color: "#F40009" }}>*</span></Label>
              <Input type="number" min={1} value={pieces} onChange={(e) => setPieces(e.target.value)} className="mt-1 text-sm bg-white" />
            </div>
            <div>
              <Label className="text-xs">Weight (KG)</Label>
              <Input type="number" min={0} value={weightKg} onChange={(e) => setWeightKg(e.target.value)} placeholder="optional" className="mt-1 text-sm bg-white" />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Destination (site address)</Label>
              <Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Auto-filled from project" className="mt-1 text-sm bg-white" />
            </div>
          </div>
        </section>

        {/* Documents */}
        <section className="rounded-lg border p-4 space-y-3" style={{ backgroundColor: "#F7F7F7" }}>
          <h2 className="font-display text-sm font-bold uppercase" style={{ color: "#006039" }}>
            Documents to Attach
          </h2>
          <p className="text-xs" style={{ color: "#666" }}>Each is optional but missing items will keep status as Incomplete.</p>
          <div className="space-y-2">
            {DOC_SPECS.map((spec) => {
              const items = docsForKey(spec.key);
              const ok = docStatus(spec) === "ok";
              return (
                <div key={spec.key} className="rounded-md border bg-white p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      {ok ? <Check className="h-4 w-4 shrink-0" style={{ color: "#006039" }} /> : <span className="h-4 w-4 rounded border shrink-0" style={{ borderColor: "#D4860A" }} />}
                      <span className="text-sm font-medium truncate" style={{ color: "#1A1A1A" }}>{spec.label}</span>
                      <span className="text-[10px]" style={{ color: "#999" }}>({spec.hint})</span>
                    </div>
                    <label className="cursor-pointer">
                      <Button size="sm" variant="outline" className="text-xs gap-1" disabled={uploadingKey === spec.key} asChild>
                        <span>
                          {uploadingKey === spec.key ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                          Upload
                        </span>
                      </Button>
                      <input
                        type="file"
                        accept={spec.accept}
                        multiple={spec.multiple}
                        className="hidden"
                        onChange={(e) => e.target.files && e.target.files.length > 0 && uploadFiles(spec, e.target.files)}
                      />
                    </label>
                  </div>
                  {items.length > 0 && (
                    <ul className="space-y-1">
                      {items.map((doc) => (
                        <li key={doc.url} className="flex items-center gap-2 text-xs px-2 py-1 rounded" style={{ backgroundColor: "#F7F7F7" }}>
                          {spec.accept.startsWith("application/pdf") ? <FileText className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
                          <a href={doc.url} target="_blank" rel="noreferrer" className="truncate flex-1 underline" style={{ color: "#006039" }}>{doc.name}</a>
                          <button onClick={() => removeDoc(doc.url)} className="text-muted-foreground hover:text-destructive">
                            <X className="h-3 w-3" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
          <div className="text-[11px] flex flex-wrap gap-3 pt-1" style={{ color: "#666" }}>
            <span>Delivery Checklist → completed in <strong>Tab 2</strong> (3-part sign-off)</span>
            <span>Installation Sequence → completed in <strong>Tab 3</strong></span>
          </div>
        </section>

        {/* Notes */}
        <section className="rounded-lg border p-4 space-y-2" style={{ backgroundColor: "#F7F7F7" }}>
          <Label className="text-xs">Notes / Remarks</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="bg-white text-sm" rows={3} />
        </section>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2 sticky bottom-0 bg-white py-3">
          <Button variant="outline" className="flex-1" onClick={() => save(false)} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save Draft
          </Button>
          <Button
            className="flex-1"
            style={{ backgroundColor: "#006039", color: "#FFFFFF" }}
            onClick={() => save(true)}
            disabled={saving || !allDocsComplete}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Mark as Dispatched
          </Button>
        </div>
      </div>
    </div>
  );
}
