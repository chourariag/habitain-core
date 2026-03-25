import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { X, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getScoreColor, getWeekRange } from "@/lib/kpi-helpers";

export function WeeklyDigestCard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [digest, setDigest] = useState<any>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    fetchDigest();
  }, [user]);

  const fetchDigest = async () => {
    const week = getWeekRange();
    const weekStr = week.start.toISOString().split("T")[0];
    const { data } = await supabase
      .from("weekly_digests")
      .select("*")
      .eq("user_id", user!.id)
      .eq("week_start_date", weekStr)
      .maybeSingle();
    setDigest(data);
    setLoading(false);
  };

  if (loading || !digest || dismissed) return null;

  const wins = (digest.wins || []) as { kpi_key: string; actual: number }[];
  const focus = (digest.focus_areas || []) as { kpi_key: string; actual: number; target: number; coaching_note: string }[];
  const week = getWeekRange();
  const firstName = user?.email?.split("@")[0]?.split(".")[0] || "there";
  const capitalizedName = firstName.charAt(0).toUpperCase() + firstName.slice(1);

  return (
    <div className="rounded-lg border border-border p-4 relative" style={{ backgroundColor: "#F7F7F7" }}>
      <button onClick={() => setDismissed(true)} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground">
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start justify-between pr-6">
        <div>
          <h3 className="font-display font-semibold text-foreground text-sm">Your Week — {week.label}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Hi {capitalizedName}, here's your weekly summary:</p>
        </div>
        <div className="text-right">
          <span className="text-lg font-bold font-display" style={{ color: getScoreColor(digest.overall_score) }}>
            {digest.overall_score}/100
          </span>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {wins.length > 0 && (
          <div>
            <p className="text-xs font-semibold" style={{ color: "#006039" }}>✓ What went well</p>
            {wins.slice(0, 2).map((w, i) => (
              <p key={i} className="text-xs text-muted-foreground ml-3">{w.kpi_key}: {w.actual} ✓</p>
            ))}
          </div>
        )}
        {focus.length > 0 && (
          <div>
            <p className="text-xs font-semibold" style={{ color: "#D4860A" }}>→ Focus this week</p>
            {focus.slice(0, 2).map((f, i) => (
              <div key={i} className="ml-3">
                <p className="text-xs text-muted-foreground">{f.kpi_key}: {f.actual} vs {f.target}</p>
                <p className="text-xs italic" style={{ color: "#666" }}>{f.coaching_note}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={() => navigate("/kpi")}
        className="mt-3 flex items-center gap-1 text-xs font-medium transition-colors"
        style={{ color: "#006039" }}
      >
        View full scorecard <ArrowRight className="h-3 w-3" />
      </button>
    </div>
  );
}
