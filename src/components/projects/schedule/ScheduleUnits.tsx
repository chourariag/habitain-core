import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { displayDate, unitLabel, type FactoryModule, type ScheduleUnit, type UnitKind } from "./schedule-types";

interface Props {
  units: ScheduleUnit[];
  modules: FactoryModule[];
  canWrite: boolean;
  canLinkModules: boolean;
  desktop: boolean;
  baselineExists: boolean;
  busy: boolean;
  onUpdate: (unit: ScheduleUnit, day1: string, note: string) => Promise<boolean>;
  onAdd: (kind: UnitKind, label: string, day1: string, note: string) => Promise<boolean>;
  onSetModule: (unit: ScheduleUnit, moduleId: string | null) => Promise<boolean>;
  onAutoMatch: () => Promise<boolean>;
}

export function ScheduleUnits({ units, modules, canWrite, canLinkModules, desktop, baselineExists, busy, onUpdate, onAdd, onSetModule, onAutoMatch }: Props) {
  const [kind, setKind] = useState<UnitKind>("module");
  const [label, setLabel] = useState("");
  const [day1, setDay1] = useState("");
  const [note, setNote] = useState("");
  const placeholder = suggestLabel(kind, units);
  const add = async () => {
    if (await onAdd(kind, label, day1, note)) { setLabel(""); setDay1(""); setNote(""); }
  };
  const rowProps = { units, modules, canLinkModules, busy, onSetModule };
  return (
    <Card className="min-w-0">
      <CardHeader><CardTitle className="text-base">1. Units & Day 1</CardTitle><p className="text-sm text-muted-foreground">Sundays and listed holidays are off. Set Day 1 for each unit; task dates are worked out automatically from the start day, the days and the working calendar.</p></CardHeader>
      <CardContent className="space-y-4">
        {canLinkModules && <Button type="button" variant="outline" className="min-h-11 w-full sm:w-auto" disabled={busy || !units.some(unit => unit.unit_kind === "module")} onClick={() => void onAutoMatch()}>Auto-match by name</Button>}
        {desktop ? <div className="max-w-full overflow-x-auto">
          <Table className="min-w-[780px]">
            <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Label</TableHead><TableHead>Factory module</TableHead><TableHead>Day 1</TableHead><TableHead>Offset note</TableHead>{canWrite && !baselineExists && <TableHead className="sticky right-0 bg-card">Action</TableHead>}</TableRow></TableHeader>
            <TableBody>{units.map((unit) => <UnitRow key={unit.id} unit={unit} canWrite={canWrite && !baselineExists} onUpdate={onUpdate} {...rowProps} />)}</TableBody>
          </Table>
        </div> : <div className="space-y-3">{units.map(unit => <MobileUnitCard key={unit.id} unit={unit} canWrite={canWrite && !baselineExists} onUpdate={onUpdate} {...rowProps} />)}</div>}
        {units.length === 0 && <p className="text-sm text-muted-foreground">No schedule units yet.</p>}
        {canWrite && !baselineExists && (
          <div className="grid items-start gap-3 rounded-md border border-border p-3 md:grid-cols-5">
            <label>Type<select className="flex h-11 min-h-[44px] w-full rounded-md border border-input bg-background px-3 text-sm" value={kind} onChange={(event) => setKind(event.target.value as UnitKind)}><option value="module">Module</option><option value="panel_set">Panel set</option><option value="site">Site</option></select></label>
            <label>Label<Input value={label} onChange={(event) => setLabel(event.target.value)} placeholder={`e.g. ${placeholder}`} /></label>
            <label>Day 1<Input type="date" value={day1} onChange={(event) => setDay1(event.target.value)} /></label>
            <label>Offset note<Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional" /><span className="mt-1 block text-xs text-muted-foreground">Optional: why this unit starts later, e.g. waits for site clearance</span></label>
            <Button type="button" className="min-h-11 md:mt-6" disabled={!label.trim() || busy} onClick={() => void add()}>Add unit</Button>
          </div>
        )}
        {baselineExists && <p className="text-sm text-muted-foreground">Unit Day 1 is fixed after publication. Task changes use reasoned revisions.</p>}
      </CardContent>
    </Card>
  );
}

interface RowProps {
  unit: ScheduleUnit;
  units: ScheduleUnit[];
  modules: FactoryModule[];
  canWrite: boolean;
  canLinkModules: boolean;
  busy: boolean;
  onUpdate: Props["onUpdate"];
  onSetModule: Props["onSetModule"];
}

function UnitRow({ unit, canWrite, onUpdate, ...linkProps }: RowProps) {
  const [day1, setDay1] = useState(unit.day1 ?? "");
  const [note, setNote] = useState(unit.offset_note ?? "");
  useEffect(() => { setDay1(unit.day1 ?? ""); setNote(unit.offset_note ?? ""); }, [unit.id, unit.day1, unit.offset_note]);
  return (
    <TableRow>
      <TableCell className="whitespace-nowrap">{unitLabel(unit.unit_kind)}</TableCell><TableCell className="whitespace-nowrap font-medium">{unit.unit_label}</TableCell>
      <TableCell><ModuleField unit={unit} {...linkProps} /></TableCell>
      <TableCell>{canWrite ? <Input type="date" value={day1} onChange={(event) => setDay1(event.target.value)} className="min-h-11 w-40" aria-label={`Day 1 for ${unit.unit_label}`} /> : displayDate(unit.day1)}</TableCell>
      <TableCell>{canWrite ? <Input value={note} onChange={(event) => setNote(event.target.value)} aria-label={`Offset note for ${unit.unit_label}`} placeholder="Optional" className="min-h-11 min-w-[140px]" title="Optional: why this unit starts later, e.g. waits for site clearance" /> : <span className="break-words">{unit.offset_note || "—"}</span>}</TableCell>
      {canWrite && <TableCell className="sticky right-0 whitespace-nowrap bg-card"><Button type="button" size="sm" variant="outline" className="min-h-11" disabled={linkProps.busy} onClick={() => void onUpdate(unit, day1, note)}>Save</Button></TableCell>}
    </TableRow>
  );
}

function MobileUnitCard({ unit, canWrite, onUpdate, ...linkProps }: RowProps) {
  const [day1, setDay1] = useState(unit.day1 ?? "");
  const [note, setNote] = useState(unit.offset_note ?? "");
  useEffect(() => { setDay1(unit.day1 ?? ""); setNote(unit.offset_note ?? ""); }, [unit.id, unit.day1, unit.offset_note]);
  return <div className="min-w-0 space-y-3 rounded-md border border-border p-3">
    <div className="min-w-0"><p className="text-xs text-muted-foreground">{unitLabel(unit.unit_kind)}</p><p className="break-words text-sm font-medium">{unit.unit_label}</p></div>
    <label className="block min-w-0 text-xs text-muted-foreground">Factory module<span className="mt-1 block"><ModuleField unit={unit} fullWidth {...linkProps} /></span></label>
    <div className="grid grid-cols-1 gap-3">
      <label className="block text-xs text-muted-foreground">Day 1<span className="mt-1 block text-sm text-foreground">{canWrite ? <Input type="date" value={day1} onChange={event => setDay1(event.target.value)} className="min-h-11 w-full" aria-label={`Day 1 for ${unit.unit_label}`} /> : displayDate(unit.day1)}</span></label>
      <label className="block text-xs text-muted-foreground">Offset note<span className="mt-1 block text-sm text-foreground">{canWrite ? <Input value={note} onChange={event => setNote(event.target.value)} className="min-h-11 w-full" aria-label={`Offset note for ${unit.unit_label}`} placeholder="Optional" /> : <span className="break-words">{unit.offset_note || "—"}</span>}</span></label>
    </div>
    {canWrite && <Button type="button" variant="outline" className="min-h-11 w-full" disabled={linkProps.busy} onClick={() => void onUpdate(unit, day1, note)}>Save</Button>}
  </div>;
}

function ModuleField({ unit, units, modules, canLinkModules, busy, onSetModule, fullWidth = false }: { unit: ScheduleUnit; units: ScheduleUnit[]; modules: FactoryModule[]; canLinkModules: boolean; busy: boolean; onSetModule: Props["onSetModule"]; fullWidth?: boolean }) {
  if (unit.unit_kind !== "module") return <span className="text-sm text-muted-foreground">—</span>;
  const current = modules.find(module => module.id === unit.module_id);
  if (!canLinkModules) return <span className="break-words text-sm">{unit.module_id ? current?.name ?? "Linked module unavailable" : "Not linked"}</span>;
  const taken = new Set(units.filter(other => other.id !== unit.id && other.module_id).map(other => other.module_id));
  const active = modules.filter(module => !module.is_archived).sort((a, b) => a.name.localeCompare(b.name));
  return <select
    aria-label={`Factory module for ${unit.unit_label}`}
    className={`${fullWidth ? "w-full min-w-0 max-w-full" : "w-52 max-w-full"} h-11 min-h-[44px] rounded-md border border-input bg-background px-3 text-sm text-foreground`}
    value={unit.module_id ?? ""}
    disabled={busy}
    onChange={event => void onSetModule(unit, event.target.value || null)}
  >
    <option value="">Not linked</option>
    {current?.is_archived && <option value={current.id} disabled>{current.name} (archived)</option>}
    {active.map(module => <option key={module.id} value={module.id} disabled={taken.has(module.id)}>{module.name}{module.module_code ? ` (${module.module_code})` : ""}</option>)}
  </select>;
}

/** Suggests the next label in the style already used on this project (Module 1, Panel set A, Site). */
export function suggestLabel(kind: UnitKind, units: ScheduleUnit[]) {
  const same = units.filter((unit) => unit.unit_kind === kind).map((unit) => unit.unit_label);
  if (kind === "site") return same.length ? `Site ${same.length + 1}` : "Site";
  if (kind === "panel_set") {
    const letters = same.map((label) => label.match(/([A-Z])\s*$/i)?.[1]?.toUpperCase()).filter(Boolean) as string[];
    const next = letters.length ? String.fromCharCode(Math.max(...letters.map((l) => l.charCodeAt(0))) + 1) : "A";
    return `Panel set ${next}`;
  }
  const numbers = same.map((label) => Number(label.match(/(\d+)\s*$/)?.[1])).filter((n) => Number.isFinite(n) && n > 0);
  return `Module ${numbers.length ? Math.max(...numbers) + 1 : 1}`;
}
