import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { compareSnapshots, displayDateTime, type ProfileNameMap, type ScheduleBaseline } from "./schedule-types";

interface Props {
  baselines: ScheduleBaseline[];
  names: ProfileNameMap;
}

export function ScheduleHistory({ baselines, names }: Props) {
  const [compareFrom, setCompareFrom] = useState<string>("");
  const [compareTo, setCompareTo] = useState<string>("");
  const ordered = useMemo(() => [...baselines].sort((a, b) => a.version - b.version), [baselines]);
  const latest = ordered.at(-1);
  const previous = ordered.at(-2);
  const from = ordered.find((baseline) => String(baseline.version) === compareFrom) ?? previous;
  const to = ordered.find((baseline) => String(baseline.version) === compareTo) ?? latest;
  const changes = useMemo(() => from && to ? compareSnapshots(from.snapshot ?? [], to.snapshot ?? []) : [], [from, to]);

  if (!baselines.length) {
    return (
      <Card><CardHeader><CardTitle className="text-base">Baseline history</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">No baseline has been published.</p></CardContent></Card>
    );
  }

  return (
    <Card className="min-w-0">
      <CardHeader><CardTitle className="text-base">Baseline history</CardTitle></CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-3">
          {[...baselines].sort((a, b) => b.version - a.version).map((baseline) => (
            <article key={baseline.id} className="rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={baseline.kind === "baseline" ? "default" : "outline"}>v{baseline.version} · {baseline.kind}</Badge>
                <span className="text-sm font-medium">{names[baseline.published_by] ?? "Staff member"}</span>
                <span className="text-xs text-muted-foreground">{displayDateTime(baseline.published_at)}</span>
              </div>
              <p className="mt-2 break-words text-sm text-muted-foreground">{baseline.reason || (baseline.version === 1 ? "Initial baseline" : "No reason recorded")}</p>
            </article>
          ))}
        </div>
        <div className="space-y-3 border-t border-border pt-4">
          <h3 className="text-sm font-semibold">Changed between versions</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">From
              <Select value={String(from?.version ?? "")} onValueChange={setCompareFrom}>
                <SelectTrigger><SelectValue placeholder="Previous version" /></SelectTrigger>
                <SelectContent>{ordered.map((baseline) => <SelectItem key={baseline.id} value={String(baseline.version)}>v{baseline.version}</SelectItem>)}</SelectContent>
              </Select>
            </label>
            <label className="space-y-1">To
              <Select value={String(to?.version ?? "")} onValueChange={setCompareTo}>
                <SelectTrigger><SelectValue placeholder="Current version" /></SelectTrigger>
                <SelectContent>{ordered.map((baseline) => <SelectItem key={baseline.id} value={String(baseline.version)}>v{baseline.version}</SelectItem>)}</SelectContent>
              </Select>
            </label>
          </div>
          {!from || !to || from.version >= to.version ? (
            <p className="text-sm text-muted-foreground">Choose an earlier version and a later version to compare.</p>
          ) : changes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No task additions, removals, date or duration changes between v{from.version} and v{to.version}.</p>
          ) : (
            <div className="space-y-2">
              {changes.map((change) => (
                <article key={`${change.kind}-${change.taskId}`} className="rounded-md border border-border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{change.kind}</Badge><strong>{change.code}</strong><span>{change.name}</span></div>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">{change.changes.map((item, index) => <li key={index} className="break-words">{item}</li>)}</ul>
                </article>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
