import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, BarChart3, TrendingUp } from "lucide-react";
import { fetchBenchmarkStats, BenchmarkStats } from "@/lib/task-benchmarks";

const BAND_ORDER = ["1-4", "5-8", "9-15", "16+"];

export function BenchmarksView() {
  const [stats, setStats] = useState<BenchmarkStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBenchmarkStats().then((s) => { setStats(s); setLoading(false); });
  }, []);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  // Group by category
  const categories = [...new Set(stats.map((s) => s.task_category))].sort();

  const totalDataPoints = stats.reduce((a, s) => a + s.data_points, 0);
  const sufficientCategories = stats.filter((s) => s.data_points >= 3).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <TrendingUp className="h-5 w-5" style={{ color: "hsl(var(--primary))" }} />
        <h2 className="text-lg font-bold font-display text-foreground">Task Benchmarks</h2>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4 text-center">
          <p className="text-2xl font-bold text-foreground">{totalDataPoints}</p>
          <p className="text-xs text-muted-foreground">Total Data Points</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <p className="text-2xl font-bold text-foreground">{categories.length}</p>
          <p className="text-xs text-muted-foreground">Task Categories</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <p className="text-2xl font-bold text-foreground">{sufficientCategories}</p>
          <p className="text-xs text-muted-foreground">With Benchmarks (≥3)</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <p className="text-2xl font-bold text-foreground">{stats.length - sufficientCategories}</p>
          <p className="text-xs text-muted-foreground">Insufficient Data</p>
        </CardContent></Card>
      </div>

      {categories.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BarChart3 className="h-10 w-10 mx-auto mb-3" style={{ color: "hsl(var(--muted-foreground))" }} />
            <p className="text-sm font-medium text-muted-foreground">No benchmark data yet. Complete tasks across projects to build intelligence.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[180px]">Task Category</TableHead>
                <TableHead>Module Band</TableHead>
                <TableHead className="text-center">Data Points</TableHead>
                <TableHead className="text-center">Avg Duration</TableHead>
                <TableHead className="text-center">Fastest</TableHead>
                <TableHead className="text-center">Slowest</TableHead>
                <TableHead className="text-center">Avg Delay</TableHead>
                <TableHead>Common Delay Cause</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((cat) => {
                const catStats = BAND_ORDER
                  .map((band) => stats.find((s) => s.task_category === cat && s.module_count_band === band))
                  .filter(Boolean) as BenchmarkStats[];

                return catStats.map((s, idx) => (
                  <TableRow key={`${cat}-${s.module_count_band}`}>
                    {idx === 0 && (
                      <TableCell rowSpan={catStats.length} className="font-medium text-foreground align-top">
                        {cat}
                      </TableCell>
                    )}
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{s.module_count_band} modules</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {s.data_points < 3 ? (
                        <span className="text-xs text-muted-foreground italic">Insufficient ({s.data_points})</span>
                      ) : (
                        <span className="font-medium text-foreground">{s.data_points}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center font-medium text-foreground">{s.avg_duration}d</TableCell>
                    <TableCell className="text-center text-muted-foreground">{s.fastest}d</TableCell>
                    <TableCell className="text-center text-muted-foreground">{s.slowest}d</TableCell>
                    <TableCell className="text-center">
                      <span style={{ color: s.avg_delay > 0 ? "#F40009" : "hsl(var(--primary))" }}>
                        {s.avg_delay > 0 ? `+${s.avg_delay}d` : `${s.avg_delay}d`}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{s.most_common_cause ?? "—"}</TableCell>
                  </TableRow>
                ));
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
