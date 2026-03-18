import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getAuthedClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Props {
  designFile: any;
  projectId: string;
  canEdit: boolean;
  onSaved: () => void;
}

export function BriefScopeSection({ designFile, projectId, canEdit, onSaved }: Props) {
  const [local, setLocal] = useState({
    site_visit_done: false,
    measurements_confirmed: false,
    survey_report_uploaded: false,
    client_requirements_documented: false,
    budget_discussed: false,
    site_area_sqft: "",
    num_floors: "",
    special_requirements: "",
  });
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (designFile) {
      setLocal({
        site_visit_done: designFile.site_visit_done ?? false,
        measurements_confirmed: designFile.measurements_confirmed ?? false,
        survey_report_uploaded: designFile.survey_report_uploaded ?? false,
        client_requirements_documented: designFile.client_requirements_documented ?? false,
        budget_discussed: designFile.budget_discussed ?? false,
        site_area_sqft: designFile.site_area_sqft ?? "",
        num_floors: designFile.num_floors ?? "",
        special_requirements: designFile.special_requirements ?? "",
      });
      setDirty(false);
    }
  }, [designFile?.id]);

  const update = (field: string, value: any) => {
    setLocal((prev) => ({ ...prev, [field]: value }));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!designFile?.id) return;
    setSaving(true);
    try {
      const { client } = await getAuthedClient();
      await (client.from("project_design_files") as any).update({
        site_visit_done: local.site_visit_done,
        measurements_confirmed: local.measurements_confirmed,
        survey_report_uploaded: local.survey_report_uploaded,
        client_requirements_documented: local.client_requirements_documented,
        budget_discussed: local.budget_discussed,
        site_area_sqft: local.site_area_sqft ? parseFloat(String(local.site_area_sqft)) : null,
        num_floors: local.num_floors ? parseInt(String(local.num_floors)) : null,
        special_requirements: local.special_requirements || null,
      }).eq("id", designFile.id);
      toast.success("Brief & Scope saved");
      setDirty(false);
      onSaved();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleBriefUpload = async (file: File) => {
    const path = `briefs/${projectId}/${Date.now()}.pdf`;
    await supabase.storage.from("design-files").upload(path, file);
    const url = supabase.storage.from("design-files").getPublicUrl(path).data.publicUrl;
    const { client } = await getAuthedClient();
    await (client.from("project_design_files") as any).update({ client_brief_url: url }).eq("id", designFile.id);
    toast.success("Brief PDF uploaded");
    onSaved();
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">A — Brief & Scope</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <p className="text-xs font-semibold" style={{ color: "#666666" }}>Scope Checklist</p>
          {[
            { field: "site_visit_done", label: "Site visit done" },
            { field: "measurements_confirmed", label: "Measurements confirmed" },
            { field: "survey_report_uploaded", label: "Survey report uploaded" },
            { field: "client_requirements_documented", label: "Client requirements documented" },
            { field: "budget_discussed", label: "Budget discussed" },
          ].map((item) => (
            <div key={item.field} className="flex items-center gap-2">
              <Checkbox
                checked={(local as any)[item.field]}
                onCheckedChange={(v) => canEdit && update(item.field, !!v)}
                disabled={!canEdit}
              />
              <span className="text-sm">{item.label}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Site Area (sq ft)</Label>
            <Input type="number" value={local.site_area_sqft} onChange={(e) => canEdit && update("site_area_sqft", e.target.value)} disabled={!canEdit} />
          </div>
          <div>
            <Label className="text-xs">Number of Floors</Label>
            <Input type="number" value={local.num_floors} onChange={(e) => canEdit && update("num_floors", e.target.value)} disabled={!canEdit} />
          </div>
        </div>
        <div>
          <Label className="text-xs">Special Requirements</Label>
          <Textarea value={local.special_requirements} onChange={(e) => canEdit && update("special_requirements", e.target.value)} disabled={!canEdit} rows={2} />
        </div>
        <div>
          <Label className="text-xs">Client Brief PDF</Label>
          <Input type="file" accept=".pdf" disabled={!canEdit} onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleBriefUpload(file);
          }} />
          {designFile?.client_brief_url && (
            <a href={designFile.client_brief_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary mt-1 inline-block">View Brief PDF</a>
          )}
        </div>
        {canEdit && dirty && (
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Save Brief & Scope
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
