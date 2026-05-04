import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Download, Upload } from "lucide-react";
import { downloadXlsx, logAudit, readXlsx, SUPER_ADMIN_FEATURES, SUPER_ADMIN_ROLES } from "@/lib/super-admin";
import { ROLE_LABELS } from "@/lib/roles";
import { toast } from "sonner";

type Row = { role: string; feature: string; enabled: boolean };

export function RolesAccessTab() {
  const [diff, setDiff] = useState<{ rows: Row[] } | null>(null);

  const { data, refetch } = useQuery({
    queryKey: ["role-feature-access"],
    queryFn: async () => {
      const { data } = await supabase.from("role_feature_access" as never).select("*");
      return ((data as unknown as Row[]) || []);
    },
  });

  const matrix = useMemo(() => {
    const m = new Map<string, boolean>();
    (data || []).forEach(r => m.set(`${r.role}|${r.feature}`, r.enabled));
    return m;
  }, [data]);

  async function toggle(role: string, feature: string) {
    const current = matrix.get(`${role}|${feature}`) ?? true;
    const next = !current;
    const { error } = await supabase.from("role_feature_access" as never).upsert(
      { role, feature, enabled: next } as never,
      { onConflict: "role,feature" } as never
    );
    if (error) { toast.error(error.message); return; }
    await logAudit({ section: "Roles & Access", action: "toggle", entity: `${role} / ${feature}`, previous_value: { enabled: current }, new_value: { enabled: next } });
    refetch();
  }

  function handleDownload() {
    const rows: Record<string, unknown>[] = [];
    SUPER_ADMIN_ROLES.forEach(r => {
      SUPER_ADMIN_FEATURES.forEach(f => {
        rows.push({ Role: r, Module: f, "Access (Y/N)": (matrix.get(`${r}|${f}`) ?? true) ? "Y" : "N" });
      });
    });
    downloadXlsx(rows, "Roles_Access_Matrix.xlsx", "Access");
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return; e.target.value = "";
    const rows = await readXlsx(file);
    const parsed: Row[] = rows.map(r => ({
      role: String(r["Role"] || "").trim(),
      feature: String(r["Module"] || "").trim(),
      enabled: String(r["Access (Y/N)"] || "Y").toUpperCase().startsWith("Y"),
    })).filter(r => r.role && r.feature);
    setDiff({ rows: parsed });
  }

  async function applyDiff() {
    if (!diff) return;
    const { error } = await supabase.from("role_feature_access" as never).upsert(diff.rows as never, { onConflict: "role,feature" } as never);
    if (error) { toast.error(error.message); return; }
    await logAudit({ section: "Roles & Access", action: "bulk_upload", new_value: { count: diff.rows.length } });
    toast.success(`${diff.rows.length} rules updated`);
    setDiff(null); refetch();
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button variant="outline" onClick={handleDownload}><Download className="h-4 w-4" /> Download</Button>
        <label><input type="file" accept=".xlsx" className="hidden" onChange={handleUpload} /><Button asChild variant="outline"><span><Upload className="h-4 w-4" /> Upload</span></Button></label>
      </div>
      <div className="bg-card rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-card">Role</TableHead>
              {SUPER_ADMIN_FEATURES.map(f => <TableHead key={f} className="text-xs whitespace-nowrap">{f}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {SUPER_ADMIN_ROLES.map(role => (
              <TableRow key={role}>
                <TableCell className="sticky left-0 bg-card font-medium text-xs">{ROLE_LABELS[role as keyof typeof ROLE_LABELS] || role}</TableCell>
                {SUPER_ADMIN_FEATURES.map(f => {
                  const on = matrix.get(`${role}|${f}`) ?? true;
                  return (
                    <TableCell key={f} className="text-center">
                      <button onClick={() => toggle(role, f)} className={`w-7 h-5 rounded-full transition ${on ? "bg-primary" : "bg-muted"}`}>
                        <span className={`block w-4 h-4 bg-white rounded-full transition ${on ? "ml-3" : "ml-0.5"}`} />
                      </button>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!diff} onOpenChange={(o)=>!o && setDiff(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Review Access Changes</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{diff?.rows.length} rules will be upserted.</p>
          <div className="max-h-[40vh] overflow-y-auto border rounded-md">
            <Table><TableHeader><TableRow><TableHead>Role</TableHead><TableHead>Module</TableHead><TableHead>Access</TableHead></TableRow></TableHeader>
              <TableBody>{diff?.rows.slice(0, 200).map((r,i)=>(<TableRow key={i}><TableCell>{r.role}</TableCell><TableCell>{r.feature}</TableCell><TableCell>{r.enabled?"Y":"N"}</TableCell></TableRow>))}</TableBody>
            </Table>
          </div>
          <DialogFooter><Button variant="outline" onClick={()=>setDiff(null)}>Cancel</Button><Button onClick={applyDiff}>Apply</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
