import { Badge } from "@/components/ui/badge";
import { History } from "lucide-react";
import { format, parseISO } from "date-fns";

export function isBackfilledTask(task: any): boolean {
  return task?.completion_type === "completed_pre_hstack";
}

/**
 * Permanent, non-removable marker for tasks imported as historical (pre-HStack).
 * Never renders an approver name — only who ran the backfill and when.
 */
export function BackfilledTaskBadge({
  task,
  className,
}: {
  task: { backfilled_by_name?: string | null; backfilled_at?: string | null; backfill_note?: string | null };
  className?: string;
}) {
  const who = task.backfilled_by_name ?? null;
  const when = task.backfilled_at ? format(parseISO(task.backfilled_at), "dd/MM/yyyy") : null;
  const suffix = who && when ? `, set by ${who} on ${when}` : when ? `, set on ${when}` : "";
  return (
    <Badge
      variant="outline"
      className={`text-[9px] gap-1 ${className ?? ""}`}
      style={{ borderColor: "#D4860A", color: "#8A5A06", backgroundColor: "#FFF8E8" }}
      title={task.backfill_note ?? undefined}
    >
      <History className="h-3 w-3" />
      Backfilled — Pre-HStack{suffix}
    </Badge>
  );
}
