import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { FileText, ThumbsUp, MessageSquare, Loader2 } from "lucide-react";
import { insertNotifications } from "@/lib/notifications";

interface Variation {
  id: string;
  variation_number: string;
  description: string;
  client_facing_description: string | null;
  client_facing_reason: string | null;
  final_cost: number;
  status: string;
  client_approved_at: string | null;
  client_query_text: string | null;
  notes: string | null;
  scope_change_type: string;
  tender_qty: number;
  gfc_qty: number;
  unit: string;
}

interface Props {
  variations: Variation[];
  projectId: string;
  projectName: string;
  clientName: string;
  portalToken: string;
  onRefresh: () => void;
}

export function VariationApproval({ variations, projectId, projectName, clientName, portalToken, onRefresh }: Props) {
  const [queryId, setQueryId] = useState<string | null>(null);
  const [queryText, setQueryText] = useState("");
  const [submitting, setSubmitting] = useState<string | null>(null);

  // Only show approved variations needing client acknowledgement
  const pendingClientApproval = variations.filter(
    (v) => v.status === "Approved" && !v.client_approved_at && v.final_cost > 0
  );
  const clientApproved = variations.filter((v) => v.client_approved_at);

  const handleApprove = async (variation: Variation) => {
    setSubmitting(variation.id);
    try {
      await (supabase.from("variation_orders" as any) as any).update({
        client_approved_at: new Date().toISOString(),
        client_approved_by_name: clientName,
      }).eq("id", variation.id);

      // Log access
      supabase.from("client_portal_access_log").insert({
        project_id: projectId,
        token_used: portalToken,
        action: `variation_approved_${variation.variation_number}`,
      }).then(() => {});

      // Notify sales director + finance
      const { data: notifyUsers } = await supabase.from("profiles")
        .select("auth_user_id")
        .in("role", ["sales_director", "finance_director"])
        .eq("is_active", true);

      if (notifyUsers?.length) {
        await insertNotifications(notifyUsers.map((u: any) => ({
          recipient_id: u.auth_user_id,
          title: `Variation Approved by Client — ${variation.variation_number}`,
          body: `${clientName} has approved variation ${variation.variation_number} (₹${variation.final_cost.toLocaleString("en-IN")}) for ${projectName}.`,
          category: "variation_client_approved",
        })));
      }

      toast.success("Variation approved. Thank you!");
      onRefresh();
    } catch {
      toast.error("Failed to approve variation");
    } finally {
      setSubmitting(null);
    }
  };

  const handleQuery = async (variation: Variation) => {
    if (queryText.trim().length < 5) { toast.error("Please type your question"); return; }
    setSubmitting(variation.id);
    try {
      await (supabase.from("variation_orders" as any) as any).update({
        client_query_text: queryText.trim(),
      }).eq("id", variation.id);

      // Log access
      supabase.from("client_portal_access_log").insert({
        project_id: projectId,
        token_used: portalToken,
        action: `variation_query_${variation.variation_number}`,
      }).then(() => {});

      // Notify sales director (John)
      const { data: salesUsers } = await supabase.from("profiles")
        .select("auth_user_id")
        .eq("role", "sales_director")
        .eq("is_active", true);

      if (salesUsers?.length) {
        await insertNotifications(salesUsers.map((u: any) => ({
          recipient_id: u.auth_user_id,
          title: `Client Query on Variation — ${variation.variation_number}`,
          body: `${clientName} has a question about variation ${variation.variation_number} for ${projectName}: "${queryText.trim()}"`,
          category: "variation_client_query",
          navigate_to: `/projects/${projectId}`,
        })));
      }

      toast.success("Your question has been sent. We will respond shortly.");
      setQueryId(null);
      setQueryText("");
      onRefresh();
    } catch {
      toast.error("Failed to send question");
    } finally {
      setSubmitting(null);
    }
  };

  if (!pendingClientApproval.length && !clientApproved.length) return null;

  const fmt = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

  return (
    <>
      {pendingClientApproval.length > 0 && (
        <Card className="border-warning/30">
          <CardHeader className="pb-3">
            <CardTitle className="font-heading text-base font-bold flex items-center gap-2">
              <FileText className="h-4 w-4 text-warning" /> Variations Requiring Your Approval
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {pendingClientApproval.map((v) => (
              <div key={v.id} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-heading font-bold text-foreground">{v.variation_number}</p>
                  <Badge variant="outline" className="text-xs">{v.scope_change_type}</Badge>
                </div>

                <p className="text-sm font-body text-foreground">
                  {v.client_facing_description || v.description}
                </p>

                {v.client_facing_reason && (
                  <div className="bg-accent/30 rounded p-2">
                    <p className="text-xs font-heading font-semibold text-muted-foreground mb-0.5">Why this change is needed:</p>
                    <p className="text-sm font-body text-foreground">{v.client_facing_reason}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-xs text-muted-foreground">Original Qty</span>
                    <p className="font-medium text-foreground">{v.tender_qty} {v.unit}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Revised Qty</span>
                    <p className="font-medium text-foreground">{v.gfc_qty} {v.unit}</p>
                  </div>
                </div>

                <div className="border-t pt-2">
                  <p className="text-lg font-heading font-bold text-foreground">
                    Additional Cost: {fmt(v.final_cost)} + GST
                  </p>
                </div>

                {queryId === v.id ? (
                  <div className="space-y-2">
                    <Textarea
                      placeholder="Type your question here..."
                      value={queryText}
                      onChange={(e) => setQueryText(e.target.value)}
                      className="text-sm h-20"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleQuery(v)} disabled={submitting === v.id}>
                        {submitting === v.id && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                        <MessageSquare className="h-3 w-3 mr-1" /> Send Question
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setQueryId(null); setQueryText(""); }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button size="sm" className="bg-primary" onClick={() => handleApprove(v)} disabled={submitting === v.id}>
                      {submitting === v.id && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                      <ThumbsUp className="h-3 w-3 mr-1" /> I Agree — Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setQueryId(v.id)}>
                      <MessageSquare className="h-3 w-3 mr-1" /> I Have Questions
                    </Button>
                  </div>
                )}

                {v.client_query_text && !v.client_approved_at && (
                  <div className="bg-muted/50 rounded p-2">
                    <p className="text-xs text-muted-foreground">Your question:</p>
                    <p className="text-sm text-foreground">{v.client_query_text}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Our team will respond shortly.</p>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {clientApproved.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-heading text-base font-bold">Approved Variations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {clientApproved.map((v) => (
              <div key={v.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                <div>
                  <span className="text-sm font-heading font-semibold text-foreground">{v.variation_number}</span>
                  <span className="text-sm font-body text-muted-foreground ml-2">{fmt(v.final_cost)}</span>
                </div>
                <Badge className="bg-primary text-primary-foreground">Approved</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
}
