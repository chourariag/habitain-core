import { useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { compareCodes, type ScheduleTask } from "./schedule-types";

interface Props {
  /** Unit of the task being edited; options default to this unit only. */
  unitLabel: string | null;
  selfId?: string;
  selfCode?: string;
  tasks: ScheduleTask[];
  value: string[];
  onChange: (codes: string[]) => void;
  disabled?: boolean;
  label: string;
}

/**
 * One shared searchable picker. Its option list is built only while the popover is open,
 * so rows never render a list of every task.
 */
export function PredecessorPicker({ unitLabel, selfId, selfCode, tasks, value, onChange, disabled, label }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" disabled={disabled} aria-label={label} className="flex h-8 w-full min-w-0 items-center gap-1 overflow-hidden rounded-md border border-input bg-background px-1.5 text-left text-xs hover:bg-muted disabled:opacity-60">
          {value.length === 0 ? <span className="text-muted-foreground">None</span> : (
            <>
              {value.slice(0, 2).map((code) => <span key={code} className="max-w-[72px] shrink-0 truncate rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]" title={code}>{code}</span>)}
              {value.length > 2 && <span className="shrink-0 text-muted-foreground">+{value.length - 2}</span>}
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        {open && <PickerList unitLabel={unitLabel} selfId={selfId} selfCode={selfCode} tasks={tasks} value={value} onChange={onChange} onDone={() => setOpen(false)} />}
      </PopoverContent>
    </Popover>
  );
}

function PickerList({ unitLabel, selfId, selfCode, tasks, value, onChange, onDone }: Omit<Props, "disabled" | "label"> & { onDone: () => void }) {
  const [search, setSearch] = useState("");
  const [otherUnits, setOtherUnits] = useState(false);
  const options = useMemo(() => {
    const term = search.trim().toLowerCase();
    return tasks
      .filter((task) => !task.is_removed && task.id !== selfId && task.task_id_in_schedule !== selfCode)
      .filter((task) => otherUnits || task.unit_label === unitLabel)
      .filter((task) => !term || task.task_id_in_schedule.toLowerCase().includes(term) || task.task_name.toLowerCase().includes(term))
      .sort((a, b) => compareCodes(a.task_id_in_schedule, b.task_id_in_schedule));
  }, [tasks, selfId, selfCode, otherUnits, unitLabel, search]);
  const shown = options.slice(0, 150);
  const toggle = (code: string, checked: boolean) => onChange(checked ? [...new Set([...value, code])] : value.filter((item) => item !== code));
  return (
    <div className="flex max-h-[420px] flex-col">
      <div className="space-y-2 border-b border-border p-2">
        <Input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by code or name" className="h-8 text-sm" aria-label="Search predecessors" />
        <label className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>Show other units</span>
          <Switch checked={otherUnits} onCheckedChange={setOtherUnits} aria-label="Show other units" />
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1" role="listbox" aria-multiselectable="true">
        {shown.length === 0 && <p className="p-3 text-xs text-muted-foreground">{unitLabel || otherUnits ? "No matching tasks." : "This task has no unit. Turn on “Show other units” to pick from all tasks."}</p>}
        {shown.map((task) => {
          const checked = value.includes(task.task_id_in_schedule);
          return (
            <label key={task.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-muted">
              <Checkbox checked={checked} onCheckedChange={(next) => toggle(task.task_id_in_schedule, next === true)} />
              <span className="w-20 shrink-0 truncate font-mono" title={task.task_id_in_schedule}>{task.task_id_in_schedule}</span>
              <span className="min-w-0 flex-1 truncate" title={task.task_name}>{task.task_name}</span>
              {otherUnits && <span className="shrink-0 text-[10px] text-muted-foreground">{task.unit_label ?? "No unit"}</span>}
            </label>
          );
        })}
        {options.length > shown.length && <p className="p-2 text-xs text-muted-foreground">Showing 150 of {options.length}. Search to narrow the list.</p>}
      </div>
      <div className="flex items-center justify-between border-t border-border p-2 text-xs">
        <span className="text-muted-foreground">{value.length} selected</span>
        <Button type="button" size="sm" variant="outline" onClick={onDone}>Done</Button>
      </div>
    </div>
  );
}
