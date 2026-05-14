import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, FileText } from "lucide-react";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function MyPayslipsTab() {
  const { user } = useAuth();
  const [slips, setSlips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("payslips")
        .select("*")
        .eq("user_id", user.id)
        .is("superseded_at", null)
        .order("year", { ascending: false })
        .order("month", { ascending: false });
      setSlips(data ?? []);
      setLoading(false);
    })();
  }, [user]);

  const download = async (path: string) => {
    const { data } = await supabase.storage.from("hr-docs").createSignedUrl(path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="rounded-lg border border-border overflow-x-auto bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ backgroundColor: "#F7F7F7" }}>
            {["Month", "Gross ₹", "Deductions ₹", "Net Pay ₹", "Revision", "Action"].map(h => (
              <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "#666" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {slips.length === 0 ? (
            <tr><td colSpan={6} className="px-3 py-12 text-center text-sm" style={{ color: "#999" }}>
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
              No payslips yet. Mary generates them monthly.
            </td></tr>
          ) : slips.map((s: any) => {
            const revised = Number(s.revision ?? 1) > 1;
            return (
              <tr key={s.id} className="border-t border-border">
                <td className="px-3 py-2 font-medium">{MONTHS[s.month - 1]} {s.year}</td>
                <td className="px-3 py-2 font-mono">₹{Number(s.gross_amount).toLocaleString("en-IN")}</td>
                <td className="px-3 py-2 font-mono" style={{ color: "#F40009" }}>₹{Number(s.deductions).toLocaleString("en-IN")}</td>
                <td className="px-3 py-2 font-mono font-bold" style={{ color: "#006039" }}>₹{Number(s.net_pay).toLocaleString("en-IN")}</td>
                <td className="px-3 py-2">
                  {revised ? (
                    <Badge variant="outline" className="text-[10px]" style={{ color: "#D4860A", borderColor: "#D4860A", backgroundColor: "#FFF7E6" }}>
                      Revised v{s.revision}
                    </Badge>
                  ) : <span className="text-[10px]" style={{ color: "#999" }}>Original</span>}
                </td>
                <td className="px-3 py-2">
                  {s.pdf_url ? (
                    <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => download(s.pdf_url)}>
                      <Download className="h-3 w-3" /> PDF
                    </Button>
                  ) : <span className="text-xs" style={{ color: "#999" }}>No file</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

