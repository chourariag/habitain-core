import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { activityDisplayName, compareCodes, isExtrasGroup, unitLabel, type LibraryActivity, type LibraryTask, type ScheduleTask, type ScheduleUnit } from "./schedule-types";

interface Props {
  activities: LibraryActivity[];
  libraryTasks: LibraryTask[];
  projectTasks: ScheduleTask[];
  units: ScheduleUnit[];
  busy: boolean;
  onAdd: (unit: ScheduleUnit, ids: string[]) => Promise<boolean>;
  onRepeat: (source: ScheduleUnit, targets: ScheduleUnit[]) => Promise<boolean>;
}

const key = (unit: ScheduleUnit) => `${unit.unit_kind}|${unit.unit_label}`;

export function ScheduleLibrary({ activities, libraryTasks, projectTasks, units, busy, onAdd, onRepeat }: Props) {
  const [unitKey, setUnitKey] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [sourceKey, setSourceKey] = useState("");
  const [targetKeys, setTargetKeys] = useState<string[]>([]);
  const selectedUnit = units.find((unit) => key(unit) === unitKey);
  const sourceUnit = units.find((unit) => key(unit) === sourceKey);
  const existing = useMemo(() => new Set(projectTasks.filter((task) => selectedUnit && task.unit_kind === selectedUnit.unit_kind && task.unit_label === selectedUnit.unit_label).map((task) => task.library_task_id).filter(Boolean)), [projectTasks, selectedUnit]);
  const add = async () => {
    if (selectedUnit && await onAdd(selectedUnit, selected)) setSelected([]);
  };
  const repeat = async () => {
    const targets = units.filter((unit) => targetKeys.includes(key(unit)));
    if (sourceUnit && await onRepeat(sourceUnit, targets)) setTargetKeys([]);
  };
  return (
    <Card className="min-w-0">
      <CardHeader><CardTitle className="text-base">2. Add tasks</CardTitle><p className="text-sm text-muted-foreground">Pick tasks from the master library for one unit, or repeat factory tasks only between units of this project.</p></CardHeader>
      <CardContent className="space-y-5">
        <label className="block max-w-md">Unit
          <select className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={unitKey} onChange={(event) => { setUnitKey(event.target.value); setSelected([]); }}>
            <option value="">Choose unit</option>{units.map((unit) => <option key={unit.id} value={key(unit)}>{unit.unit_label} · {unitLabel(unit.unit_kind)}</option>)}
          </select>
        </label>
        {selectedUnit ? (
          <div className="max-h-[70vh] space-y-4 overflow-y-auto px-1">
            {activities.map((activity) => {
              const tasks = libraryTasks.filter((task) => task.activity_id === activity.id).sort((a, b) => compareCodes(a.code, b.code));
              const extras = isExtrasGroup(activity.name);
              if (!tasks.length) return null;
              return (
                <section key={activity.id} className="rounded-md border border-border p-3">
                  <h3 className="text-sm font-semibold">{activity.code} · {activityDisplayName(activity.name)} <span className="font-normal text-muted-foreground">({activity.phase})</span></h3>
                  <div className="mt-3 grid gap-2 lg:grid-cols-2">
                    {tasks.map((task) => {
                      const added = existing.has(task.id);
                      return (
                        <label key={task.id} className={`flex min-w-0 items-start gap-2 rounded p-2 text-sm ${added ? "cursor-default opacity-70" : "hover:bg-muted/60"}`}>
                          {added ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-label="Already added" /> : <Checkbox className="mt-0.5" checked={selected.includes(task.id)} onCheckedChange={(checked) => setSelected((current) => checked ? [...new Set([...current, task.id])] : current.filter((id) => id !== task.id))} />}
                          <span className="min-w-0 break-words"><span className="mr-2 font-mono text-xs text-muted-foreground">{task.code}</span>{task.name} <span className="text-xs text-muted-foreground">· {extras ? "no fixed day" : `${task.default_days}d`}</span>{added && <Badge className="ml-2" variant="outline">Added</Badge>}</span>
                        </label>
                      );
                    })}
                  </div>
                </section>
              );
            })}
            <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card p-3 shadow-md">
              <span className="text-sm text-muted-foreground">{selected.length} selected for {selectedUnit.unit_label} · {existing.size} already added</span>
              <div className="flex gap-2">
                {selected.length > 0 && <Button type="button" variant="ghost" onClick={() => setSelected([])}>Clear</Button>}
                <Button type="button" disabled={!selected.length || busy} onClick={() => void add()}>Add selected ({selected.length})</Button>
              </div>
            </div>
          </div>
        ) : <p className="text-sm text-muted-foreground">Choose a unit to see its library and already-added tasks.</p>}
        <div className="space-y-3 border-t border-border pt-4">
          <h3 className="text-sm font-semibold">Repeat for other units</h3>
          <p className="text-xs text-muted-foreground">Only factory tasks from the selected source unit in this project are copied. Task codes get the new unit's name and their predecessors are linked to the copied tasks automatically.</p>
          <label className="block max-w-md">Source unit<select className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={sourceKey} onChange={(event) => { setSourceKey(event.target.value); setTargetKeys([]); }}><option value="">Choose source</option>{units.map((unit) => <option key={unit.id} value={key(unit)}>{unit.unit_label} · {unitLabel(unit.unit_kind)}</option>)}</select></label>
          {sourceUnit && <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{units.filter((unit) => unit.id !== sourceUnit.id).map((unit) => <label key={unit.id} className="flex items-center gap-2 text-sm"><Checkbox checked={targetKeys.includes(key(unit))} onCheckedChange={(checked) => setTargetKeys((current) => checked ? [...current, key(unit)] : current.filter((item) => item !== key(unit)))} />{unit.unit_label} · {unitLabel(unit.unit_kind)}</label>)}</div>}
          <Button type="button" variant="outline" disabled={!sourceUnit || !targetKeys.length || busy} onClick={() => void repeat()}>Repeat for selected units</Button>
        </div>
      </CardContent>
    </Card>
  );
}
