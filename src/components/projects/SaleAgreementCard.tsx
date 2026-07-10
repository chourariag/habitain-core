import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, CheckCircle2, FileText, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { insertNotifications } from "@/lib/notifications";

const EDIT_ROLES = ["super_admin", "managing_director", "sales_director", "architecture_director", "planning_head", "finance_director"];

export function SaleAgreementCard({
  projectId,
  scopeId,
  scopeStatus,
  projectName,
  clientName,
  contractValue,
  userRole,
}: {
  projectId: string;
  scopeId: string | null;
  scopeStatus: string;
  projectName: string;
  clientName: string | null;
  contractValue: number;
  userRole: string | null;
}) {
  const canEdit = EDIT_ROLES.includes(userRole ?? "");
  const [loading, setLoading] = useState(true);
  const [contract, setContract] = useState<any>(null);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [startDate, setStartDate] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("contracts_register")
      .select("*")
      .eq("project_id", projectId)
      .eq("contract_type", "Sale Agreement")
      .eq("is_archived", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setContract(data);
    if (data?.start_date) setStartDate(data.start_date);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [projectId, scopeStatus]);

  const scopeSigned = scopeStatus === "signed";

  const upload = async () => {
    if (!file || !scopeId) return;
    if (!scopeSigned) { toast.error("Scope of Work must be signed first"); return; }
    setSaving(true);
    try {
      const path = `sale-agreements/${projectId}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("design-files").upload(path, file);
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("design-files").getPublicUrl(path);
      const { data: { user } } = await supabase.auth.getUser();

      const payload: any = {
        project_id: projectId,
        vendor_name: clientName || projectName,
        scope_of_work: "Sale Agreement — Client Contract",
        contract_type: "Sale Agreement",
        contract_value_excl_gst: contractValue || 0,
        start_date: startDate || null,
        status: "Active",
        scope_of_work_id: scopeId,
        contract_file_url: pub.publicUrl,
        created_by: user?.id ?? null,
      };
      const res = contract
        ? await (supabase as any).from("contracts_register").update(payload).eq("id", contract.id)
        : await (supabase as any).from("contracts_register").insert(payload);
      if (res.error) throw res.error;

      // Notify planning
      const { data: planning } = await supabase.from("profiles").select("auth_user_id").in("role", ["planning_head", "sales_director"] as any).eq("is_active", true);
      if (planning?.length) {
        await insertNotifications(planning.map((p: any) => ({
          recipient_id: p.auth_user_id,
          title: "Sale Agreement uploaded",
          body: `${projectName}: Sale Agreement uploaded. Pre-Production gate C-3 complete.`,
          category: "milestone",
          related_table: "contracts_register",
          related_id: projectId,
          navigate_to: `/projects/${projectId}`,
          priority: "normal",
        })));
      }

      toast.success("Sale Agreement uploaded");
      setFile(null);
      load();
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    }
    setSaving(false);
  };

  if (loading) return <Card><CardContent className="p-4"><Loader2 className="h-4 w-4 animate-spin" /></CardContent></Card>;

  return (
    <Card style={{ borderColor: contract?.contract_file_url ? "#006039" : (scopeSigned ? "#D4860A" : "#F40009"), borderWidth: 2 }}>
      <CardHeader className="pb-3 flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4" /> Sale Agreement <span className="text-xs text-muted-foreground font-mono">(Gate C-3)</span>
        </CardTitle>
        {contract?.contract_file_url ? (
          <Badge className="bg-[#006039] text-white">Uploaded</Badge>
        ) : (
          <Badge variant="secondary">Pending</Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {!scopeSigned && (
          <Alert style={{ borderColor: "#F40009" }}>
            <AlertTriangle className="h-4 w-4" style={{ color: "#F40009" }} />
            <AlertDescription>Scope of Work must be signed before Sale Agreement can be submitted.</AlertDescription>
          </Alert>
        )}

        {contract?.contract_file_url ? (
          <div className="text-sm space-y-1">
            <p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" style={{ color: "#006039" }} /> Contract <span className="font-mono text-xs">{contract.contract_number}</span> on file.</p>
            <a href={contract.contract_file_url} target="_blank" rel="noreferrer" className="text-sm underline">View signed agreement</a>
          </div>
        ) : (
          canEdit && (
            <div className="space-y-2">
              <div>
                <Label className="text-xs">Sale Agreement Date</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={!scopeSigned} />
              </div>
              <div>
                <Label className="text-xs">Upload signed Sale Agreement (PDF)</Label>
                <Input type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} disabled={!scopeSigned} />
              </div>
              <Button onClick={upload} disabled={!file || !scopeSigned || saving} size="sm">
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                <Upload className="h-4 w-4 mr-1" /> Submit Sale Agreement
              </Button>
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
}
