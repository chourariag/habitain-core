import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Download, Upload, KeyRound } from "lucide-react";
import { downloadXlsx, logAudit, readXlsx } from "@/lib/super-admin";
import { ROLE_LABELS, type AppRole } from "@/lib/roles";
import { createUser, deactivateUser, reactivateUser, updateUserRole } from "@/lib/admin-api";
import { AddUserDialog } from "@/components/admin/AddUserDialog";
import { toast } from "sonner";

type Profile = {
  id: string; auth_user_id: string;
  display_name: string | null; email: string | null;
  role: AppRole; is_active: boolean | null;
  created_at: string;
};

export function UsersTab() {
  const [diff, setDiff] = useState<Array<{ email: string; role: string; display_name: string }> | null>(null);

  const { data: profiles, refetch } = useQuery({
    queryKey: ["super-admin-users"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      return (data as unknown as Profile[]) || [];
    },
  });

  function handleDownload() {
    const rows = (profiles || []).map(p => ({
      Name: p.display_name || "", Email: p.email || "",
      Role: p.role, Department: "", Language: "en",
      Status: p.is_active === false ? "Inactive" : "Active",
      "Date Created": new Date(p.created_at).toLocaleDateString("en-GB"),
    }));
    downloadXlsx(rows, "Users.xlsx", "Users");
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return; e.target.value = "";
    const rows = await readXlsx(file);
    const parsed = rows.map(r => ({
      email: String(r["Email"] || "").trim(),
      role: String(r["Role"] || "").trim(),
      display_name: String(r["Name"] || "").trim(),
    })).filter(r => r.email);
    setDiff(parsed);
  }

  async function applyUpload() {
    if (!diff) return;
    const existing = new Set((profiles || []).map(p => p.email?.toLowerCase()));
    let created = 0, failed = 0;
    for (const u of diff) {
      if (existing.has(u.email.toLowerCase())) continue;
      try { await createUser(u.email, u.role as AppRole); created++; }
      catch { failed++; }
    }
    await logAudit({ section: "Users", action: "bulk_upload", new_value: { created, failed } });
    toast.success(`Created ${created} users, ${failed} failed`);
    setDiff(null); refetch();
  }

  async function changeRole(p: Profile, role: AppRole) {
    try {
      await updateUserRole(p.auth_user_id, role);
      await logAudit({ section: "Users", action: "change_role", entity: p.email || p.id, previous_value: { role: p.role }, new_value: { role } });
      toast.success("Role updated"); refetch();
    } catch (e) { toast.error((e as Error).message); }
  }

  async function toggleActive(p: Profile) {
    try {
      if (p.is_active === false) await reactivateUser(p.auth_user_id);
      else await deactivateUser(p.auth_user_id);
      await logAudit({ section: "Users", action: p.is_active === false ? "reactivate" : "deactivate", entity: p.email || p.id });
      refetch();
    } catch (e) { toast.error((e as Error).message); }
  }

  async function resetPassword(p: Profile) {
    if (!p.email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(p.email);
    if (error) { toast.error(error.message); return; }
    await logAudit({ section: "Users", action: "password_reset", entity: p.email });
    toast.success(`Password reset email sent to ${p.email}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={handleDownload}><Download className="h-4 w-4" /> Download Users</Button>
        <label><input type="file" accept=".xlsx" className="hidden" onChange={handleUpload} /><Button asChild variant="outline"><span><Upload className="h-4 w-4" /> Upload Users</span></Button></label>
        <AddUserDialog onUserCreated={refetch} />
      </div>
      <div className="bg-card rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead>
            <TableHead>Status</TableHead><TableHead>Created</TableHead><TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(profiles || []).map(p => (
              <TableRow key={p.id}>
                <TableCell>{p.display_name || "—"}</TableCell>
                <TableCell className="text-xs">{p.email}</TableCell>
                <TableCell>
                  <select className="text-xs border rounded px-1 py-0.5" value={p.role} onChange={e=>changeRole(p, e.target.value as AppRole)}>
                    {Object.entries(ROLE_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                  </select>
                </TableCell>
                <TableCell><span className={p.is_active === false ? "text-destructive text-xs" : "text-xs"}>{p.is_active === false ? "Inactive" : "Active"}</span></TableCell>
                <TableCell className="text-xs">{new Date(p.created_at).toLocaleDateString("en-GB")}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button size="sm" variant="ghost" onClick={()=>resetPassword(p)} title="Reset password"><KeyRound className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={()=>toggleActive(p)}>{p.is_active === false ? "Reactivate" : "Deactivate"}</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!diff} onOpenChange={(o)=>!o && setDiff(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Review Users to Create</DialogTitle></DialogHeader>
          <p className="text-sm">{diff?.length} rows in file. Existing emails will be skipped.</p>
          <DialogFooter><Button variant="outline" onClick={()=>setDiff(null)}>Cancel</Button><Button onClick={applyUpload}>Create Accounts</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
