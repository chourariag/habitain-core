import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Lock, RotateCcw, Search, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  PAGE_GROUPS, PERMISSION_ROLES, PERMISSION_LEVELS, LOCKED_ROLES,
  defaultPermission, ALL_PAGE_KEYS,
  type PermissionLevel, type PermissionRole,
} from "@/lib/role-permissions-catalog";

type Row = { role_code: string; page_key: string; permission_level: PermissionLevel };
type AuditRow = { id: string; role_code: string; page_key: string; old_value: string | null; new_value: string | null; changed_by: string | null; changed_at: string };

function levelStyle(l: PermissionLevel) {
  return PERMISSION_LEVELS.find(p => p.value === l)!;
}

export function RolePermissionsTab() {
  const { role: currentRole, userId } = useUserRole();
  const isMD = currentRole === "managing_director" || currentRole === "super_admin";

  const [rows, setRows] = useState<Row[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [search, setSearch] = useState("");
  const [visibleRoles, setVisibleRoles] = useState<string[]>([...PERMISSION_ROLES]);
  const [showAudit, setShowAudit] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    const [{ data: r }, { data: a }] = await Promise.all([
      supabase.from("role_permissions" as never).select("role_code, page_key, permission_level"),
      supabase.from("role_permissions_audit" as never).select("*").order("changed_at", { ascending: false }).limit(100),
    ]);
    setRows((r as unknown as Row[]) || []);
    setAudit((a as unknown as AuditRow[]) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const matrix = useMemo(() => {
    const m = new Map<string, PermissionLevel>();
    rows.forEach(r => m.set(`${r.role_code}|${r.page_key}`, r.permission_level));
    return m;
  }, [rows]);

  function getLevel(role: PermissionRole, pageKey: string): PermissionLevel {
    if (LOCKED_ROLES.includes(role)) return "full";
    return matrix.get(`${role}|${pageKey}`) ?? defaultPermission(role, pageKey);
  }

  async function setCell(role: PermissionRole, pageKey: string, next: PermissionLevel, pageLabel: string) {
    if (!isMD) { toast.error("Only MD / Super Admin can edit permissions"); return; }
    if (LOCKED_ROLES.includes(role)) return;
    const prev = getLevel(role, pageKey);
    if (prev === next) return;

    // optimistic
    setRows(rs => {
      const idx = rs.findIndex(r => r.role_code === role && r.page_key === pageKey);
      if (idx >= 0) { const copy = rs.slice(); copy[idx] = { ...copy[idx], permission_level: next }; return copy; }
      return [...rs, { role_code: role, page_key: pageKey, permission_level: next }];
    });

    const { error } = await supabase.from("role_permissions" as never).upsert(
      { role_code: role, page_key: pageKey, permission_level: next, updated_by: userId, updated_at: new Date().toISOString() } as never,
      { onConflict: "role_code,page_key" } as never,
    );
    if (error) { toast.error(error.message); load(); return; }
    toast.success(`Permission updated: ${role} — ${pageLabel} → ${next}`);
    // refresh audit only
    const { data: a } = await supabase.from("role_permissions_audit" as never).select("*").order("changed_at", { ascending: false }).limit(100);
    setAudit((a as unknown as AuditRow[]) || []);
  }

  async function resetToDefaults() {
    if (!isMD) return;
    const payload: Row[] = [];
    for (const role of PERMISSION_ROLES) {
      if (LOCKED_ROLES.includes(role)) continue;
      for (const key of ALL_PAGE_KEYS) {
        payload.push({ role_code: role, page_key: key, permission_level: defaultPermission(role, key) });
      }
    }
    // chunk to avoid huge payloads
    const chunk = 500;
    for (let i = 0; i < payload.length; i += chunk) {
      const slice = payload.slice(i, i + chunk).map(p => ({ ...p, updated_by: userId }));
      const { error } = await supabase.from("role_permissions" as never).upsert(slice as never, { onConflict: "role_code,page_key" } as never);
      if (error) { toast.error(error.message); return; }
    }
    toast.success("All permissions reset to defaults");
    setResetOpen(false);
    load();
  }

  function exportXlsx() {
    const data: Record<string, unknown>[] = [];
    PAGE_GROUPS.forEach(g => {
      g.pages.forEach(p => {
        const row: Record<string, unknown> = { Section: g.section, Page: p.label, "Page Key": p.key };
        PERMISSION_ROLES.forEach(r => { row[r] = getLevel(r as PermissionRole, p.key); });
        data.push(row);
      });
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Role Permissions");
    XLSX.writeFile(wb, "Role_Permissions_Matrix.xlsx");
  }

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return PAGE_GROUPS;
    return PAGE_GROUPS
      .map(g => ({ ...g, pages: g.pages.filter(p => p.label.toLowerCase().includes(q) || p.key.toLowerCase().includes(q)) }))
      .filter(g => g.pages.length > 0);
  }, [search]);

  const shownRoles = PERMISSION_ROLES.filter(r => visibleRoles.includes(r));

  if (loading) return <div className="text-sm text-muted-foreground p-4">Loading permissions…</div>;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter pages…" className="pl-7 h-9 w-64" />
        </div>
        <details className="relative">
          <summary className="list-none cursor-pointer">
            <Button variant="outline" size="sm" type="button" asChild><span>Role columns ({shownRoles.length}/{PERMISSION_ROLES.length})</span></Button>
          </summary>
          <div className="absolute z-20 mt-1 bg-popover border rounded-md p-3 shadow-md max-h-80 overflow-y-auto w-64">
            <div className="flex justify-between mb-2 text-xs">
              <button className="text-primary" onClick={() => setVisibleRoles([...PERMISSION_ROLES])}>Select all</button>
              <button className="text-muted-foreground" onClick={() => setVisibleRoles([])}>Clear</button>
            </div>
            {PERMISSION_ROLES.map(r => (
              <label key={r} className="flex items-center gap-2 text-xs py-1">
                <input type="checkbox" checked={visibleRoles.includes(r)} onChange={(e) => {
                  setVisibleRoles(v => e.target.checked ? [...v, r] : v.filter(x => x !== r));
                }} />
                <span className="truncate">{r}</span>
              </label>
            ))}
          </div>
        </details>
        <div className="flex-1" />
        {isMD && (
          <Button variant="outline" size="sm" onClick={() => setResetOpen(true)}>
            <RotateCcw className="h-3.5 w-3.5" /> Reset to Defaults
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={exportXlsx}>
          <Download className="h-3.5 w-3.5" /> Export Matrix
        </Button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 text-xs">
        {PERMISSION_LEVELS.map(l => (
          <span key={l.value} className={`inline-flex items-center gap-1 px-2 py-1 rounded ${l.bg} ${l.text}`}>
            <span>{l.icon}</span><span>{l.label}</span>
          </span>
        ))}
      </div>

      {/* Matrix */}
      <div className="bg-card rounded-lg border overflow-auto max-h-[70vh]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 top-0 z-20 bg-card min-w-[260px]">Page</TableHead>
              {shownRoles.map(r => (
                <TableHead key={r} className="text-[10px] whitespace-nowrap sticky top-0 bg-card">
                  <div className="flex items-center gap-1">
                    {LOCKED_ROLES.includes(r as PermissionRole) && <Lock className="h-3 w-3 text-muted-foreground" />}
                    {r}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredGroups.map(g => (
              <>
                <TableRow key={`g-${g.section}`} className="bg-muted/40">
                  <TableCell colSpan={shownRoles.length + 1} className="font-display font-bold text-xs uppercase tracking-wide py-2">
                    {g.section}
                  </TableCell>
                </TableRow>
                {g.pages.map(p => (
                  <TableRow key={p.key}>
                    <TableCell className="sticky left-0 bg-card text-xs font-medium">{p.label}</TableCell>
                    {shownRoles.map(r => {
                      const level = getLevel(r as PermissionRole, p.key);
                      const st = levelStyle(level);
                      const locked = LOCKED_ROLES.includes(r as PermissionRole) || !isMD;
                      return (
                        <TableCell key={r} className={`p-0 ${st.bg}`}>
                          <select
                            disabled={locked}
                            value={level}
                            onChange={(e) => setCell(r as PermissionRole, p.key, e.target.value as PermissionLevel, p.label)}
                            className={`w-full h-9 px-2 bg-transparent text-xs ${st.text} ${locked ? "cursor-not-allowed opacity-80" : "cursor-pointer"} border-0 outline-none`}
                            title={locked && LOCKED_ROLES.includes(r as PermissionRole) ? "Always Full — cannot be changed" : ""}
                          >
                            {PERMISSION_LEVELS.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.icon} {opt.label}</option>
                            ))}
                          </select>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Audit log */}
      <div className="bg-card rounded-lg border">
        <button className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium" onClick={() => setShowAudit(s => !s)}>
          {showAudit ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          Audit Log ({audit.length})
        </button>
        {showAudit && (
          <div className="border-t overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="text-xs">When</TableHead>
                <TableHead className="text-xs">Role</TableHead>
                <TableHead className="text-xs">Page Key</TableHead>
                <TableHead className="text-xs">Old</TableHead>
                <TableHead className="text-xs">New</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {audit.map(a => (
                  <TableRow key={a.id}>
                    <TableCell className="text-xs">{new Date(a.changed_at).toLocaleString("en-IN")}</TableCell>
                    <TableCell className="text-xs">{a.role_code}</TableCell>
                    <TableCell className="text-xs font-mono">{a.page_key}</TableCell>
                    <TableCell className="text-xs">{a.old_value ?? "—"}</TableCell>
                    <TableCell className="text-xs">{a.new_value ?? "—"}</TableCell>
                  </TableRow>
                ))}
                {audit.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-6">No changes yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reset ALL permissions to default?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will overwrite every cell with the system default. This cannot be undone (though every change is audited).
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>Cancel</Button>
            <Button onClick={resetToDefaults} style={{ background: "#F40009", color: "#fff" }}>Reset</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
