import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { format, parseISO, differenceInDays, addMonths } from "date-fns";
import { Plus, CheckCircle, IndianRupee, Clock } from "lucide-react";

type Retention = {
  id: string;
  project_id: string;
  client_name: string;
  contract_value: number;
  retention_pct: number;
  retention_amount: number;
  hold_start_date: string;
  expected_release_date: string;
  actual_release_date: string | null;
  amount_received: number | null;
  payment_reference: string | null;
  status: string;
};

const FULL_ACCESS_ROLES = [
  "super_admin", "managing_director", "finance_director", "finance_manager",
];

function formatDate(d: string | null) {
  if (!d) return "—";
  try { return format(parseISO(d), "dd/MM/yyyy"); } catch { return d; }
}
function formatCurrency(n: number) {
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 0 })}`;
}

function getRetentionStatus(r: Retention) {
  if (r.status === "released") return { label: "Released", bg: "#E8F2ED", text: "#006039" };
  const daysUntil = differenceInDays(parseISO(r.expected_release_date), new Date());
  if (daysUntil <= 30) return { label: "Release Imminent", bg: "#FDE8E8", text: "#F40009" };
  return { label: "Held", bg: "#FFF3CD", text: "#D4860A" };
}

export function RetentionSection() {
  const { role, userId } = useUserRole();
  const [records, setRecords] = useState<Retention[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string; client_name: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [newProject, setNewProject] = useState("");
  const [newContractValue, setNewContractValue] = useState("");
  const [newPct, setNewPct] = useState("2.5");
  const [newStartDate, setNewStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [newMonths, setNewMonths] = useState("12");

  const [releaseOpen, setReleaseOpen] = useState(false);
  const [releaseRecord, setReleaseRecord] = useState<Retention | null>(null);
  const [releaseAmount, setReleaseAmount] = useState("");
  const [releaseRef, setReleaseRef] = useState("");
  const [releaseDate, setReleaseDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const hasFullAccess = FULL_ACCESS_ROLES.includes(role || "");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [retRes, projRes] = await Promise.all([
      supabase.from("retention_records").select("*").order("expected_release_date"),
      supabase.from("projects").select("id, name, client_name").eq("is_archived", false),
    ]);
    if (retRes.data) setRecords(retRes.data as any);
    if (projRes.data) setProjects(projRes.data as any);
    setLoading(false);
  }

  const projectMap = useMemo(() => {
    const m: Record<string, string> = {};
    projects.forEach((p) => (m[p.id] = p.name));
    return m;
  }, [projects]);

  // Sort: release imminent first, then by release date
  const sorted = useMemo(() => {
    return [...records].sort((a, b) => {
      const aImm = a.status !== "released" && differenceInDays(parseISO(a.expected_release_date), new Date()) <= 30;
      const bImm = b.status !== "released" && differenceInDays(parseISO(b.expected_release_date), new Date()) <= 30;
      if (aImm && !bImm) return -1;
      if (!aImm && bImm) return 1;
      return new Date(a.expected_release_date).getTime() - new Date(b.expected_release_date).getTime();
    });
  }, [records]);

  const totalHeld = records.filter((r) => r.status === "held").reduce((s, r) => s + Number(r.retention_amount), 0);
  const imminentCount = records.filter((r) => r.status === "held" && differenceInDays(parseISO(r.expected_release_date), new Date()) <= 30).length;

  async function handleCreate() {
    if (!newProject || !newContractValue) { toast.error("Project and contract value required"); return; }
    const contractVal = parseFloat(newContractValue);
    const pct = parseFloat(newPct);
    const retAmount = contractVal * (pct / 100);
    const startDate = parseISO(newStartDate);
    const releaseDate = addMonths(startDate, parseInt(newMonths));
    const proj = projects.find((p) => p.id === newProject);

    const { error } = await supabase.from("retention_records").insert({
      project_id: newProject,
      client_name: proj?.client_name || "—",
      contract_value: contractVal,
      retention_pct: pct,
      retention_amount: retAmount,
      hold_start_date: format(startDate, "yyyy-MM-dd"),
      expected_release_date: format(releaseDate, "yyyy-MM-dd"),
      created_by: userId,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Retention record created");
    setCreateOpen(false);
    setNewProject(""); setNewContractValue(""); setNewPct("2.5"); setNewMonths("12");
    loadData();
  }

  async function handleRelease() {
    if (!releaseRecord) return;
    const { error } = await supabase.from("retention_records").update({
      status: "released",
      actual_release_date: releaseDate,
      amount_received: releaseAmount ? parseFloat(releaseAmount) : null,
      payment_reference: releaseRef || null,
    } as any).eq("id", releaseRecord.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Retention marked as released");
    setReleaseOpen(false); setReleaseRecord(null);
    setReleaseAmount(""); setReleaseRef("");
    loadData();
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Total Retention Held</p>
          <p className="text-lg font-bold" style={{ color: "#D4860A" }}>{formatCurrency(totalHeld)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Release Imminent</p>
          <p className="text-lg font-bold" style={{ color: imminentCount > 0 ? "#F40009" : "#006039" }}>{imminentCount}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Total Records</p>
          <p className="text-lg font-bold" style={{ color: "#1A1A1A" }}>{records.length}</p>
        </CardContent></Card>
      </div>

      {/* Create button */}
      {hasFullAccess && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add Retention
          </Button>
        </div>
      )}

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead>Client</TableHead>
              <TableHead className="text-right">Contract (₹)</TableHead>
              <TableHead className="text-right">Ret %</TableHead>
              <TableHead className="text-right">Retention (₹)</TableHead>
              <TableHead>Hold Start</TableHead>
              <TableHead>Expected Release</TableHead>
              <TableHead className="text-right">Days Left</TableHead>
              <TableHead>Status</TableHead>
              {hasFullAccess && <TableHead>Action</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : sorted.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No retention records</TableCell></TableRow>
            ) : (
              sorted.map((r) => {
                const st = getRetentionStatus(r);
                const daysLeft = r.status === "released" ? "—" : differenceInDays(parseISO(r.expected_release_date), new Date());
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">{projectMap[r.project_id] || "—"}</TableCell>
                    <TableCell className="text-sm">{r.client_name}</TableCell>
                    <TableCell className="text-sm text-right">{Number(r.contract_value).toLocaleString("en-IN")}</TableCell>
                    <TableCell className="text-sm text-right">{Number(r.retention_pct).toFixed(1)}%</TableCell>
                    <TableCell className="text-sm text-right font-medium">{Number(r.retention_amount).toLocaleString("en-IN")}</TableCell>
                    <TableCell className="text-sm">{formatDate(r.hold_start_date)}</TableCell>
                    <TableCell className="text-sm">{formatDate(r.expected_release_date)}</TableCell>
                    <TableCell className="text-sm text-right">{typeof daysLeft === "number" ? daysLeft : daysLeft}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: st.bg, color: st.text }}>
                        {r.status === "released" && <CheckCircle className="h-3 w-3" />}
                        {st.label === "Release Imminent" && <Clock className="h-3 w-3" />}
                        {st.label}
                      </span>
                    </TableCell>
                    {hasFullAccess && (
                      <TableCell>
                        {r.status !== "released" && (
                          <Button size="sm" variant="outline" onClick={() => { setReleaseRecord(r); setReleaseAmount(String(r.retention_amount)); setReleaseOpen(true); }}>
                            <IndianRupee className="h-3 w-3 mr-1" /> Release
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Retention Record</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Project</Label>
              <Select value={newProject} onValueChange={setNewProject}>
                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Contract Value (₹)</Label>
              <Input type="number" value={newContractValue} onChange={(e) => setNewContractValue(e.target.value)} placeholder="0" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Retention %</Label>
                <Input type="number" step="0.1" value={newPct} onChange={(e) => setNewPct(e.target.value)} />
              </div>
              <div>
                <Label>Retention Amount</Label>
                <p className="text-sm font-medium mt-2">
                  {newContractValue && newPct ? formatCurrency(parseFloat(newContractValue) * parseFloat(newPct) / 100) : "—"}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Hold Start Date</Label>
                <Input type="date" value={newStartDate} onChange={(e) => setNewStartDate(e.target.value)} />
              </div>
              <div>
                <Label>Release Period (months)</Label>
                <Input type="number" value={newMonths} onChange={(e) => setNewMonths(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Release Dialog */}
      <Dialog open={releaseOpen} onOpenChange={setReleaseOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mark Retention as Released</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Release Date</Label>
              <Input type="date" value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} />
            </div>
            <div>
              <Label>Amount Received (₹)</Label>
              <Input type="number" value={releaseAmount} onChange={(e) => setReleaseAmount(e.target.value)} />
            </div>
            <div>
              <Label>Payment Reference</Label>
              <Input value={releaseRef} onChange={(e) => setReleaseRef(e.target.value)} placeholder="e.g. NEFT ref" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReleaseOpen(false)}>Cancel</Button>
            <Button onClick={handleRelease}>Confirm Release</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
