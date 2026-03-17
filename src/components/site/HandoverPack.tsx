import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthedClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Camera, Loader2, Check, PartyPopper } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Props {
  projectId: string;
  clientName: string | null;
  userRole: string | null;
  installationComplete: boolean;
  onHandedOver: () => void;
}

export function HandoverPack({ projectId, clientName, userRole, installationComplete, onHandedOver }: Props) {
  const [existing, setExisting] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [justSubmitted, setJustSubmitted] = useState(false);

  // Form
  const [snagList, setSnagList] = useState("");
  const [omUrl, setOmUrl] = useState("");
  const [handoverDate, setHandoverDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [signoffName, setSignoffName] = useState("");
  const [handoverNotes, setHandoverNotes] = useState("");
  const [declaration, setDeclaration] = useState(false);
  const [snagPhotos, setSnagPhotos] = useState<File[]>([]);
  const [snagPreviews, setSnagPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const canCreate = ["delivery_rm_lead", "super_admin", "managing_director"].includes(userRole ?? "");

  useEffect(() => {
    loadExisting();
  }, [projectId]);

  const loadExisting = async () => {
    setLoading(true);
    const { data } = await (supabase.from("handover_pack" as any) as any)
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1);
    setExisting((data as any[])?.[0] ?? null);
    setLoading(false);
  };

  const handlePhotoAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setSnagPhotos((prev) => [...prev, ...files]);
    setSnagPreviews((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))]);
  };

  const handleSubmit = async () => {
    if (!signoffName.trim()) {
      toast.error("Client sign-off name is required.");
      return;
    }
    if (!declaration) {
      toast.error("Please confirm the declaration checkbox.");
      return;
    }
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Upload snag photos
      const urls: string[] = [];
      for (const photo of snagPhotos) {
        const path = `handover/${projectId}/${Date.now()}-${photo.name}`;
        const { error } = await supabase.storage.from("site-photos").upload(path, photo);
        if (error) throw error;
        const { data: urlData } = supabase.storage.from("site-photos").getPublicUrl(path);
        urls.push(urlData.publicUrl);
      }

      const { client } = await getAuthedClient();

      const { error: hErr } = await (client.from("handover_pack" as any) as any).insert({
        project_id: projectId,
        client_name: clientName || "",
        snag_list: snagList.trim() || null,
        snag_photos: urls,
        om_document_url: omUrl.trim() || null,
        handover_date: handoverDate,
        client_signoff_name: signoffName.trim(),
        handover_notes: handoverNotes.trim() || null,
        submitted_by: user.id,
      });
      if (hErr) throw hErr;

      const { error: pErr } = await client.from("projects").update({
        status: "handed_over",
      }).eq("id", projectId);
      if (pErr) throw pErr;

      setJustSubmitted(true);
      onHandedOver();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return null;

  // Confirmation screen after submission
  if (justSubmitted) {
    return (
      <Card className="border-success/30 bg-success/5">
        <CardContent className="py-10 text-center space-y-3">
          <PartyPopper className="h-10 w-10 mx-auto text-success" />
          <h3 className="text-lg font-semibold text-success">Project successfully handed over</h3>
          <p className="text-sm text-card-foreground/70">
            The handover pack has been recorded and the project status has been updated.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (existing) {
    return (
      <Card className="border-success/30 bg-success/5">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm flex items-center gap-2 text-success">
            <Check className="h-4 w-4" /> Handed Over
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3 space-y-1">
          <p className="text-xs text-card-foreground/70">Client: {existing.client_name}</p>
          <p className="text-xs text-card-foreground/70">Date: {format(new Date(existing.handover_date), "dd/MM/yyyy")}</p>
          <p className="text-xs text-card-foreground/70">Signed off by: {existing.client_signoff_name}</p>
        </CardContent>
      </Card>
    );
  }

  if (!canCreate) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-sm text-card-foreground/60">Only authorized roles can create a handover pack.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm flex items-center gap-2 text-card-foreground">
          <FileText className="h-4 w-4" /> Create Handover Pack
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-3">
        <div>
          <label className="text-xs font-medium text-card-foreground/70">Client Name</label>
          <Input value={clientName || ""} disabled className="mt-1 text-sm bg-muted/30" />
        </div>
        <div>
          <label className="text-xs font-medium text-card-foreground/70">Handover Date</label>
          <Input
            type="date"
            value={handoverDate}
            onChange={(e) => setHandoverDate(e.target.value)}
            className="mt-1 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-card-foreground/70">Snag List</label>
          <Textarea
            value={snagList}
            onChange={(e) => setSnagList(e.target.value)}
            placeholder="List any outstanding items or snags..."
            className="mt-1 text-sm"
            rows={3}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-card-foreground/70">Snag Photos</label>
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
          <label className="text-xs font-medium text-card-foreground/70">O&M Document Link</label>
          <Input
            value={omUrl}
            onChange={(e) => setOmUrl(e.target.value)}
            placeholder="https://..."
            className="mt-1 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-card-foreground/70">Handover Notes</label>
          <Textarea
            value={handoverNotes}
            onChange={(e) => setHandoverNotes(e.target.value)}
            placeholder="Any additional notes for the handover..."
            className="mt-1 text-sm"
            rows={3}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-card-foreground/70">Client Digital Sign-off (typed name)</label>
          <Input
            value={signoffName}
            onChange={(e) => setSignoffName(e.target.value)}
            placeholder="Client representative full name"
            className="mt-1 text-sm"
          />
        </div>

        <div className="flex items-start gap-2 pt-1">
          <Checkbox
            id="declaration"
            checked={declaration}
            onCheckedChange={(checked) => setDeclaration(checked === true)}
            className="mt-0.5"
          />
          <label htmlFor="declaration" className="text-xs text-card-foreground/70 leading-snug cursor-pointer">
            I confirm the above information is accurate and the project is ready for handover.
          </label>
        </div>

        <Button size="sm" onClick={handleSubmit} disabled={submitting || !declaration} className="w-full">
          {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
          Submit Handover Pack
        </Button>
      </CardContent>
    </Card>
  );
}
