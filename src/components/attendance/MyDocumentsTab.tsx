import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Loader2, Download, FileText } from "lucide-react";
import { format } from "date-fns";

const DOC_LABELS: Record<string, string> = {
  pf_statement: "PF Statement",
  form_16: "Form 16",
  offer_letter: "Offer Letter",
  appointment_letter: "Appointment Letter",
  other: "Other",
};

export function MyDocumentsTab() {
  const { user } = useAuth();
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("hr_documents")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setDocs(data ?? []);
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
            {["Type", "Title", "Issued", "Action"].map(h => (
              <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "#666" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {docs.length === 0 ? (
            <tr><td colSpan={4} className="px-3 py-12 text-center text-sm" style={{ color: "#999" }}>
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
              No documents yet. HR will upload your statutory documents here.
            </td></tr>
          ) : docs.map(d => (
            <tr key={d.id} className="border-t border-border">
              <td className="px-3 py-2 text-xs font-semibold">{DOC_LABELS[d.doc_type] || d.doc_type}</td>
              <td className="px-3 py-2">{d.title}</td>
              <td className="px-3 py-2 font-mono text-xs" style={{ color: "#666" }}>{d.issued_on ? format(new Date(d.issued_on), "dd/MM/yyyy") : "—"}</td>
              <td className="px-3 py-2">
                <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => download(d.pdf_url)}>
                  <Download className="h-3 w-3" /> Download
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
