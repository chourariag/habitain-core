import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, HardDrive, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BucketRow {
  bucket_id: string;
  file_count: number;
  total_bytes: number;
}

// Manually-configured plan limit (bytes). Update when plan changes.
const STORAGE_LIMIT_BYTES = 1024 * 1024 * 1024; // 1 GB — adjust to actual plan

// Baseline for the drawings bucket growth flag (250 MB across 10 files as of 24/07/2026).
const DRAWINGS_BASELINE_BYTES = 250 * 1024 * 1024;
const DRAWINGS_BASELINE_AVG = DRAWINGS_BASELINE_BYTES / 10;
const GROWTH_ALERT_MULTIPLIER = 1.5;

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function StorageUsageCard() {
  const [rows, setRows] = useState<BucketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await (supabase.rpc as any)("get_storage_usage_by_bucket");
    if (error) setError(error.message);
    else setRows((data as BucketRow[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const total = rows.reduce((s, r) => s + Number(r.total_bytes || 0), 0);
  const fileTotal = rows.reduce((s, r) => s + Number(r.file_count || 0), 0);
  const pct = STORAGE_LIMIT_BYTES ? Math.min(100, (total / STORAGE_LIMIT_BYTES) * 100) : 0;

  const drawings = rows.find(r => r.bucket_id === "drawings");
  const drawingsAvg = drawings && drawings.file_count > 0
    ? Number(drawings.total_bytes) / Number(drawings.file_count)
    : 0;
  const drawingsGrowthFlag = drawings
    ? Number(drawings.total_bytes) > DRAWINGS_BASELINE_BYTES * GROWTH_ALERT_MULTIPLIER
      || drawingsAvg > DRAWINGS_BASELINE_AVG * GROWTH_ALERT_MULTIPLIER
    : false;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <HardDrive className="h-4 w-4" /> Storage Usage
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {error ? (
          <div className="text-destructive">{error}</div>
        ) : loading ? (
          <div className="text-muted-foreground">Loading…</div>
        ) : (
          <>
            <div>
              <div className="flex justify-between mb-1">
                <span className="font-medium">Total</span>
                <span>
                  {formatBytes(total)} · {fileTotal} file{fileTotal !== 1 ? "s" : ""}
                  {STORAGE_LIMIT_BYTES ? ` · ${pct.toFixed(1)}% of ${formatBytes(STORAGE_LIMIT_BYTES)}` : ""}
                </span>
              </div>
              <Progress value={pct} />
              <p className="text-xs text-muted-foreground mt-1">
                Plan limit is configured manually in the app (currently {formatBytes(STORAGE_LIMIT_BYTES)}). Update <code>STORAGE_LIMIT_BYTES</code> in <code>StorageUsageCard.tsx</code> when the plan changes.
              </p>
            </div>

            <div className="divide-y divide-border rounded-md border">
              {rows.length === 0 && <div className="p-3 text-muted-foreground">No buckets found.</div>}
              {rows.map(r => {
                const isDrawings = r.bucket_id === "drawings";
                const avg = r.file_count > 0 ? Number(r.total_bytes) / Number(r.file_count) : 0;
                return (
                  <div key={r.bucket_id} className="p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium flex items-center gap-2">
                        {r.bucket_id}
                        {isDrawings && drawingsGrowthFlag && (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" /> Growing fast
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {r.file_count} file{r.file_count !== 1 ? "s" : ""} · avg {formatBytes(avg)}
                      </div>
                    </div>
                    <div className="text-right font-medium">{formatBytes(Number(r.total_bytes))}</div>
                  </div>
                );
              })}
            </div>

            {drawings && drawingsGrowthFlag && (
              <div className="rounded-md bg-amber-50 text-amber-900 p-3 text-xs flex gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  Drawings bucket has grown significantly beyond baseline (250 MB / avg 25 MB per file as of 24/07/2026). Review recent uploads and consider archiving closed projects.
                </span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
