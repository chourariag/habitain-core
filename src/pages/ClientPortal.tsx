import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsWrapper } from "@/components/ui/scrollable-tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2, Clock, AlertTriangle, Image, FileText, Home, CalendarCheck } from "lucide-react";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import { ProjectScopeGuard } from "@/components/ProjectScopeGuard";
import { MobileProjectSwitcher } from "@/components/MobileProjectSwitcher";
import { useProjectContext } from "@/contexts/ProjectContext";
import { useUserRole } from "@/hooks/useUserRole";

// Payment milestone statuses
const PAYMENT_STATUS: Record<string, { color: string; bg: string; label: string }> = {
  pending: { color: "#999", bg: "#F7F7F7", label: "Pending" },
  invoiced: { color: "#D4860A", bg: "#FFF8E8", label: "Invoiced" },
  paid: { color: "#006039", bg: "#E8F2ED", label: "Paid" },
  overdue: { color: "#F40009", bg: "#FEE2E2", label: "Overdue" },
};

const VARIATION_CLIENT_ACTIONS: Record<string, { color: string; bg: string }> = {
  pending_client: { color: "#D4860A", bg: "#FFF8E8" },
  agreed: { color: "#006039", bg: "#E8F2ED" },
  queried: { color: "#2563EB", bg: "#EFF6FF" },
  rejected: { color: "#F40009", bg: "#FEE2E2" },
};

function PaymentTimelineTab({ projectId }: { projectId: string }) {
  const [milestones, setMilestones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase.from("billing_milestones" as any) as any)
        .select("*")
        .eq("project_id", projectId)
        .order("milestone_order", { ascending: true });
      setMilestones(data ?? []);
      setLoading(false);
    })();
  }, [projectId]);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (milestones.length === 0) return <p className="text-sm text-center py-8" style={{ color: "#999" }}>No billing milestones configured.</p>;

  const totalContract = milestones.reduce((s, m) => s + (m.amount ?? 0), 0);
  const totalPaid = milestones.filter((m) => m.status === "paid").reduce((s, m) => s + (m.amount ?? 0), 0);
  const paidPct = totalContract > 0 ? Math.round(totalPaid / totalContract * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4 space-y-2" style={{ backgroundColor: "#E8F2ED" }}>
        <p className="text-xs font-semibold" style={{ color: "#006039" }}>Payment Progress</p>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-2xl font-bold font-display" style={{ color: "#006039" }}>₹{totalPaid.toLocaleString("en-IN")}</p>
            <p className="text-xs" style={{ color: "#666" }}>of ₹{totalContract.toLocaleString("en-IN")} received</p>
          </div>
          <p className="text-3xl font-bold font-display" style={{ color: "#006039" }}>{paidPct}%</p>
        </div>
        <div className="w-full rounded-full h-2" style={{ backgroundColor: "#C4DDD1" }}>
          <div className="h-2 rounded-full transition-all" style={{ width: `${paidPct}%`, backgroundColor: "#006039" }} />
        </div>
      </div>

      <div className="space-y-2">
        {milestones.map((m, i) => {
          const st = PAYMENT_STATUS[m.status ?? "pending"];
          return (
            <div key={m.id} className="flex items-center gap-3 rounded-lg border border-border p-3" style={{ backgroundColor: "#FFFFFF" }}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ backgroundColor: m.status === "paid" ? "#006039" : "#E0E0E0" }}>
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: "#1A1A1A" }}>{m.milestone_name}</p>
                <p className="text-xs" style={{ color: "#666" }}>{m.milestone_pct}% — ₹{(m.amount ?? 0).toLocaleString("en-IN")} + GST</p>
                {m.due_date && (
                  <p className="text-[10px]" style={{ color: "#999" }}>Due: {format(new Date(m.due_date), "dd/MM/yyyy")}</p>
                )}
              </div>
              <Badge variant="outline" className="text-[9px] h-4 flex-shrink-0" style={{ color: st.color, borderColor: st.color, backgroundColor: st.bg }}>
                {st.label}
              </Badge>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VariationsTab({ projectId, userRole }: { projectId: string; userRole: string | null }) {
  const [variations, setVariations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [queryOpen, setQueryOpen] = useState<string | null>(null);
  const [queryText, setQueryText] = useState("");
  const [saving, setSaving] = useState(false);

  const fetch = useCallback(async () => {
    const { data } = await (supabase.from("variations" as any) as any)
      .select("*")
      .eq("project_id", projectId)
      .eq("status", "approved")
      .order("created_at", { ascending: false });
    setVariations(data ?? []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleClientAction = async (id: string, action: "agreed" | "queried") => {
    if (action === "queried" && !queryText.trim()) { toast.error("Please enter your query"); return; }
    setSaving(true);
    const { error } = await (supabase.from("variations" as any) as any).update({
      client_approved: action === "agreed",
      client_action: action,
      client_query: action === "queried" ? queryText : null,
    }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(action === "agreed" ? "Variation agreed" : "Query submitted"); setQueryOpen(null); setQueryText(""); fetch(); }
    setSaving(false);
  };

  const isClient = userRole === "client" || userRole === null;

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (variations.length === 0) return <p className="text-sm text-center py-8" style={{ color: "#999" }}>No approved variations for this project.</p>;

  const totalValue = variations.reduce((s, v) => s + (v.final_cost ?? 0), 0);

  return (
    <div className="space-y-3">
      <div className="rounded-lg p-3 text-sm" style={{ backgroundColor: "#FFF8E8" }}>
        <span style={{ color: "#D4860A" }}>Total Variation Value: <b>₹{totalValue.toLocaleString("en-IN")}</b></span>
      </div>
      {variations.map((v) => {
        const ca = VARIATION_CLIENT_ACTIONS[v.client_action ?? "pending_client"];
        return (
          <Card key={v.id}>
            <CardContent className="py-3 px-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold" style={{ color: "#006039" }}>{v.ref_number}</span>
                    <Badge variant="outline" className="text-[9px] h-4" style={{ color: ca?.color ?? "#999", borderColor: ca?.color ?? "#ddd", backgroundColor: ca?.bg ?? "#F7F7F7" }}>
                      {v.client_action ? v.client_action.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) : "Awaiting Client"}
                    </Badge>
                  </div>
                  <p className="text-sm mt-1" style={{ color: "#1A1A1A" }}>{v.description}</p>
                  <p className="text-xs mt-0.5 font-semibold" style={{ color: "#006039" }}>₹{(v.final_cost ?? 0).toLocaleString("en-IN")}</p>
                  {v.client_query && (
                    <p className="text-xs mt-1 italic" style={{ color: "#2563EB" }}>Client query: {v.client_query}</p>
                  )}
                </div>
                {(!v.client_action || v.client_action === "pending_client") && (
                  <div className="flex flex-col gap-1">
                    <Button size="sm" className="h-6 text-[9px] px-2 text-white" style={{ backgroundColor: "#006039" }} onClick={() => handleClientAction(v.id, "agreed")}>
                      I Agree
                    </Button>
                    <Button size="sm" variant="outline" className="h-6 text-[9px] px-2" onClick={() => setQueryOpen(v.id)}>
                      Query
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={!!queryOpen} onOpenChange={(o) => { if (!o) { setQueryOpen(null); setQueryText(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Raise a Query</DialogTitle></DialogHeader>
          <Textarea placeholder="Describe your question about this variation..." value={queryText} onChange={(e) => setQueryText(e.target.value)} rows={4} />
          <DialogFooter>
            <Button onClick={() => queryOpen && handleClientAction(queryOpen, "queried")} disabled={saving} style={{ backgroundColor: "#2563EB" }} className="text-white">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Submit Query
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function JournalTab({ projectId }: { projectId: string }) {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase.from("site_diary_entries" as any) as any)
        .select("id, entry_date, summary, weather, created_at, photo_urls")
        .eq("project_id", projectId)
        .eq("share_with_client", true)
        .order("entry_date", { ascending: false })
        .limit(30);
      setEntries(data ?? []);
      setLoading(false);
    })();
  }, [projectId]);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (entries.length === 0) return <p className="text-sm text-center py-8" style={{ color: "#999" }}>No construction journal entries shared yet.</p>;

  return (
    <div className="space-y-3">
      {entries.map((e) => (
        <Card key={e.id}>
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm font-semibold" style={{ color: "#1A1A1A" }}>{format(new Date(e.entry_date), "EEEE, dd MMM yyyy")}</p>
              {e.weather && <Badge variant="outline" className="text-[9px] h-4">{e.weather}</Badge>}
            </div>
            {e.summary && <p className="text-xs" style={{ color: "#666" }}>{e.summary}</p>}
            {Array.isArray(e.photo_urls) && e.photo_urls.length > 0 && (
              <div className="flex gap-2 mt-2 flex-wrap">
                {e.photo_urls.slice(0, 4).map((url: string, i: number) => (
                  <img key={i} src={url} alt="site" className="w-16 h-16 object-cover rounded-md border border-border" />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function HandoverTab({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("projects").select("*").eq("id", projectId).single();
      setProject(data);
      setLoading(false);
    })();
  }, [projectId]);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!project) return null;

  const handoverDate = project.handover_date ? new Date(project.handover_date) : null;
  const daysUntil = handoverDate ? differenceInDays(handoverDate, new Date()) : null;

  const amcStart = project.amc_start_date ? new Date(project.amc_start_date) : null;
  const amcEnd = project.amc_end_date ? new Date(project.amc_end_date) : null;
  const amcDaysLeft = amcEnd ? differenceInDays(amcEnd, new Date()) : null;

  return (
    <div className="space-y-4">
      {/* Handover status */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <Home className="h-4 w-4" style={{ color: "#006039" }} />
            Handover Status
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {handoverDate ? (
            <div className="space-y-1">
              <p className="text-2xl font-bold font-display" style={{ color: daysUntil !== null && daysUntil < 0 ? "#006039" : "#D4860A" }}>
                {daysUntil !== null && daysUntil < 0 ? "Handed Over" : daysUntil !== null ? `${daysUntil} days` : "—"}
              </p>
              {daysUntil !== null && daysUntil >= 0 && (
                <p className="text-xs" style={{ color: "#666" }}>until handover on {format(handoverDate, "dd MMM yyyy")}</p>
              )}
              {daysUntil !== null && daysUntil < 0 && (
                <p className="text-xs" style={{ color: "#666" }}>on {format(handoverDate, "dd MMM yyyy")}</p>
              )}
            </div>
          ) : (
            <p className="text-sm" style={{ color: "#999" }}>Handover date not yet set.</p>
          )}
        </CardContent>
      </Card>

      {/* AMC */}
      {amcStart && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-display flex items-center gap-2">
              <CalendarCheck className="h-4 w-4" style={{ color: "#2563EB" }} />
              AMC Period
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-1">
            <p className="text-xs" style={{ color: "#666" }}>
              {format(amcStart, "dd MMM yyyy")} — {amcEnd ? format(amcEnd, "dd MMM yyyy") : "Ongoing"}
            </p>
            {amcDaysLeft !== null && (
              <p className="text-sm font-semibold" style={{ color: amcDaysLeft > 90 ? "#006039" : "#D4860A" }}>
                {amcDaysLeft > 0 ? `${amcDaysLeft} days remaining` : "AMC expired"}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Handover documents */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <FileText className="h-4 w-4" style={{ color: "#666" }} />
            Handover Documents
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <p className="text-xs" style={{ color: "#999" }}>Handover documents will be available here once uploaded by the site team.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function ClientPortalContent() {
  const { selectedProjectId, selectedProject } = useProjectContext();
  const { role: userRole } = useUserRole();

  if (!selectedProjectId) return null;

  return (
    <div className="space-y-4">
      {selectedProject && (
        <div className="rounded-xl border border-border p-4" style={{ backgroundColor: "#E8F2ED" }}>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#006039" }}>Your Project</p>
          <p className="text-lg font-bold font-display mt-0.5" style={{ color: "#1A1A1A" }}>{selectedProject.name}</p>
          {(selectedProject as any).client_name && (
            <p className="text-sm" style={{ color: "#666" }}>{(selectedProject as any).client_name}</p>
          )}
        </div>
      )}

      <Tabs defaultValue="payments">
        <ScrollableTabsWrapper>
          <TabsList>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="variations">Variations</TabsTrigger>
            <TabsTrigger value="journal">Construction Journal</TabsTrigger>
            <TabsTrigger value="handover">Handover</TabsTrigger>
          </TabsList>
        </ScrollableTabsWrapper>
        <TabsContent value="payments" className="mt-4">
          <PaymentTimelineTab projectId={selectedProjectId} />
        </TabsContent>
        <TabsContent value="variations" className="mt-4">
          <VariationsTab projectId={selectedProjectId} userRole={userRole} />
        </TabsContent>
        <TabsContent value="journal" className="mt-4">
          <JournalTab projectId={selectedProjectId} />
        </TabsContent>
        <TabsContent value="handover" className="mt-4">
          <HandoverTab projectId={selectedProjectId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function ClientPortal() {
  return (
    <div className="p-4 md:p-6 max-w-full overflow-x-hidden">
      <MobileProjectSwitcher />
      <h1 className="font-display text-2xl font-bold mb-1" style={{ color: "#1A1A1A" }}>Client Portal</h1>
      <p className="text-sm mb-4" style={{ color: "#666666" }}>Your project updates, payment timeline, and construction journal</p>
      <ProjectScopeGuard>
        <ClientPortalContent />
      </ProjectScopeGuard>
    </div>
  );
}
