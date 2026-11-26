import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Loader2 } from "lucide-react";
import { displayDateTime, type ProfileNameMap, type ScheduleComment, type ScheduleTask } from "./schedule-types";

interface Props {
  task: ScheduleTask;
  comments: ScheduleComment[];
  names: ProfileNameMap;
  canEditSchedule: boolean;
  busy: boolean;
  onAdd: (task: ScheduleTask, body: string) => Promise<void>;
  onStatus: (comment: ScheduleComment, status: "seen" | "resolved") => Promise<void>;
}

export function ScheduleComments({ task, comments, names, canEditSchedule, busy, onAdd, onStatus }: Props) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const taskComments = comments.filter((comment) => comment.task_id === task.id);
  const submit = async () => {
    if (!body.trim()) return;
    await onAdd(task, body.trim());
    setBody("");
  };
  return (
    <>
      <Button type="button" size="sm" variant="outline" className="max-w-full whitespace-normal" onClick={() => setOpen(true)}>
        <MessageSquare className="mr-1 h-4 w-4 shrink-0" /> Comment{taskComments.length ? ` (${taskComments.length})` : ""}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Comments · {task.task_id_in_schedule}</DialogTitle>
            <DialogDescription className="break-words">{task.task_name}. Comments are feedback and never change task dates.</DialogDescription>
          </DialogHeader>
          <div className="max-h-72 space-y-3 overflow-y-auto">
            {taskComments.length === 0 && <p className="text-sm text-muted-foreground">No comments yet.</p>}
            {taskComments.map((comment) => (
              <article key={comment.id} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{comment.status}</Badge>
                  <span className="text-xs font-medium">{names[comment.author_id] ?? "Staff member"}</span>
                  <span className="text-xs text-muted-foreground">{displayDateTime(comment.created_at)}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm">{comment.body}</p>
                {canEditSchedule && comment.status !== "resolved" && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {comment.status === "open" && <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void onStatus(comment, "seen")}>Mark seen</Button>}
                    <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void onStatus(comment, "resolved")}>Mark resolved</Button>
                  </div>
                )}
              </article>
            ))}
          </div>
          <label className="space-y-1">New comment
            <Textarea value={body} onChange={(event) => setBody(event.target.value)} rows={3} maxLength={4000} placeholder="Leave schedule feedback without editing the task" />
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Close</Button>
            <Button type="button" disabled={!body.trim() || busy} onClick={() => void submit()}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Add comment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
