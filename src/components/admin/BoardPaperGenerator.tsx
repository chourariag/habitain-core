import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "lucide-react";
import { toast } from "sonner";
import { BoardPaperDraft } from "./BoardPaperDraft";
import { format } from "date-fns";

export function BoardPaperGenerator() {
  const [reportDate, setReportDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [periodType, setPeriodType] = useState("monthly");
  const [draftData, setDraftData] = useState<any>(null);
  const [generating, setGenerating] = useState(false);
  const queryClient = useQueryClient();

  const { data: savedPapers, isLoading } = useQuery({
    queryKey: ["board-papers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("board_papers")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const generateData = async () => {
    setGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const resp = await fetch(
        `https://${projectId}.supabase.co/functions/v1/board-paper-data`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ reportDate, periodType }),
        }
      );
      if (!resp.ok) throw new Error("Failed to fetch data");
      const result = await resp.json();

      // Add user info to executive summary
      const profile = await supabase
        .from("profiles")
        .select("display_name")
        .eq("auth_user_id", session.user.id)
        .single();

      result.sections.executive_summary.prepared_by = profile.data?.display_name || session.user.email;

      setDraftData({
        sections: result.sections,
        reportDate,
        periodType,
      });
      toast.success("Board paper data compiled successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate board paper data");
    } finally {
      setGenerating(false);
    }
  };

  const saveDraft = useMutation({
    mutationFn: async (sections: any) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const profile = await supabase
        .from("profiles")
        .select("display_name")
        .eq("auth_user_id", session.user.id)
        .single();

      const { error } = await supabase.from("board_papers").insert({
        report_date: reportDate,
        period_type: periodType,
        generated_by: session.user.id,
        generated_by_name: profile.data?.display_name || session.user.email,
        status: "draft",
        sections_data: sections,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Draft saved");
      queryClient.invalidateQueries({ queryKey: ["board-papers"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  if (draftData) {
    return (
      <BoardPaperDraft
        data={draftData}
        onBack={() => setDraftData(null)}
        onSaveDraft={(sections) => saveDraft.mutate(sections)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Calendar className="h-5 w-5 text-[hsl(var(--brand))]" />
            Generate Board Paper
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">Report Date</label>
              <input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className="w-full rounded-md border border-input bg-background text-foreground px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">Period</label>
              <Select value={periodType} onValueChange={setPeriodType}>
                <SelectTrigger className="bg-background border-input text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                onClick={generateData}
                disabled={generating}
                className="w-full bg-[hsl(var(--brand))] text-white hover:bg-[hsl(var(--brand))]/90"
              >
                {generating ? "Compiling Data…" : "Generate Board Paper"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Previous reports */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground text-lg">Previous Reports</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : !savedPapers?.length ? (
            <p className="text-muted-foreground text-sm">No board papers generated yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {savedPapers.map((paper) => (
                <div key={paper.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {paper.period_type === "quarterly" ? "Quarterly" : "Monthly"} Report — {paper.report_date}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      By {paper.generated_by_name} · {paper.status === "finalized" ? "Finalized" : "Draft"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {paper.pdf_url && (
                      <Button size="sm" variant="outline" asChild>
                        <a href={paper.pdf_url} target="_blank" rel="noopener noreferrer">Download PDF</a>
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDraftData({
                        sections: paper.sections_data,
                        reportDate: paper.report_date,
                        periodType: paper.period_type,
                        id: paper.id,
                      })}
                    >
                      View
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
