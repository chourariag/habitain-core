import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Settings, Save, Plus } from "lucide-react";

const ANNUAL_TARGET = 300000000; // ₹30Cr
const ADS_ANNUAL_TARGET = 10000000; // ₹1Cr

export function SalesSettingsTab({ deals }: { deals: any[] }) {
  const [targets, setTargets] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ monthly_target: "" });
  const [addForm, setAddForm] = useState({ salesperson_id: "", division: "habitainer", monthly_target: "" });
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const [{ data: t }, { data: p }] = await Promise.all([
        supabase.from("sales_targets").select("*").eq("fiscal_year", "FY27").order("salesperson_name"),
        supabase.from("profiles").select("id, auth_user_id, full_name, email, role").eq("is_active", true),
      ]);
      setTargets(t || []);
      setProfiles(p || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const wonDeals = useMemo(() => deals.filter(d => d.stage === "Won"), [deals]);
  const habitainerWon = wonDeals.filter(d => d.division !== "ads").reduce((s, d) => s + (d.contract_value || 0), 0);
  const adsWon = wonDeals.filter(d => d.division === "ads").reduce((s, d) => s + (d.contract_value || 0), 0);
  const combinedWon = habitainerWon + adsWon;

  const fmt = (v: number) => {
    if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;
    if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
    return `₹${v.toLocaleString()}`;
  };

  const handleSaveTarget = async (id: string) => {
    const { error } = await supabase.from("sales_targets").update({
      monthly_target: Number(editForm.monthly_target),
      quarterly_target: Number(editForm.monthly_target) * 3,
    }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Target updated");
      setEditingId(null);
      const { data } = await supabase.from("sales_targets").select("*").eq("fiscal_year", "FY27");
      setTargets(data || []);
    }
  };

  const handleAdd = async () => {
    if (!addForm.salesperson_id || !addForm.monthly_target) { toast.error("All fields required"); return; }
    const profile = profiles.find(p => p.auth_user_id === addForm.salesperson_id);
    const { error } = await supabase.from("sales_targets").insert({
      salesperson_id: addForm.salesperson_id,
      salesperson_name: profile?.full_name || profile?.email || "Unknown",
      division: addForm.division,
      fiscal_year: "FY27",
      monthly_target: Number(addForm.monthly_target),
      quarterly_target: Number(addForm.monthly_target) * 3,
    } as any);
    if (error) toast.error(error.message);
    else {
      toast.success("Target added");
      setAdding(false);
      setAddForm({ salesperson_id: "", division: "habitainer", monthly_target: "" });
      const { data } = await supabase.from("sales_targets").select("*").eq("fiscal_year", "FY27");
      setTargets(data || []);
    }
  };

  // Group by person
  const grouped = useMemo(() => {
    const map: Record<string, { habitainer?: any; ads?: any; name: string }> = {};
    targets.forEach(t => {
      if (!map[t.salesperson_id]) map[t.salesperson_id] = { name: t.salesperson_name };
      if (t.division === "ads") map[t.salesperson_id].ads = t;
      else map[t.salesperson_id].habitainer = t;
    });
    return Object.entries(map);
  }, [targets]);

  if (loading) return <div className="text-center py-8 text-xs" style={{ color: "#999" }}>Loading…</div>;

  return (
    <div className="space-y-4">
      {/* Overall targets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="p-3" style={{ background: "#fff" }}>
          <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#666" }}>Combined Target</span>
          <div className="text-lg font-bold" style={{ color: "#006039" }}>{fmt(combinedWon)} / {fmt(ANNUAL_TARGET)}</div>
          <Progress value={Math.min(100, (combinedWon / ANNUAL_TARGET) * 100)} className="h-2 mt-1" />
        </Card>
        <Card className="p-3" style={{ background: "#fff" }}>
          <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#666" }}>Habitainer</span>
          <div className="text-lg font-bold" style={{ color: "#006039" }}>{fmt(habitainerWon)}</div>
          <Progress value={Math.min(100, (habitainerWon / (ANNUAL_TARGET - ADS_ANNUAL_TARGET)) * 100)} className="h-2 mt-1" />
        </Card>
        <Card className="p-3" style={{ background: "#fff" }}>
          <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#666" }}>ADS</span>
          <div className="text-lg font-bold" style={{ color: "#006039" }}>{fmt(adsWon)} / {fmt(ADS_ANNUAL_TARGET)}</div>
          <Progress value={Math.min(100, (adsWon / ADS_ANNUAL_TARGET) * 100)} className="h-2 mt-1" />
        </Card>
      </div>

      {/* Per-person targets */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm" style={{ color: "#1A1A1A" }}>Salesperson Targets (FY27)</h3>
        <Button size="sm" variant="outline" onClick={() => setAdding(true)} style={{ borderColor: "#006039", color: "#006039" }}>
          <Plus className="h-3 w-3 mr-1" /> Add Target
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Salesperson</TableHead>
              <TableHead>Division</TableHead>
              <TableHead>Monthly Target</TableHead>
              <TableHead>Quarterly</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {targets.map(t => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.salesperson_name}</TableCell>
                <TableCell>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: t.division === "ads" ? "#D4860A" : "#006039", color: "#fff" }}>
                    {t.division === "ads" ? "ADS" : "Habitainer"}
                  </span>
                </TableCell>
                <TableCell>
                  {editingId === t.id ? (
                    <Input type="number" value={editForm.monthly_target} onChange={e => setEditForm({ monthly_target: e.target.value })} className="w-28" />
                  ) : (
                    fmt(t.monthly_target)
                  )}
                </TableCell>
                <TableCell>{fmt(t.quarterly_target)}</TableCell>
                <TableCell>
                  {editingId === t.id ? (
                    <Button size="sm" onClick={() => handleSaveTarget(t.id)} style={{ background: "#006039", color: "#fff" }}>
                      <Save className="h-3 w-3" />
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => { setEditingId(t.id); setEditForm({ monthly_target: String(t.monthly_target) }); }}>
                      <Settings className="h-3 w-3" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {targets.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center py-4 text-xs" style={{ color: "#999" }}>No targets configured</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {adding && (
        <Card className="p-3 space-y-2" style={{ border: "1px solid #006039" }}>
          <span className="text-xs font-semibold" style={{ color: "#006039" }}>Add New Target</span>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Salesperson</Label>
              <select className="w-full border rounded px-2 py-1.5 text-sm" value={addForm.salesperson_id} onChange={e => setAddForm(f => ({ ...f, salesperson_id: e.target.value }))}>
                <option value="">Select…</option>
                {profiles.map(p => <option key={p.auth_user_id} value={p.auth_user_id}>{p.full_name || p.email}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">Division</Label>
              <select className="w-full border rounded px-2 py-1.5 text-sm" value={addForm.division} onChange={e => setAddForm(f => ({ ...f, division: e.target.value }))}>
                <option value="habitainer">Habitainer</option>
                <option value="ads">ADS</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Monthly Target ₹</Label>
              <Input type="number" value={addForm.monthly_target} onChange={e => setAddForm(f => ({ ...f, monthly_target: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} style={{ background: "#006039", color: "#fff" }}>Add</Button>
            <Button size="sm" variant="outline" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
