import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UsersRound, Download, Loader2, Check, AlertTriangle, X } from "lucide-react";
import { HSTACK_USERS } from "@/lib/hstack-users";
import { ROLE_LABELS, type AppRole } from "@/lib/roles";
import { createUserWithPassword } from "@/lib/admin-api";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/super-admin";
import { toast } from "sonner";
import jsPDF from "jspdf";

const DEFAULT_PASSWORD = "HStack@2026";

function slugEmail(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "") + "@altree.in";
}

type Row = {
  name: string;
  role: AppRole;
  group: string;
  email: string;
  password: string;
  selected: boolean;
  status: "pending" | "creating" | "created" | "skipped" | "error";
  message?: string;
};

interface Props {
  onDone: () => void;
}

export function BulkCreateAccountsDialog({ onDone }: Props) {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [done, setDone] = useState(false);

  async function init() {
    // Load existing emails to pre-mark "skipped"
    const { data: existing } = await (supabase.rpc as any)("get_active_profiles_directory");
    const existingEmails = new Set((existing || []).map((p: any) => (p.email || "").toLowerCase()).filter(Boolean));
    setRows(
      HSTACK_USERS.map((u) => {
        const email = slugEmail(u.name);
        const exists = existingEmails.has(email.toLowerCase());
        return {
          name: u.name,
          role: u.role,
          group: u.group,
          email,
          password: DEFAULT_PASSWORD,
          selected: !exists,
          status: exists ? "skipped" : "pending",
          message: exists ? "Already exists" : undefined,
        };
      })
    );
    setDone(false);
  }

  function update(i: number, patch: Partial<Row>) {
    setRows((r) => r.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }

  async function runCreate() {
    setRunning(true);
    setDone(false);
    const targets = rows.map((r, i) => ({ r, i })).filter(({ r }) => r.selected && r.status !== "created");
    let created = 0, skipped = 0, errors = 0;

    for (const { r, i } of targets) {
      update(i, { status: "creating", message: "Creating…" });
      // Re-check duplicate
      const { data: dup } = await supabase.from("profiles").select("id").eq("email", r.email.toLowerCase()).maybeSingle();
      if (dup) {
        update(i, { status: "skipped", message: "Already exists" });
        skipped++;
        continue;
      }
      try {
        await createUserWithPassword({
          email: r.email,
          role: r.role,
          password: r.password,
          display_name: r.name,
        });
        update(i, { status: "created", message: "Created" });
        created++;
      } catch (e) {
        update(i, { status: "error", message: (e as Error).message || "Error" });
        errors++;
      }
    }

    await logAudit({
      section: "Users",
      action: "bulk_create_team",
      new_value: { created, skipped, errors, total: targets.length },
    });

    setRunning(false);
    setDone(true);
    toast.success(`${created} created · ${skipped} skipped · ${errors} errors`);
    onDone();
  }

  function downloadPdf() {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("HStack — Team Account Credentials", 14, 18);
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(`Generated ${new Date().toLocaleString("en-GB")} · share securely`, 14, 24);
    doc.setTextColor(0);

    let y = 34;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Name", 14, y);
    doc.text("Role", 70, y);
    doc.text("Email", 120, y);
    doc.text("Password", 170, y);
    doc.setFont("helvetica", "normal");
    y += 4;
    doc.line(14, y, 196, y);
    y += 5;

    rows.filter((r) => r.status === "created").forEach((r) => {
      if (y > 280) { doc.addPage(); y = 20; }
      doc.text(r.name.slice(0, 28), 14, y);
      doc.text((ROLE_LABELS[r.role] || r.role).slice(0, 26), 70, y);
      doc.text(r.email.slice(0, 28), 120, y);
      doc.text(r.password, 170, y);
      y += 6;
    });

    doc.save(`hstack-team-credentials-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  const summary = useMemo(() => {
    const created = rows.filter((r) => r.status === "created").length;
    const skipped = rows.filter((r) => r.status === "skipped").length;
    const errors = rows.filter((r) => r.status === "error").length;
    return { created, skipped, errors };
  }, [rows]);

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) init(); }}>
      <Button variant="default" onClick={() => { setOpen(true); init(); }}>
        <UsersRound className="h-4 w-4 mr-1" /> Create All User Accounts
      </Button>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Create All User Accounts ({HSTACK_USERS.length} HStack users)</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto border rounded-md">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow>
                <TableHead className="w-10">✓</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Password</TableHead>
                <TableHead className="w-44">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={`${r.name}-${i}`}>
                  <TableCell>
                    <Checkbox
                      checked={r.selected}
                      disabled={running || r.status === "created"}
                      onCheckedChange={(v) => update(i, { selected: !!v })}
                    />
                  </TableCell>
                  <TableCell className="text-xs">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-muted-foreground text-[10px]">{r.group}</div>
                  </TableCell>
                  <TableCell className="text-xs">{ROLE_LABELS[r.role] || r.role}</TableCell>
                  <TableCell>
                    <Input
                      className="h-8 text-xs"
                      value={r.email}
                      disabled={running || r.status === "created"}
                      onChange={(e) => update(i, { email: e.target.value })}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      className="h-8 text-xs font-mono"
                      value={r.password}
                      disabled={running || r.status === "created"}
                      onChange={(e) => update(i, { password: e.target.value })}
                    />
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.status === "creating" && <span className="inline-flex items-center gap-1 text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Creating…</span>}
                    {r.status === "created" && <span className="inline-flex items-center gap-1 text-[#006039]"><Check className="h-3 w-3" /> Created</span>}
                    {r.status === "skipped" && <span className="inline-flex items-center gap-1 text-[#D4860A]"><AlertTriangle className="h-3 w-3" /> {r.message}</span>}
                    {r.status === "error" && <span className="inline-flex items-center gap-1 text-[#F40009]" title={r.message}><X className="h-3 w-3" /> {r.message?.slice(0, 28)}</span>}
                    {r.status === "pending" && <span className="text-muted-foreground">Ready</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {done && (
          <div className="text-sm bg-muted rounded-md px-3 py-2">
            <strong>{summary.created}</strong> accounts created ·{" "}
            <strong>{summary.skipped}</strong> skipped (already exist) ·{" "}
            <strong>{summary.errors}</strong> errors
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={running}>Close</Button>
          {summary.created > 0 && (
            <Button variant="outline" onClick={downloadPdf}>
              <Download className="h-4 w-4 mr-1" /> Download Credentials PDF
            </Button>
          )}
          <Button onClick={runCreate} disabled={running || rows.filter((r) => r.selected && r.status !== "created").length === 0}>
            {running ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Creating…</> : `Create Selected Accounts (${rows.filter((r) => r.selected && r.status !== "created").length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
