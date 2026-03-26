import { useState, useEffect, useRef } from "react";
import { MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ProjectChatPanel } from "./ProjectChatPanel";

interface ProjectChatButtonProps {
  projectId: string;
  projectName: string;
  projectType: "production" | "design";
}

export function ProjectChatButton({ projectId, projectName, projectType }: ProjectChatButtonProps) {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  // Count unread messages
  useEffect(() => {
    if (!userId || !projectId) return;
    const countUnread = async () => {
      const { data } = await (supabase.from("project_messages") as any)
        .select("id,read_by")
        .eq("project_id", projectId)
        .eq("project_type", projectType)
        .neq("sender_id", userId);
      const unread = (data ?? []).filter((m: any) => !(m.read_by ?? []).includes(userId));
      setUnreadCount(unread.length);
    };
    countUnread();

    // Listen for new messages
    channelRef.current = supabase
      .channel(`chat-badge-${projectId}-${projectType}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "project_messages",
        filter: `project_id=eq.${projectId}`,
      }, (payload: any) => {
        if (payload.new.sender_id !== userId && !open) {
          setUnreadCount((c) => c + 1);
        }
      })
      .subscribe();

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [userId, projectId, projectType, open]);

  // Clear unread when opening
  useEffect(() => {
    if (open) setUnreadCount(0);
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed z-50 flex items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95"
        style={{
          width: 52,
          height: 52,
          bottom: 80,
          right: 16,
          backgroundColor: "hsl(var(--primary))",
          color: "hsl(var(--primary-foreground))",
        }}
        aria-label="Open project chat"
      >
        <MessageSquare className="h-5 w-5" />
        {unreadCount > 0 && (
          <span
            className="absolute flex items-center justify-center rounded-full font-bold"
            style={{
              top: -2,
              right: -2,
              minWidth: 18,
              height: 18,
              fontSize: 9,
              padding: "0 4px",
              backgroundColor: "hsl(var(--destructive))",
              color: "hsl(var(--destructive-foreground))",
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <ProjectChatPanel
          projectId={projectId}
          projectName={projectName}
          projectType={projectType}
          userId={userId!}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
