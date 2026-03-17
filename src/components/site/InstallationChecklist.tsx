import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthedClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Check, X, Camera, Wrench, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  moduleId: string;
  userRole: string | null;
  onComplete: () => void;
}

const ITEMS = [
  { key: "lifting_sequence", photoKey: "lifting_photo", label: "Lifting sequence complete" },
  { key: "module_connections", photoKey: "connections_photo", label: "Module connections secure" },
  { key: "mep_stitching", photoKey: "mep_photo", label: "MEP stitching done" },
  { key: "weatherproofing", photoKey: "weatherproofing_photo", label: "Weatherproofing applied" },
  { key: "snagging", photoKey: "snagging_photo", label: "Snagging complete" },
] as const;

type ItemKey = typeof ITEMS[number]["key"];

export function InstallationChecklist({ moduleId, userRole, onComplete }: Props) {
  const [record, setRecord] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  const canManage = ["site_installation_mgr", "super_admin", "managing_director"].includes(userRole ?? "");

  useEffect(() => {
    loadRecord();
  }, [moduleId]);

  const loadRecord = async () => {
    setLoading(true);
    const { data } = await (supabase.from("installation_checklist" as any) as any)
      .select("*")
      .eq("module_id", moduleId)
      .order("created_at", { ascending: false })
      .limit(1);

    setRecord((data as any[])?.[0] ?? null);
    setLoading(false);
  };

  const ensureRecord = async () => {
    if (record) return record.id;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { client } = await getAuthedClient();
    const { data, error } = await (client.from("installation_checklist" as any) as any)
      .insert({ module_id: moduleId, submitted_by: user.id })
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  };

  const handleMark = async (itemKey: ItemKey, result: "pass" | "fail") => {
    try {
      const recordId = await ensureRecord();
      const { client } = await getAuthedClient();
      const { error } = await (client.from("installation_checklist" as any) as any)
        .update({ [itemKey]: result })
        .eq("id", recordId);
      if (error) throw error;
      await loadRecord();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handlePhoto = async (itemKey: string, photoKey: string, file: File) => {
    setUploading(itemKey);
    try {
      const recordId = await ensureRecord();
      const path = `installation/${Date.now()}-${itemKey}.jpg`;
      const { error: uploadErr } = await supabase.storage.from("site-photos").upload(path, file);
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from("site-photos").getPublicUrl(path);
      const { client } = await getAuthedClient();
      const { error } = await (client.from("installation_checklist" as any) as any)
        .update({ [photoKey]: urlData.publicUrl })
        .eq("id", recordId);
      if (error) throw error;
      await loadRecord();
      toast.success("Photo uploaded");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(null);
    }
  };

  const handleComplete = async () => {
    setSubmitting(true);
    try {
      const { client } = await getAuthedClient();
      const { error } = await (client.from("installation_checklist" as any) as any)
        .update({ is_complete: true, submitted_at: new Date().toISOString() })
        .eq("id", record.id);
      if (error) throw error;
      toast.success("Installation checklist completed!");
      onComplete();
      await loadRecord();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return null;
  if (!canManage) return null;

  const passCount = ITEMS.filter((i) => record?.[i.key] === "pass").length;
  const progress = Math.round((passCount / ITEMS.length) * 100);
  const allDone = ITEMS.every((i) => record?.[i.key] === "pass" || record?.[i.key] === "fail");
  const allPass = ITEMS.every((i) => record?.[i.key] === "pass");

  if (record?.is_complete) {
    return (
      <Card className="border-success/30 bg-success/5">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm flex items-center gap-2 text-success">
            <Check className="h-4 w-4" /> Installation Complete
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm flex items-center gap-2 text-card-foreground">
          <Wrench className="h-4 w-4" /> Installation Checklist
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-3">
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-card-foreground/60">
            <span>Progress</span><span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {ITEMS.map((item) => {
          const val = record?.[item.key] ?? "pending";
          const photoUrl = record?.[item.photoKey];
          return (
            <div key={item.key} className="border border-border rounded-md p-3 bg-background space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-card-foreground">{item.label}</span>
                <div className="flex gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant={val === "pass" ? "default" : "outline"}
                    className={`h-7 w-7 p-0 ${val === "pass" ? "bg-success hover:bg-success/90" : ""}`}
                    onClick={() => handleMark(item.key, "pass")}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant={val === "fail" ? "destructive" : "outline"}
                    className="h-7 w-7 p-0"
                    onClick={() => handleMark(item.key, "fail")}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {val === "fail" && (
                <div className="flex items-center gap-2 pl-2 border-l-2 border-destructive/30">
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                    {uploading === item.key ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Camera className="h-3.5 w-3.5" />
                    )}
                    {photoUrl ? "Change photo" : "Upload photo"}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handlePhoto(item.key, item.photoKey, f);
                      }}
                    />
                  </label>
                  {photoUrl && (
                    <img src={photoUrl} alt="Evidence" className="h-8 w-8 rounded object-cover border border-border" />
                  )}
                </div>
              )}
            </div>
          );
        })}

        {allDone && allPass && (
          <Button size="sm" onClick={handleComplete} disabled={submitting} className="w-full">
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Mark Installation Complete
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
