import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { ROLE_LABELS, type AppRole } from "@/lib/roles";

interface Employee {
  auth_user_id: string;
  display_name: string | null;
  email: string | null;
  role: string | null;
}

interface Cfg {
  user_id: string;
  monthly_ctc: number;
  basic_pct: number;
  hra_pct: number;
  pt_amount: number;
  tds_monthly: number;
  pan: string | null;
  pf_number: string | null;
  bank_account: string | null;
  bank_name: string | null;
  ifsc: string | null;
  designation: string | null;
  department: string | null;
  doj: string | null;
}

const empty = (uid: string): Cfg => ({
  user_id: uid, monthly_ctc: 0, basic_pct: 40, hra_pct: 50, pt_amount: 200, tds_monthly: 0,
  pan: "", pf_number: "", bank_account: "", bank_name: "", ifsc: "", designation: "", department: "", doj: null,
});

export function PayrollSettingsTab() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [configs, setConfigs] = useState<Record<string, Cfg>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    const [empRes, cfgRes] = await Promise.all([
      supabase.from("profiles").select("auth_user_id, display_name, email, role").eq("is_active", true).order("display_name"),
      (supabase.from("payroll_config") as any).select("*").eq("is_archived", false),
    ]);
    setEmployees((empRes.data ?? []) as Employee[]);
    const map: Record<string, Cfg> = {};
    (cfgRes.data ?? []).forEach((c: any) => { map[c.user_id] = c; });
    setConfigs(map);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(e =>
      (e.display_name || "").toLowerCase().includes(q) ||
      (e.email || "").toLowerCase().includes(q) ||
      (ROLE_LABELS[e.role as AppRole] || "").toLowerCase().includes(q),
    );
  }, [employees, filter]);

  function update(uid: string, patch: Partial<Cfg>) {
    setConfigs(prev => ({ ...prev, [uid]: { ...(prev[uid] ?? empty(uid)), ...patch } }));
  }

  async function save(uid: string) {
    setSavingId(uid);
    const cfg = configs[uid] ?? empty(uid);
    const payload = {
      ...cfg,
      monthly_ctc: Number(cfg.monthly_ctc) || 0,
      basic_pct: Number(cfg.basic_pct) || 0,
      hra_pct: Number(cfg.hra_pct) || 0,
      pt_amount: Number(cfg.pt_amount) || 0,
      tds_monthly: Number(cfg.tds_monthly) || 0,
      doj: cfg.doj || null,
      effective_from: new Date().toISOString().slice(0, 10),
    };
    const { error } = await (supabase.from("payroll_config") as any)
      .upsert(payload, { onConflict: "user_id" });
    setSavingId(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved");
    void load();
  }

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-3">
      <Input placeholder="Search employee…" value={filter} onChange={e => setFilter(e.target.value)} className="max-w-sm" />
      <div className="rounded-lg border border-border overflow-x-auto bg-card -mx-2 sm:mx-0" style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-x pan-y" }}>
        <table className="w-full text-xs min-w-[1400px]">
          <thead>
            <tr style={{ backgroundColor: "#F7F7F7" }}>
              {["Employee", "Designation", "Dept", "DOJ", "PAN", "PF No.", "Bank A/c", "Bank", "IFSC", "Monthly CTC ₹", "Basic %", "HRA %", "PT ₹", "TDS ₹", ""].map(h => (
                <th key={h} className="px-2 py-2 text-left font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "#666" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(e => {
              const c = configs[e.auth_user_id] ?? empty(e.auth_user_id);
              const i = (k: keyof Cfg, type: "text" | "number" | "date" = "text", w = "w-24") => (
                <Input
                  className={`h-7 text-xs ${w}`}
                  type={type}
                  value={(c as any)[k] ?? ""}
                  onChange={ev => update(e.auth_user_id, { [k]: type === "number" ? ev.target.value : ev.target.value } as any)}
                />
              );
              return (
                <tr key={e.auth_user_id} className="border-t border-border align-middle">
                  <td className="px-2 py-1.5">
                    <div className="font-medium whitespace-nowrap">{e.display_name || "—"}</div>
                    <div className="text-[10px]" style={{ color: "#999" }}>{ROLE_LABELS[e.role as AppRole] || e.role}</div>
                  </td>
                  <td className="px-2 py-1.5">{i("designation", "text", "w-28")}</td>
                  <td className="px-2 py-1.5">{i("department", "text", "w-28")}</td>
                  <td className="px-2 py-1.5">{i("doj", "date", "w-32")}</td>
                  <td className="px-2 py-1.5">{i("pan", "text", "w-28")}</td>
                  <td className="px-2 py-1.5">{i("pf_number", "text", "w-28")}</td>
                  <td className="px-2 py-1.5">{i("bank_account", "text", "w-32")}</td>
                  <td className="px-2 py-1.5">{i("bank_name", "text", "w-28")}</td>
                  <td className="px-2 py-1.5">{i("ifsc", "text", "w-24")}</td>
                  <td className="px-2 py-1.5">{i("monthly_ctc", "number", "w-24")}</td>
                  <td className="px-2 py-1.5">{i("basic_pct", "number", "w-16")}</td>
                  <td className="px-2 py-1.5">{i("hra_pct", "number", "w-16")}</td>
                  <td className="px-2 py-1.5">{i("pt_amount", "number", "w-16")}</td>
                  <td className="px-2 py-1.5">{i("tds_monthly", "number", "w-20")}</td>
                  <td className="px-2 py-1.5">
                    <Button size="sm" className="h-7 text-xs gap-1" disabled={savingId === e.auth_user_id} onClick={() => save(e.auth_user_id)}>
                      {savingId === e.auth_user_id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                      Save
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
