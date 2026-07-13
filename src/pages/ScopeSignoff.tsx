import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type Scope = {
  id: string;
  status: string;
  client_name: string | null;
  location: string | null;
  built_up_area: number | null;
  module_count: number | null;
  notes: string | null;
  client_signed_at: string | null;
};

type Item = { section: string; item_name: string; responsibility: string; area_sqft: number | null; remarks: string | null };
type Excl = { exclusion_text: string };

const SECTION_LABEL: Record<string, string> = {
  design_consultants: "Design & Consultants",
  builder_finish: "Builder Finish",
  external_structures: "External Structures",
  site_related: "Site-Related Work",
};

const RESP_LABEL: Record<string, string> = {
  not_in_scope: "Not in Scope",
  habitainer: "Habitainer",
  external_contractor: "External Contractor",
};

export default function ScopeSignoff() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenRow, setTokenRow] = useState<any>(null);
  const [scope, setScope] = useState<Scope | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [exclusions, setExclusions] = useState<Excl[]>([]);
  const [signerName, setSignerName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      if (!token) { setLoading(false); return; }
      const { data, error } = await (supabase as any).rpc("get_scope_signoff_by_token", { p_token: token });
      if (error || !data) { setLoading(false); return; }
      setTokenRow({ id: data.token_id });
      setTokenValid(true);
      setScope(data.scope as Scope);
      setSignerName((data.scope?.client_name as string) ?? "");
      setItems((data.items ?? []) as Item[]);
      setExclusions((data.exclusions ?? []) as Excl[]);
      setLoading(false);
    })();
  }, [token]);

  const sign = async () => {
    if (!signerName.trim()) { toast.error("Please enter your name"); return; }
    if (!scope || !token) return;
    setSubmitting(true);
    const { data, error } = await (supabase as any).rpc("consume_scope_signoff_token", {
      p_token: token,
      p_signer_name: signerName.trim(),
    });
    if (error || data !== true) {
      toast.error(error?.message ?? "Link is no longer valid");
      setSubmitting(false);
      return;
    }
    setDone(true);
    setSubmitting(false);
    toast.success("Signature captured. Thank you!");
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  if (!tokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center space-y-3">
            <XCircle className="h-10 w-10 mx-auto text-destructive" />
            <p className="font-semibold">Link expired or already used</p>
            <p className="text-sm text-muted-foreground">Please request a new link from your project team.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (done || scope?.client_signed_at) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center space-y-3">
            <CheckCircle2 className="h-10 w-10 mx-auto" style={{ color: "#006039" }} />
            <p className="font-semibold">Scope of Work signed</p>
            <p className="text-sm text-muted-foreground">Your signature has been recorded. You may close this window.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const bySection: Record<string, Item[]> = {};
  for (const it of items) { (bySection[it.section] ??= []).push(it); }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold">Scope of Work — Client Sign-off</h1>
          <Badge variant="secondary">Pending Signature</Badge>
        </div>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">General Details</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <p><strong>Client:</strong> {scope?.client_name ?? "—"}</p>
            <p><strong>Location:</strong> {scope?.location ?? "—"}</p>
            <p><strong>Built-up Area:</strong> {scope?.built_up_area ?? "—"} sqft</p>
            <p><strong>Modules:</strong> {scope?.module_count ?? "—"}</p>
          </CardContent>
        </Card>

        {Object.entries(bySection).map(([sec, arr]) => (
          <Card key={sec}>
            <CardHeader className="pb-2"><CardTitle className="text-base">{SECTION_LABEL[sec] ?? sec}</CardTitle></CardHeader>
            <CardContent className="text-sm">
              <table className="w-full">
                <tbody>
                  {arr.map((it, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="py-1.5 pr-2">{it.item_name}</td>
                      <td className="py-1.5 text-muted-foreground text-xs">{RESP_LABEL[it.responsibility] ?? it.responsibility}</td>
                      {it.area_sqft != null && <td className="py-1.5 text-xs text-muted-foreground">{it.area_sqft} sqft</td>}
                      {it.remarks && <td className="py-1.5 text-xs text-muted-foreground">{it.remarks}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        ))}

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Exclusions</CardTitle></CardHeader>
          <CardContent className="text-sm">
            <ol className="list-decimal ml-5 space-y-1">
              {exclusions.map((e, i) => <li key={i}>{e.exclusion_text}</li>)}
            </ol>
          </CardContent>
        </Card>

        <Card style={{ borderColor: "#006039", borderWidth: 2 }}>
          <CardHeader className="pb-2"><CardTitle className="text-base">Sign to Approve</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Your full name</Label>
              <Input value={signerName} onChange={(e) => setSignerName(e.target.value)} placeholder="Type your full name" />
              <p className="text-xs text-muted-foreground mt-1">
                By clicking Sign, you approve this Scope of Work on {format(new Date(), "dd/MM/yyyy")}.
              </p>
            </div>
            <Button onClick={sign} disabled={submitting} className="w-full" style={{ backgroundColor: "#006039" }}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Sign Scope of Work
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
