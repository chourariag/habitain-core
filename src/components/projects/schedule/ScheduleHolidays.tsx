import { forwardRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { displayDate, displayDateTime, type ProfileNameMap, type ScheduleHoliday } from "./schedule-types";

interface Props {
  holidays: ScheduleHoliday[];
  names?: ProfileNameMap;
  canWrite: boolean;
  baselineExists: boolean;
  busy: boolean;
  onChange: (date: string, label: string, active: boolean, reason?: string) => Promise<boolean>;
}

export const ScheduleHolidays = forwardRef<HTMLDivElement, Props>(function ScheduleHolidays({ holidays, names = {}, canWrite, baselineExists, busy, onChange }, ref) {
  const [date, setDate] = useState("");
  const [label, setLabel] = useState("");
  const [reason, setReason] = useState("");
  const [deactivating, setDeactivating] = useState<ScheduleHoliday | null>(null);
  const add = async () => {
    if (await onChange(date, label, true, baselineExists ? reason : undefined)) { setDate(""); setLabel(""); setReason(""); }
  };
  const deactivate = async () => {
    if (!deactivating) return;
    if (await onChange(deactivating.holiday_date, deactivating.label, false, baselineExists ? reason : undefined)) { setDeactivating(null); setReason(""); }
  };
  return (
    <Card className="min-w-0" ref={ref}>
      <CardHeader><CardTitle className="text-base">5. Company-wide holidays (apply to every project)</CardTitle><p className="text-sm text-muted-foreground">Sundays and active holidays are days off. After a baseline, changes need a reason and do not move dates already published.</p></CardHeader>
      <CardContent className="space-y-4">
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {holidays.map((holiday) => (
            <div key={holiday.holiday_date} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border p-3 text-sm">
              <span className="font-medium">{displayDate(holiday.holiday_date)}</span>
              <span className="min-w-0 flex-1 break-words">{holiday.label}</span>
              <span className="text-xs text-muted-foreground">Added by {holiday.created_by ? names[holiday.created_by] ?? "Staff member" : "System"}{holiday.created_at ? ` on ${displayDateTime(holiday.created_at)}` : ""}</span>
              <Badge variant={holiday.is_active ? "default" : "outline"}>{holiday.is_active ? "Active" : "Inactive"}</Badge>
              {canWrite && holiday.is_active && <Button type="button" size="sm" variant="outline" onClick={() => { setDeactivating(holiday); setReason(""); }}>Deactivate</Button>}
            </div>
          ))}
          {holidays.length === 0 && <p className="text-sm text-muted-foreground">No holidays listed.</p>}
        </div>
        {canWrite && (
          <div className="space-y-3 rounded-md border border-border p-3">
            <div className="grid items-end gap-3 md:grid-cols-4">
              <label>Date<Input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
              <label>Name<Input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="e.g. Diwali" /></label>
              {baselineExists && <label className="md:col-span-2">Reason (required)<Input value={reason} onChange={(event) => setReason(event.target.value)} /></label>}
              <Button type="button" disabled={!date || !label.trim() || (baselineExists && !reason.trim()) || busy} onClick={() => void add()}>Add holiday</Button>
            </div>
            {(date || label) && <p className="flex items-center gap-2 text-sm font-medium text-warning" role="alert"><AlertTriangle className="h-4 w-4 shrink-0" />This holiday applies to ALL projects.</p>}
          </div>
        )}
        {deactivating && (
          <div className="space-y-3 rounded-md border border-warning bg-muted p-3">
            <p className="text-sm">Deactivate <strong>{deactivating.label}</strong> on {displayDate(deactivating.holiday_date)}? This changes the calendar for ALL projects.</p>
            {baselineExists && <label>Reason (required)<Textarea rows={2} value={reason} onChange={(event) => setReason(event.target.value)} /></label>}
            <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setDeactivating(null)}>Cancel</Button><Button disabled={(baselineExists && !reason.trim()) || busy} onClick={() => void deactivate()}>Confirm deactivation</Button></div>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
