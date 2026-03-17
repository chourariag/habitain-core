import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Plus, FileSignature } from "lucide-react";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";

const TIER_BADGE: Record<string, string> = {
  basic: "bg-muted text-muted-foreground",
  standard: "bg-primary/20 text-primary",
  premium: "bg-warning/20 text-warning-foreground",
};

const CAN_CREATE = ["super_admin", "managing_director", "sales_director"];

function getContractStatus(endDate: string): { label: string; class: string } {
  const daysLeft = differenceInDays(new Date(endDate), new Date());
  if (daysLeft < 0) return { label: "Expired", class: "bg-destructive/20 text-destructive" };
  if (daysLeft <= 60) return { label: "Expiring Soon", class: "bg-warning/20 text-warning-foreground" };
  return { label: "Active", class: "bg-success/20 text-success-foreground" };
}

export default function AMCPage() {
  const [contracts, setContracts] = useState<any[]>([]);
  const [projects, setProjects] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [newOpen, setNewOpen] = useState(false);
  const [form, setForm] = useState({ project_id: "", tier: "basic", start_date: "", end_date: "", annual_fee: "" });
  const [submitting, setSubmitting] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  const canCreate = CAN_CREATE.includes(userRole ?? "");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [contractRes, projRes, roleRes] = await Promise.all([
      (supabase.from("amc_contracts" as any) as any)
        .select("*, projects(name, client_name)")
        .eq("is_archived", false)
        .order("end_date", { ascending: true }),
      supabase.from("projects").select("id, name"),
      supabase.auth.getUser().then(async ({ data: { user } }) => {
        if (!user) return null;
        const { data } = await supabase.rpc("get_user_role", { _user_id: user.id });
        return data as string | null;
      }),
    ]);
    setContracts(contractRes.data ?? []);
    const projMap: Record<string, string> = {};
    (projRes.data ?? []).forEach((p: any) => { projMap[p.id] = p.name; });
    setProjects(projMap);
    setUserRole(roleRes);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalRevenue = contracts.reduce((sum: number, c: any) => sum + (Number(c.annual_fee) || 0), 0);

  const handleCreate = async () => {
    if (!form.project_id || !form.start_date || !form.end_date || !form.annual_fee) {
      toast.error("Fill all required fields");
      return;
    }
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const proj = (await supabase.from("projects").select("client_name").eq("id", form.project_id).single()).data;
      const { error } = await (supabase.from("amc_contracts" as any) as any).insert({
        project_id: form.project_id,
        client_name: proj?.client_name || "Client",
        tier: form.tier,
        start_date: form.start_date,
        end_date: form.end_date,
        annual_fee: parseFloat(form.annual_fee),
        created_by: user.id,
      });
      if (error) throw error;
      toast.success("AMC contract created");
      setNewOpen(false);
      setForm({ project_id: "", tier: "basic", start_date: "", end_date: "", annual_fee: "" });
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">AMC Contracts</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Annual Maintenance Contracts · Total Revenue: <span className="font-semibold text-foreground">₹{totalRevenue.toLocaleString()}</span>
          </p>
        </div>
        {canCreate && <Button onClick={() => setNewOpen(true)}><Plus className="h-4 w-4 mr-1" /> New AMC Contract</Button>}
      </div>

      {contracts.length === 0 ? (
        <Card><CardContent className="py-10 text-center"><FileSignature className="h-10 w-10 mx-auto text-muted-foreground mb-3" /><p className="text-muted-foreground text-sm">No AMC contracts yet.</p></CardContent></Card>
      ) : (
        <div className="bg-card rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium text-muted-foreground">Client</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Project</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Tier</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Start</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">End</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Annual Fee</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((c: any) => {
                  const status = getContractStatus(c.end_date);
                  return (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="p-3 font-medium text-card-foreground">{c.client_name}</td>
                      <td className="p-3 text-muted-foreground">{c.projects?.name || "—"}</td>
                      <td className="p-3"><Badge variant="outline" className={TIER_BADGE[c.tier] ?? ""}>{c.tier}</Badge></td>
                      <td className="p-3 text-card-foreground">{format(new Date(c.start_date), "dd MMM yyyy")}</td>
                      <td className="p-3 text-card-foreground">{format(new Date(c.end_date), "dd MMM yyyy")}</td>
                      <td className="p-3 text-card-foreground font-semibold">₹{Number(c.annual_fee).toLocaleString()}</td>
                      <td className="p-3"><Badge variant="outline" className={status.class}>{status.label}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New AMC Contract</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Project *</Label>
              <Select value={form.project_id} onValueChange={(v) => setForm({ ...form, project_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>{Object.entries(projects).map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tier *</Label>
              <Select value={form.tier} onValueChange={(v) => setForm({ ...form, tier: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Basic</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Start Date *</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
              <div><Label>End Date *</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
            </div>
            <div><Label>Annual Fee (₹) *</Label><Input type="number" value={form.annual_fee} onChange={(e) => setForm({ ...form, annual_fee: e.target.value })} placeholder="Enter fee" /></div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} disabled={submitting}>{submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Create Contract</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
