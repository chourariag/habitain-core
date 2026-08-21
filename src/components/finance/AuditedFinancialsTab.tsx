import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ShieldAlert, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useUserRole } from "@/hooks/useUserRole";

interface AuditedLine {
  id: string;
  fy_label: string;
  statement: string;
  section: string;
  line_label: string;
  note_no: string | null;
  amount_current: number | null;
  amount_previous: number | null;
  sort_order: number;
  is_total: boolean;
  source_file: string | null;
  auditor_firm: string | null;
  signed_date: string | null;
  is_confirmed: boolean;
  confirmed_at: string | null;
  confirmation_note: string | null;
}

const CONFIRM_ROLES = ["finance_director", "managing_director", "super_admin"];

/** Amounts are stored exactly as the auditors presented them — ₹ Lakhs. */
const fmtLakhs = (v: number | null) =>
  v === null || v === undefined ? "—" : v < 0 ? `(${Math.abs(v).toFixed(2)})` : v.toFixed(2);

export function AuditedFinancialsTab() {
  const { role } = useUserRole();
  const [lines, setLines] = useState<AuditedLine[]>([]);
  const [fy, setFy] = useState("FY 2025-26");
  const [fyOptions, setFyOptions] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [signedDate, setSignedDate] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const canConfirm = CONFIRM_ROLES.includes(role ?? "");

  const fetchData = useCallback(async () => {
    const { data } = await supabase
      .from("finance_audited_financials")
      .select("*")
      .eq("is_archived", false)
      .order("sort_order");
    const rows = (data || []) as unknown as AuditedLine[];
    setLines(rows);
    setFyOptions(Array.from(new Set(rows.map((r) => r.fy_label))));
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fyLines = lines.filter((l) => l.fy_label === fy);
  const meta = fyLines[0];
  const confirmed = !!meta?.is_confirmed;

  const submitConfirm = async () => {
    if (!note.trim()) {
      toast.error("A confirmation note is required");
      return;
    }
    setSaving(true);
    const { data: userRes } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("finance_audited_financials")
      .update({
        is_confirmed: true,
        confirmed_by: userRes.user?.id ?? null,
        confirmed_at: new Date().toISOString(),
        confirmation_note: note.trim(),
        signed_date: signedDate || null,
        updated_by: userRes.user?.id ?? null,
      } as any)
      .eq("fy_label", fy);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Audited financials confirmed");
    setConfirmOpen(false);
    setNote("");
    fetchData();
  };

  const renderStatement = (statement: string, title: string, amountHeaders: [string, string]) => {
    const rows = fyLines.filter((l) => l.statement === statement);
    if (rows.length === 0) return null;
    let lastSection = "";
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-display" style={{ color: "#006039" }}>
            {title}
          </CardTitle>
          <p className="text-xs" style={{ color: "#666" }}>
            All amounts in ₹ Lakhs, exactly as presented by the auditors.
          </p>
        </CardHeader>
        <CardContent className="pt-0 overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="border-b" style={{ color: "#666" }}>
                <th className="text-left py-2 text-xs font-display">Particulars</th>
                <th className="text-center py-2 text-xs font-display w-16">Note</th>
                <th className="text-right py-2 text-xs font-display w-32">{amountHeaders[0]}</th>
                <th className="text-right py-2 text-xs font-display w-32">{amountHeaders[1]}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => {
                const showSection = l.section !== lastSection;
                lastSection = l.section;
                return (
                  <>
                    {showSection && (
                      <tr key={`${l.id}-sec`}>
                        <td
                          colSpan={4}
                          className="text-xs font-semibold uppercase tracking-wider pt-3 pb-1"
                          style={{ color: "#006039" }}
                        >
                          {l.section}
                        </td>
                      </tr>
                    )}
                    <tr key={l.id} className="border-b" style={{ borderColor: "#EEE" }}>
                      <td
                        className="py-1.5 text-xs"
                        style={{ fontWeight: l.is_total ? 600 : 400, color: "#1A1A1A" }}
                      >
                        {l.line_label}
                      </td>
                      <td className="py-1.5 text-xs text-center" style={{ color: "#666" }}>
                        {l.note_no || "—"}
                      </td>
                      <td
                        className="py-1.5 text-xs text-right font-mono"
                        style={{
                          fontWeight: l.is_total ? 600 : 400,
                          color: (l.amount_current ?? 0) < 0 ? "#F40009" : "#1A1A1A",
                        }}
                      >
                        {fmtLakhs(l.amount_current)}
                      </td>
                      <td
                        className="py-1.5 text-xs text-right font-mono"
                        style={{
                          fontWeight: l.is_total ? 600 : 400,
                          color: (l.amount_previous ?? 0) < 0 ? "#F40009" : "#666",
                        }}
                      >
                        {fmtLakhs(l.amount_previous)}
                      </td>
                    </tr>
                  </>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4 mt-2">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <div>
          <p className="text-sm font-display" style={{ color: "#1A1A1A" }}>
            Audited Financials — {fy}
          </p>
          <p className="text-xs" style={{ color: "#666" }}>
            {meta?.auditor_firm || "—"} · Source: {meta?.source_file || "—"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {fyOptions.length > 1 && (
            <select
              className="text-xs border rounded px-2 py-1"
              value={fy}
              onChange={(e) => setFy(e.target.value)}
            >
              {fyOptions.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          )}
          {canConfirm && !confirmed && fyLines.length > 0 && (
            <Button size="sm" onClick={() => setConfirmOpen(true)} style={{ backgroundColor: "#006039" }}>
              Confirm as Final
            </Button>
          )}
        </div>
      </div>

      {fyLines.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm" style={{ color: "#666" }}>
            No audited financials imported for {fy}.
          </CardContent>
        </Card>
      ) : (
        <>
          {!confirmed ? (
            <Card style={{ borderColor: "#D4860A", backgroundColor: "#FFF8E8" }}>
              <CardContent className="py-3 flex gap-2 items-start">
                <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "#D4860A" }} />
                <div className="text-xs" style={{ color: "#1A1A1A" }}>
                  <span className="font-semibold">Draft — not confirmed.</span> These figures are imported
                  from the draft audit file and have not been signed off inside HStack.
                  {!meta?.signed_date && (
                    <>
                      {" "}
                      The auditor signing date is blank: the source file states 19/09/2025, which precedes
                      the 31/03/2026 year-end. Confirm the correct date before treating these as final.
                    </>
                  )}
                  <div className="mt-1" style={{ color: "#666" }}>
                    Not used anywhere else in HStack — this does not feed the MIS, the P&amp;L tab or any
                    dashboard figure.
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card style={{ borderColor: "#006039", backgroundColor: "#E8F2ED" }}>
              <CardContent className="py-3 flex gap-2 items-start">
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "#006039" }} />
                <div className="text-xs" style={{ color: "#1A1A1A" }}>
                  <span className="font-semibold">Confirmed as final</span>
                  {meta?.confirmed_at && ` on ${format(new Date(meta.confirmed_at), "dd/MM/yyyy")}`}
                  {meta?.signed_date && ` · Auditor signed ${format(new Date(meta.signed_date), "dd/MM/yyyy")}`}
                  {meta?.confirmation_note && (
                    <div className="mt-1" style={{ color: "#666" }}>
                      {meta.confirmation_note}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {renderStatement("pl", "Statement of Profit and Loss", [
            "Year ended 31/03/2026",
            "Year ended 31/03/2025",
          ])}
          {renderStatement("bs", "Balance Sheet", ["As at 31/03/2026", "As at 31/03/2025"])}
        </>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Confirm {fy} Audited Financials</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Badge
              variant="outline"
              className="text-[10px]"
              style={{ backgroundColor: "#FFF8E8", color: "#D4860A", border: "none" }}
            >
              Confirms all {fyLines.length} lines for {fy}
            </Badge>
            <div>
              <Label className="text-xs">Auditor signing date</Label>
              <Input
                type="date"
                value={signedDate}
                onChange={(e) => setSignedDate(e.target.value)}
                className="mt-1"
              />
              <p className="text-[10px] mt-1" style={{ color: "#666" }}>
                The source file states 19/09/2025, which precedes the 31/03/2026 year-end. Enter the
                correct date or leave blank.
              </p>
            </div>
            <div>
              <Label className="text-xs">Confirmation note (required)</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="mt-1"
                rows={3}
                placeholder="Who confirmed these figures as final, and against what document"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={submitConfirm} disabled={saving} style={{ backgroundColor: "#006039" }}>
              {saving ? "Saving..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
