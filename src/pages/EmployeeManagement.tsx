import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { AppRole, ROLE_LABELS, ROLE_TIERS } from "@/lib/roles";
import { createEmployee, updateEmployee, resetEmployeePassword, logBulkDeleteAllEmployees, deleteEmployee } from "@/lib/admin-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Copy, KeyRound, Pencil, Search, ShieldOff, ShieldCheck, UserPlus, Loader2, Download, Sparkles, Trash2, AlertTriangle, Users } from "lucide-react";

const DEFAULT_PWD = "Altree@1234";

interface ProfileRow {
  id: string;
  auth_user_id: string;
  email: string | null;
  display_name: string | null;
  phone: string | null;
  role: AppRole;
  department: string | null;
  reporting_manager_id: string | null;
  secondary_manager_id: string | null;
  is_active: boolean | null;
  created_at: string;
}

function copy(text: string) {
  navigator.clipboard.writeText(text).then(() => toast.success("Copied"));
}

function fmtDate(s: string) {
  const d = new Date(s);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function downloadCsv(rows: Record<string, string>[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function EmployeeManagement() {
  const { role, loading: roleLoading } = useUserRole();
  const allowed = role === "super_admin" || role === "managing_director";

  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterDept, setFilterDept] = useState<string>("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ProfileRow | null>(null);
  const [resetTarget, setResetTarget] = useState<ProfileRow | null>(null);
  const [resetResult, setResetResult] = useState<{ email: string; password: string } | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<ProfileRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProfileRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [createdResult, setCreatedResult] = useState<{ email: string; password: string } | null>(null);
  const [seedOpen, setSeedOpen] = useState(false);

  const { data: employees, isLoading: loading, refetch } = useQuery<ProfileRow[]>({
    queryKey: ["profiles"],
    enabled: allowed,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("display_name");
      if (error) throw error;
      return (data ?? []) as ProfileRow[];
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const rows = employees ?? [];
  const employeeCount = employees?.length ?? 0;

  const loadRows = () => { refetch(); };

  const departments = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => { if (r.department) s.add(r.department); });
    return Array.from(s).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filterRole !== "all" && r.role !== filterRole) return false;
      if (filterDept !== "all" && r.department !== filterDept) return false;
      if (!q) return true;
      return (r.display_name || "").toLowerCase().includes(q)
        || (r.email || "").toLowerCase().includes(q)
        || (r.department || "").toLowerCase().includes(q);
    });
  }, [rows, search, filterRole, filterDept]);

  if (roleLoading) return <div className="p-6">Loading…</div>;
  if (!allowed) return <Navigate to="/dashboard" replace />;

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <header className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-display font-bold" style={{ color: "#006039" }}>Employee Management</h1>
          <div
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold text-white"
            style={{ background: "#1A6645" }}
          >
            <Users className="h-4 w-4" />
            Total Employees: {employeeCount}
          </div>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <p className="text-sm text-muted-foreground">Create, edit, deactivate and reset passwords for all HStack employees.</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setSeedOpen(true)}>
              <Sparkles className="h-4 w-4 mr-2" /> Bulk Seed
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" /> New Employee
            </Button>
            {(role === "super_admin" || role === "managing_director") && <RemoveAllButton onCleared={loadRows} />}
          </div>
        </div>
      </header>

      <div className="flex flex-wrap gap-3 items-center bg-[#F7F7F7] border rounded-lg p-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, department…" className="pl-9 bg-white" />
        </div>
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="w-[220px] bg-white"><SelectValue /></SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="all">All roles</SelectItem>
            {Object.entries(ROLE_TIERS).map(([tier, roles]) => (
              <SelectGroup key={tier}>
                <SelectLabel className="text-xs">{tier}</SelectLabel>
                {roles.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r] || r}</SelectItem>)}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterDept} onValueChange={setFilterDept}>
          <SelectTrigger className="w-[200px] bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="text-sm text-muted-foreground ml-auto">{filtered.length} of {employeeCount}</div>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-10"><Loader2 className="h-5 w-5 animate-spin inline" /></TableCell></TableRow>
            ) : employeeCount === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No employees found. Use Bulk Seed or New Employee to add team members.</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No employees match these filters.</TableCell></TableRow>
            ) : filtered.map((r) => {
              const primaryMgr = r.reporting_manager_id ? rows.find((m) => m.id === r.reporting_manager_id) : null;
              const secondaryMgr = r.secondary_manager_id ? rows.find((m) => m.id === r.secondary_manager_id) : null;
              return (
              <TableRow key={r.id}>
                <TableCell className="font-medium">
                  <div>{r.display_name || "—"}</div>
                  {primaryMgr && (
                    <div className="text-xs text-muted-foreground font-normal">
                      Reports to: {primaryMgr.display_name || primaryMgr.email}
                    </div>
                  )}
                  {secondaryMgr && (
                    <div className="text-xs text-muted-foreground font-normal">
                      Also reports to: {secondaryMgr.display_name || secondaryMgr.email}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-sm">{r.email}</TableCell>
                <TableCell><Badge variant="secondary">{ROLE_LABELS[r.role] || r.role}</Badge></TableCell>
                <TableCell>{r.department || "—"}</TableCell>
                <TableCell>
                  {r.is_active
                    ? <Badge style={{ background: "#E8F2ED", color: "#006039" }}>Active</Badge>
                    : <Badge style={{ background: "#FDE7E9", color: "#F40009" }}>Inactive</Badge>}
                </TableCell>
                <TableCell className="text-sm">{fmtDate(r.created_at)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" title="Edit" onClick={() => setEditTarget(r)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" title="Reset password" onClick={() => setResetTarget(r)}><KeyRound className="h-4 w-4" /></Button>
                    {r.is_active
                      ? <Button size="sm" variant="ghost" title="Deactivate" onClick={() => setDeactivateTarget(r)}><ShieldOff className="h-4 w-4" style={{ color: "#F40009" }} /></Button>
                      : <Button size="sm" variant="ghost" title="Reactivate" onClick={async () => { await updateEmployee({ user_id: r.auth_user_id, is_active: true }); toast.success("Reactivated"); loadRows(); }}><ShieldCheck className="h-4 w-4" style={{ color: "#006039" }} /></Button>}
                    <Button size="sm" variant="ghost" title="Delete employee" onClick={() => setDeleteTarget(r)}><Trash2 className="h-4 w-4" style={{ color: "#F40009" }} /></Button>
                  </div>
                </TableCell>
              </TableRow>
            );})}
          </TableBody>
        </Table>
      </div>

      <CreateEmployeeDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        managers={rows}
        onCreated={(res) => { setCreatedResult(res); loadRows(); }}
      />

      <EditEmployeeDialog
        target={editTarget}
        onClose={() => setEditTarget(null)}
        managers={rows}
        onSaved={loadRows}
      />

      {/* Reset password dialog */}
      <Dialog open={!!resetTarget} onOpenChange={(o) => !o && setResetTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password for {resetTarget?.display_name || resetTarget?.email}</DialogTitle>
            <DialogDescription>A new temporary password will be generated and shown only once.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResetTarget(null)}>Cancel</Button>
            <Button onClick={async () => {
              if (!resetTarget) return;
              try {
                const res = await resetEmployeePassword(resetTarget.auth_user_id);
                setResetResult({ email: resetTarget.email || "", password: res.temp_password });
                setResetTarget(null);
              } catch (e) { toast.error((e as Error).message); }
            }}>Generate new password</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset result */}
      <CredentialsDialog
        open={!!resetResult}
        onClose={() => setResetResult(null)}
        title="New temporary password"
        email={resetResult?.email}
        password={resetResult?.password}
      />

      {/* Created credentials */}
      <CredentialsDialog
        open={!!createdResult}
        onClose={() => setCreatedResult(null)}
        title="Employee created"
        email={createdResult?.email}
        password={createdResult?.password}
      />

      {/* Deactivate confirm */}
      <Dialog open={!!deactivateTarget} onOpenChange={(o) => !o && setDeactivateTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate {deactivateTarget?.display_name || deactivateTarget?.email}?</DialogTitle>
            <DialogDescription>The account will be banned and marked inactive. You can reactivate later.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeactivateTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={async () => {
              if (!deactivateTarget) return;
              try {
                await updateEmployee({ user_id: deactivateTarget.auth_user_id, is_active: false });
                toast.success("Deactivated");
                setDeactivateTarget(null);
                loadRows();
              } catch (e) { toast.error((e as Error).message); }
            }}>Deactivate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && !deleting && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Employee</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete {deleteTarget?.display_name || deleteTarget?.email}? This will remove their account from both HStack and Supabase Auth. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" disabled={deleting} onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={deleting} onClick={async () => {
              if (!deleteTarget) return;
              setDeleting(true);
              try {
                await deleteEmployee(deleteTarget.auth_user_id);
                toast.success("Employee deleted");
                setDeleteTarget(null);
                loadRows();
              } catch (e) { toast.error((e as Error).message); }
              finally { setDeleting(false); }
            }}>{deleting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Deleting…</> : "Delete"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SeedDialog open={seedOpen} onClose={() => { setSeedOpen(false); loadRows(); }} managers={rows} />

    </div>
  );
}

/* ───────────────────── Create dialog ───────────────────── */

function CreateEmployeeDialog({ open, onOpenChange, managers, onCreated }: {
  open: boolean; onOpenChange: (o: boolean) => void; managers: ProfileRow[];
  onCreated: (res: { email: string; password: string }) => void;
}) {
  const [form, setForm] = useState({
    full_name: "", email: "", phone: "", role: "" as AppRole | "",
    department: "", reporting_manager_id: "", secondary_manager_id: "", temp_password: DEFAULT_PWD,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setForm({ full_name: "", email: "", phone: "", role: "" as AppRole | "", department: "", reporting_manager_id: "", secondary_manager_id: "", temp_password: DEFAULT_PWD }); }, [open]);

  const submit = async () => {
    if (!form.full_name || !form.email || !form.role) { toast.error("Name, email and role are required"); return; }
    setSaving(true);
    try {
      const res = await createEmployee({
        full_name: form.full_name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone || undefined,
        role: form.role as AppRole,
        department: form.department || undefined,
        reporting_manager_id: form.reporting_manager_id || undefined,
        secondary_manager_id: form.secondary_manager_id || undefined,
        temp_password: form.temp_password || DEFAULT_PWD,
      });
      toast.success("Employee created");
      onOpenChange(false);
      onCreated({ email: res.email, password: res.temp_password });
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>New employee</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="Full Name *"><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
          <Field label="Email *"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@altree.in" /></Field>
          <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Role *">
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as AppRole })}>
              <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {Object.entries(ROLE_TIERS).map(([tier, roles]) => (
                  <SelectGroup key={tier}>
                    <SelectLabel className="text-xs">{tier}</SelectLabel>
                    {roles.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r] || r}</SelectItem>)}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Department"><Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></Field>
          <Field label="Reporting Manager">
            <Select value={form.reporting_manager_id || "none"} onValueChange={(v) => setForm({ ...form, reporting_manager_id: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="none">— None —</SelectItem>
                {managers.filter((m) => m.is_active).map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.display_name || m.email} · {ROLE_LABELS[m.role] || m.role}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Secondary Manager (optional)">
            <Select value={form.secondary_manager_id || "none"} onValueChange={(v) => setForm({ ...form, secondary_manager_id: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="none">— None —</SelectItem>
                {managers.filter((m) => m.is_active && m.id !== form.reporting_manager_id).map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.display_name || m.email} · {ROLE_LABELS[m.role] || m.role}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Temporary Password">
            <div className="flex gap-2">
              <Input value={form.temp_password} onChange={(e) => setForm({ ...form, temp_password: e.target.value })} />
              <Button type="button" variant="outline" size="icon" onClick={() => copy(form.temp_password)}><Copy className="h-4 w-4" /></Button>
            </div>
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create employee"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>;
}

/* ───────────────────── Edit dialog ───────────────────── */

function EditEmployeeDialog({ target, onClose, managers, onSaved }: {
  target: ProfileRow | null; onClose: () => void; managers: ProfileRow[]; onSaved: () => void;
}) {
  const [form, setForm] = useState({ role: "" as AppRole, department: "", reporting_manager_id: "", secondary_manager_id: "", display_name: "", phone: "" });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (target) setForm({
      role: target.role,
      department: target.department || "",
      reporting_manager_id: target.reporting_manager_id || "",
      secondary_manager_id: target.secondary_manager_id || "",
      display_name: target.display_name || "",
      phone: target.phone || "",
    });
  }, [target]);

  if (!target) return null;
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Edit {target.display_name || target.email}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="Full Name"><Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} /></Field>
          <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Role">
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as AppRole })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                {Object.entries(ROLE_TIERS).map(([tier, roles]) => (
                  <SelectGroup key={tier}>
                    <SelectLabel className="text-xs">{tier}</SelectLabel>
                    {roles.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r] || r}</SelectItem>)}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Department"><Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></Field>
          <Field label="Reporting Manager">
            <Select value={form.reporting_manager_id || "none"} onValueChange={(v) => setForm({ ...form, reporting_manager_id: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="none">— None —</SelectItem>
                {managers.filter((m) => m.is_active && m.id !== target.id).map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.display_name || m.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Secondary Manager (optional)">
            <Select value={form.secondary_manager_id || "none"} onValueChange={(v) => setForm({ ...form, secondary_manager_id: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="none">— None —</SelectItem>
                {managers.filter((m) => m.is_active && m.id !== target.id && m.id !== form.reporting_manager_id).map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.display_name || m.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={async () => {
            setSaving(true);
            try {
              await updateEmployee({
                user_id: target.auth_user_id,
                role: form.role,
                department: form.department || null,
                reporting_manager_id: form.reporting_manager_id || null,
                secondary_manager_id: form.secondary_manager_id || null,
                display_name: form.display_name,
                phone: form.phone || null,
              });
              toast.success("Updated");
              onSaved(); onClose();
            } catch (e) { toast.error((e as Error).message); }
            finally { setSaving(false); }
          }} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ───────────────────── Credentials dialog ───────────────────── */

function CredentialsDialog({ open, onClose, title, email, password }: {
  open: boolean; onClose: () => void; title: string; email?: string; password?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Copy these credentials now — the password will not be shown again.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Email</Label>
            <div className="flex gap-2"><Input readOnly value={email || ""} /><Button size="icon" variant="outline" onClick={() => email && copy(email)}><Copy className="h-4 w-4" /></Button></div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Temporary password</Label>
            <div className="flex gap-2"><Input readOnly value={password || ""} className="font-mono" /><Button size="icon" variant="outline" onClick={() => password && copy(password)}><Copy className="h-4 w-4" /></Button></div>
          </div>
        </div>
        <DialogFooter><Button onClick={onClose}>Done</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ───────────────────── Seed dialog ───────────────────── */

type SeedEntry = { full_name: string; email: string; role: AppRole; department?: string; manager_email?: string; secondary_manager_email?: string };
type SeedLog = { idx: number; email: string; status: "queued" | "ok" | "skipped" | "error"; message?: string; password?: string };

const ROLE_ALIASES: Record<string, AppRole> = {
  "managing director": "managing_director" as AppRole,
  "principal architect/director": "principal_architect" as AppRole,
  "principal architect": "principal_architect" as AppRole,
  "finance manager": "finance_manager" as AppRole,
  "hr admin": "hr_admin" as AppRole,
  "hr executive": "hr_executive" as AppRole,
  "marketing executive": "marketing" as AppRole,
  marketing: "marketing" as AppRole,
  "sales executive": "sales_executive" as AppRole,
  "sales director": "sales_director" as AppRole,
  "finance director": "finance_director" as AppRole,
  "architecture director": "architecture_director" as AppRole,
};

function normalizeRole(raw: string): AppRole | "" {
  const v = raw.trim();
  if (!v) return "";
  if (ROLE_LABELS[v]) return v as AppRole;
  const lower = v.toLowerCase();
  if (ROLE_ALIASES[lower]) return ROLE_ALIASES[lower];
  const snake = lower.replace(/[\s/\-]+/g, "_");
  if (ROLE_LABELS[snake]) return snake as AppRole;
  return "";
}

function parseSeedText(text: string): SeedEntry[] {
  return text.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#")).map((line) => {
    const parts = line.split(",").map((p) => p.trim());
    return {
      full_name: parts[0] || "",
      email: (parts[1] || "").toLowerCase(),
      role: normalizeRole(parts[2] || "") as AppRole,
      department: parts[3] || undefined,
      manager_email: parts[4]?.toLowerCase() || undefined,
      secondary_manager_email: parts[5]?.toLowerCase() || undefined,
    };
  }).filter((e) => e.full_name && e.email && e.role);
}

function SeedDialog({ open, onClose, managers }: { open: boolean; onClose: () => void; managers: ProfileRow[] }) {
  const [text, setText] = useState("");
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<SeedLog[]>([]);
  const [tab, setTab] = useState("paste");

  useEffect(() => { if (!open) { setLogs([]); setRunning(false); setTab("paste"); } }, [open]);

  const run = async () => {
    const entries = parseSeedText(text);
    if (!entries.length) { toast.error("No valid rows parsed"); return; }
    setRunning(true);
    setLogs(entries.map((e, idx) => ({ idx, email: e.email, status: "queued" })));
    setTab("progress");

    const emailToId = new Map(managers.map((m) => [(m.email || "").toLowerCase(), m.id]));

    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      try {
        const managerId = e.manager_email ? emailToId.get(e.manager_email) : undefined;
        if (e.manager_email && !managerId) {
          throw new Error(`Manager not yet created: ${e.manager_email}`);
        }
        const secondaryManagerId = e.secondary_manager_email ? emailToId.get(e.secondary_manager_email) : undefined;
        if (e.secondary_manager_email && !secondaryManagerId) {
          throw new Error(`Secondary manager not yet created: ${e.secondary_manager_email}`);
        }
        const res = await createEmployee({
          full_name: e.full_name, email: e.email, role: e.role,
          department: e.department, reporting_manager_id: managerId,
          secondary_manager_id: secondaryManagerId,
          temp_password: DEFAULT_PWD,
        });
        // res.user_id is auth_user_id; FK reporting_manager_id references profiles.id — look it up
        const { data: newProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("auth_user_id", res.user_id)
          .maybeSingle();
        if (newProfile?.id) emailToId.set(e.email, newProfile.id);
        setLogs((prev) => prev.map((l) => l.idx === i ? { ...l, status: "ok", password: res.temp_password } : l));
      } catch (err) {
        const msg = (err as Error).message || "Failed";
        const skipped = /already|exists|registered/i.test(msg);
        // If the user already exists, backfill the id map so downstream subordinates resolve
        if (skipped) {
          const { data: existing } = await supabase
            .from("profiles")
            .select("id")
            .eq("email", e.email)
            .maybeSingle();
          if (existing?.id) emailToId.set(e.email, existing.id);
        }
        setLogs((prev) => prev.map((l) => l.idx === i ? { ...l, status: skipped ? "skipped" : "error", message: msg } : l));
      }
    }

    setRunning(false);
    toast.success("Bulk seed complete");
  };

  const downloadResults = () => {
    const okRows = logs.filter((l) => l.status === "ok").map((l) => {
      const e = parseSeedText(text)[l.idx];
      return { Name: e?.full_name || "", Email: l.email, "Temp Password": l.password || DEFAULT_PWD };
    });
    downloadCsv(okRows, `hstack-credentials-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Bulk seed employees</DialogTitle>
          <DialogDescription>Paste one row per line: <code>Full Name, email@altree.in, role_key, Department, manager_email, secondary_manager_email</code>. The secondary manager email is optional. Default password: <code>{DEFAULT_PWD}</code>.</DialogDescription>
        </DialogHeader>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="paste">Paste list</TabsTrigger>
            <TabsTrigger value="progress" disabled={!logs.length}>Progress</TabsTrigger>
          </TabsList>
          <TabsContent value="paste" className="space-y-3">
            <Textarea value={text} onChange={(e) => setText(e.target.value)} className="font-mono text-xs min-h-[280px]" />
            <p className="text-xs text-muted-foreground">Parsed rows: <b>{parseSeedText(text).length}</b></p>
          </TabsContent>
          <TabsContent value="progress" className="space-y-3">
            <div className="border rounded-lg overflow-hidden max-h-[360px] overflow-y-auto bg-[#F7F7F7]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead><TableHead>Email</TableHead><TableHead>Status</TableHead><TableHead>Detail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((l) => (
                    <TableRow key={l.idx}>
                      <TableCell>{l.idx + 1}</TableCell>
                      <TableCell className="text-xs">{l.email}</TableCell>
                      <TableCell>
                        {l.status === "queued" && <Badge variant="secondary">Queued</Badge>}
                        {l.status === "ok" && <Badge style={{ background: "#E8F2ED", color: "#006039" }}>Created</Badge>}
                        {l.status === "skipped" && <Badge style={{ background: "#FFF4E0", color: "#D4860A" }}>Skipped</Badge>}
                        {l.status === "error" && <Badge style={{ background: "#FDE7E9", color: "#F40009" }}>Error</Badge>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{l.message || (l.password ? `pwd: ${l.password}` : "")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>OK: {logs.filter((l) => l.status === "ok").length} · Skipped: {logs.filter((l) => l.status === "skipped").length} · Errors: {logs.filter((l) => l.status === "error").length}</span>
              <Button size="sm" variant="outline" onClick={downloadResults} disabled={!logs.some((l) => l.status === "ok")}><Download className="h-4 w-4 mr-1" /> Credentials CSV</Button>
            </div>
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={running}>Close</Button>
          <Button onClick={run} disabled={running}>{running ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Seeding…</> : "Start seed"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ───────────────────── Remove All (Danger) ───────────────────── */

function RemoveAllButton({ onCleared }: { onCleared: () => void }) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [summary, setSummary] = useState<{ deleted: number; failed: number; skipped: number } | null>(null);

  const append = (line: string) => setLog((l) => [...l, line]);

  const run = async () => {
    setRunning(true);
    setLog([]);
    setSummary(null);
    let deleted = 0, failed = 0, skipped = 0;

    try {
      const res = await logBulkDeleteAllEmployees();
      deleted = Number(res.deleted ?? 0);
      failed = Number(res.failed ?? 0);
      skipped = Number(res.skipped ?? 0);
      for (const item of res.skipped_items || []) {
        append(`⏭ Skipped ${item.email || item.display_name || item.user_id} (current user)`);
      }
      for (const item of res.deleted_items || []) {
        append(`✅ Deleted ${item.email || item.display_name || item.user_id}`);
      }
      for (const item of res.failures || []) {
        append(`❌ Failed: ${item.email || item.user_id} — ${item.error}`);
      }
    } catch (e) {
      append(`❌ Failed: ${(e as Error).message}`);
      failed++;
    }

    setSummary({ deleted, failed, skipped });
    setRunning(false);
    onCleared();
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={() => { setOpen(true); setConfirmText(""); setLog([]); setSummary(null); }}
        style={{ borderColor: "#F40009", color: "#F40009" }}
      >
        <Trash2 className="h-4 w-4 mr-2" /> Remove All
      </Button>

      <Dialog open={open} onOpenChange={(o) => { if (!running) setOpen(o); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle style={{ color: "#F40009" }}>Delete All Employees</DialogTitle>
            <DialogDescription>
              This will permanently delete all employee accounts from both Supabase Auth and the profiles table. This cannot be undone. Type <strong>CONFIRM</strong> to proceed.
            </DialogDescription>
          </DialogHeader>

          {!summary && !running && (
            <div className="space-y-2">
              <Label>Type CONFIRM to enable delete</Label>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="CONFIRM"
                autoFocus
              />
            </div>
          )}

          {(log.length > 0 || running) && (
            <div className="bg-black text-green-300 font-mono text-xs rounded p-3 max-h-72 overflow-auto">
              {log.map((l, i) => <div key={i}>{l}</div>)}
              {running && <div className="opacity-70">Working…</div>}
            </div>
          )}

          {summary && (
            <div className="rounded p-3 border" style={{ background: "#E8F2ED", borderColor: "#006039" }}>
              <div className="font-semibold" style={{ color: "#006039" }}>
                {summary.deleted} accounts deleted successfully, {summary.failed} failed
                {summary.skipped > 0 && `, ${summary.skipped} skipped`}
              </div>
            </div>
          )}

          <DialogFooter>
            {!summary ? (
              <>
                <Button variant="ghost" onClick={() => setOpen(false)} disabled={running}>Cancel</Button>
                <Button
                  variant="destructive"
                  disabled={running || confirmText !== "CONFIRM"}
                  onClick={run}
                >
                  {running ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Deleting…</> : "Delete"}
                </Button>
              </>
            ) : (
              <Button onClick={() => setOpen(false)}>Close</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

