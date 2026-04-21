import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Check, HelpCircle, ThumbsUp, PenLine, IndianRupee, FileSignature } from "lucide-react";
import { toast } from "sonner";

interface Props {
  projectId: string;
  projectToken: string;
  clientName: string;
  onRefresh: () => void;
}

export function ClientApprovals({ projectId, projectToken, clientName, onRefresh }: Props) {
  const [drawings, setDrawings] = useState<any[]>([]);
  const [variations, setVariations] = useState<any[]>([]);
  const [project, setProject] = useState<any>(null);
  const [handover, setHandover] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [changeText, setChangeText] = useState<Record<string, string>>({});
  const [questionText, setQuestionText] = useState<Record<string, string>>({});
  const [handoverName, setHandoverName] = useState("");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [dRes, vRes, pRes, hRes] = await Promise.all([
      supabase.from("drawings").select("id, drawing_id_code, drawing_title, drawing_type, created_at, file_url")
        .eq("project_id", projectId).eq("approval_status", "pending").is("client_approved_at", null),
      (supabase.from("variation_orders" as any) as any).select("*")
        .eq("project_id", projectId).eq("status", "pending"),
      supabase.from("projects").select("status").eq("id", projectId).single(),
      supabase.from("handover_pack").select("*").eq("project_id", projectId).maybeSingle(),
    ]);
    setDrawings(dRes.data ?? []);
    setVariations(vRes.data ?? []);
    setProject(pRes.data);
    setHandover(hRes.data);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const totalPending = drawings.length + variations.length +
    (project?.status === "ready_for_handover" && handover && !(handover as any).client_signed_at ? 1 : 0);

  const approveDrawing = async (id: string) => {
    setActing(id);
    await supabase.from("drawings").update({
      approval_status: "approved",
      client_approved_at: new Date().toISOString(),
      client_approved_name: clientName,
    } as any).eq("id", id);
    toast.success("Drawing approved");
    await fetchAll();
    onRefresh();
    setActing(null);
  };

  const requestChanges = async (id: string) => {
    const text = changeText[id]?.trim();
    if (!text || text.length < 5) { toast.error("Please describe the changes needed"); return; }
    setActing(id);
    await supabase.from("drawings").update({
      approval_status: "changes_requested",
      client_query_text: text,
    } as any).eq("id", id);
    toast.success("Change request sent to design team");
    await fetchAll();
    onRefresh();
    setActing(null);
  };

  const approveVariation = async (id: string) => {
    setActing(id);
    await (supabase.from("variation_orders" as any) as any).update({
      status: "client_approved",
      client_approved_at: new Date().toISOString(),
    }).eq("id", id);
    toast.success("Variation approved");
    await fetchAll();
    onRefresh();
    setActing(null);
  };

  const askVariationQuestion = async (id: string) => {
    const text = questionText[id]?.trim();
    if (!text || text.length < 5) { toast.error("Please enter your question"); return; }
    setActing(id);
    await (supabase.from("variation_orders" as any) as any).update({
      status: "discussion_requested",
      client_response_note: text,
    }).eq("id", id);
    toast.success("Question sent to project team");
    await fetchAll();
    onRefresh();
    setActing(null);
  };

  const signHandover = async () => {
    if (handoverName.trim().length < 2) { toast.error("Please type your name to sign"); return; }
    setActing("handover");
    const now = new Date();
    await supabase.from("handover_pack").update({
      client_signed_at: now.toISOString(),
      client_signed_name: handoverName.trim(),
      dlp_start_date: now.toISOString().split("T")[0],
    } as any).eq("id", handover.id);
    await supabase.from("projects").update({ status: "handed_over" } as any).eq("id", projectId);
    supabase.from("client_portal_access_log").insert({
      project_id: projectId, token_used: projectToken, action: "handover_signed",
    }).then(() => {});
    toast.success("Handover certificate signed. Thank you!");
    await fetchAll();
    onRefresh();
    setActing(null);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  if (totalPending === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <Check className="h-10 w-10 mx-auto mb-2" style={{ color: "#006039" }} />
          <p className="text-sm font-medium text-foreground">No approvals pending</p>
          <p className="text-xs text-muted-foreground mt-1">All items are up to date</p>
        </CardContent>
      </Card>
    );
  }

  const showHandover = project?.status === "ready_for_handover" && handover && !(handover as any).client_signed_at;

  return (
    <div className="space-y-6">
      {/* Section 1: Drawings */}
      {drawings.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-heading text-base font-bold flex items-center gap-2">
              <PenLine className="h-4 w-4" style={{ color: "#006039" }} /> Drawings Awaiting Approval
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {drawings.map((d) => (
              <div key={d.id} className="rounded-lg border p-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{d.drawing_title || d.drawing_id_code}</p>
                  <p className="text-xs text-muted-foreground">{d.drawing_type} · Uploaded {new Date(d.created_at).toLocaleDateString("en-IN")}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => approveDrawing(d.id)} disabled={acting === d.id}>
                    <ThumbsUp className="h-3 w-3 mr-1" /> Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setChangeText(p => ({ ...p, [d.id]: p[d.id] ?? "" }))}>
                    <HelpCircle className="h-3 w-3 mr-1" /> Request Changes
                  </Button>
                </div>
                {changeText[d.id] !== undefined && (
                  <div className="space-y-2">
                    <Textarea placeholder="Describe changes needed…" value={changeText[d.id]}
                      onChange={(e) => setChangeText(p => ({ ...p, [d.id]: e.target.value }))} className="text-sm h-20" />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => requestChanges(d.id)} disabled={acting === d.id}>Submit</Button>
                      <Button size="sm" variant="ghost" onClick={() => setChangeText(p => { const n = { ...p }; delete n[d.id]; return n; })}>Cancel</Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Section 2: Variations */}
      {variations.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-heading text-base font-bold flex items-center gap-2">
              <IndianRupee className="h-4 w-4" style={{ color: "#D4860A" }} /> Variations Awaiting Sign-off
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {variations.map((v: any) => (
              <div key={v.id} className="rounded-lg border p-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{v.description || `Variation ${v.vo_number}`}</p>
                  {v.additional_cost != null && (
                    <p className="text-xs font-mono" style={{ color: "#D4860A" }}>
                      Additional Cost: ₹{Number(v.additional_cost).toLocaleString("en-IN")}
                    </p>
                  )}
                  {v.reason && <p className="text-xs text-muted-foreground mt-1">{v.reason}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => approveVariation(v.id)} disabled={acting === v.id}>
                    <ThumbsUp className="h-3 w-3 mr-1" /> I Agree — Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setQuestionText(p => ({ ...p, [v.id]: p[v.id] ?? "" }))}>
                    <HelpCircle className="h-3 w-3 mr-1" /> I Have Questions
                  </Button>
                </div>
                {questionText[v.id] !== undefined && (
                  <div className="space-y-2">
                    <Textarea placeholder="What would you like to know?" value={questionText[v.id]}
                      onChange={(e) => setQuestionText(p => ({ ...p, [v.id]: e.target.value }))} className="text-sm h-20" />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => askVariationQuestion(v.id)} disabled={acting === v.id}>Send</Button>
                      <Button size="sm" variant="ghost" onClick={() => setQuestionText(p => { const n = { ...p }; delete n[v.id]; return n; })}>Cancel</Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Section 3: Handover */}
      {showHandover && (
        <Card className="border-primary">
          <CardHeader className="pb-3">
            <CardTitle className="font-heading text-base font-bold flex items-center gap-2">
              <FileSignature className="h-4 w-4" style={{ color: "#006039" }} /> Handover Certificate
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-foreground">Your project is ready for handover.</p>
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Type your full name to sign"
                value={handoverName}
                onChange={(e) => setHandoverName(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm"
              />
              <Button onClick={signHandover} disabled={acting === "handover" || handoverName.trim().length < 2}>
                {acting === "handover" && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                <FileSignature className="h-4 w-4 mr-1" /> Sign Handover Certificate
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
