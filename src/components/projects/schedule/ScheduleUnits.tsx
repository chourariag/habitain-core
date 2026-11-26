import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { displayDate, unitLabel, type ScheduleUnit, type UnitKind } from "./schedule-types";

interface Props {
  units: ScheduleUnit[];
  canWrite: boolean;
  baselineExists: boolean;
  busy: boolean;
  onUpdate: (unit: ScheduleUnit, day1: string, note: string) => Promise<boolean>;
  onAdd: (kind: UnitKind, label: string, day1: string, note: string) => Promise<boolean>;
}

export function ScheduleUnits({ units, canWrite, baselineExists, busy, onUpdate, onAdd }: Props) {
  const [kind, setKind] = useState<UnitKind>("module");
  const [label, setLabel] = useState("");
  const [day1, setDay1] = useState("");
  const [note, setNote] = useState("");
  const add = async () => {
    if (await onAdd(kind, label, day1, note)) { setLabel(""); setDay1(""); setNote(""); }
  };
  return (
    <Card className="min-w-0">
      <CardHeader><CardTitle className="text-base">1. Units & Day 1</CardTitle><p className="text-sm text-muted-foreground">Sundays and listed holidays are off. Day 1 dates and all calculated task dates come from the database.</p></CardHeader>
      <CardContent className="space-y-4">
        <div className="max-w-full overflow-x-auto">
          <Table className={canWrite && !baselineExists ? "min-w-[760px]" : "min-w-[560px]"}>
            <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Label</TableHead><TableHead>Day 1</TableHead><TableHead>Offset note</TableHead>{canWrite && !baselineExists && <TableHead>Action</TableHead>}</TableRow></TableHeader>
            <TableBody>{units.map((unit) => <UnitRow key={unit.id} unit={unit} canWrite={canWrite && !baselineExists} busy={busy} onUpdate={onUpdate} />)}</TableBody>
          </Table>
        </div>
        {units.length === 0 && <p className="text-sm text-muted-foreground">No schedule units yet.</p>}
        {canWrite && !baselineExists && (
          <div className="grid items-end gap-3 rounded-md border border-border p-3 md:grid-cols-5">
            <label>Type<select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={kind} onChange={(event) => setKind(event.target.value as UnitKind)}><option value="module">Module</option><option value="panel_set">Panel set</option><option value="site">Site</option></select></label>
            <label>Label<Input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="e.g. Module 6" /></label>
            <label>Day 1<Input type="date" value={day1} onChange={(event) => setDay1(event.target.value)} /></label>
            <label>Offset note<Input value={note} onChange={(event) => setNote(event.target.value)} /></label>
            <Button type="button" disabled={!label.trim() || busy} onClick={() => void add()}>Add unit</Button>
          </div>
        )}
        {baselineExists && <p className="text-sm text-muted-foreground">Unit Day 1 is fixed after publication. Task changes use reasoned revisions.</p>}
      </CardContent>
    </Card>
  );
}

function UnitRow({ unit, canWrite, busy, onUpdate }: { unit: ScheduleUnit; canWrite: boolean; busy: boolean; onUpdate: Props["onUpdate"] }) {
  const [day1, setDay1] = useState(unit.day1 ?? "");
  const [note, setNote] = useState(unit.offset_note ?? "");
  useEffect(() => { setDay1(unit.day1 ?? ""); setNote(unit.offset_note ?? ""); }, [unit.id, unit.day1, unit.offset_note]);
  return (
    <TableRow>
      <TableCell>{unitLabel(unit.unit_kind)}</TableCell><TableCell className="font-medium">{unit.unit_label}</TableCell>
      <TableCell>{canWrite ? <Input type="date" value={day1} onChange={(event) => setDay1(event.target.value)} className="w-40" aria-label={`Day 1 for ${unit.unit_label}`} /> : displayDate(unit.day1)}</TableCell>
      <TableCell>{canWrite ? <Input value={note} onChange={(event) => setNote(event.target.value)} aria-label={`Offset note for ${unit.unit_label}`} /> : <span className="break-words">{unit.offset_note || "—"}</span>}</TableCell>
      {canWrite && <TableCell><Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void onUpdate(unit, day1, note)}>Save & recalculate</Button></TableCell>}
    </TableRow>
  );
}
