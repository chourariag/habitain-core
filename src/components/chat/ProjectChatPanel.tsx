import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, Send, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format, isToday, isYesterday } from "date-fns";

interface ProjectChatPanelProps {
  projectId: string;
  projectName: string;
  projectType: "production" | "design";
  userId: string;
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  message_text: string | null;
  attachment_urls: string[];
  created_at: string;
  read_by: string[];
}

function dateSeparatorLabel(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "dd MMM yyyy");
}

export function ProjectChatPanel({ projectId, projectName, projectType, userId, onClose }: ProjectChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [senderName, setSenderName] = useState("");
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get sender name
  useEffect(() => {
    supabase.from("profiles").select("display_name").eq("auth_user_id", userId).maybeSingle()
      .then(({ data }) => setSenderName((data as any)?.display_name ?? "User"));
  }, [userId]);

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    const { data } = await (supabase.from("project_messages") as any)
      .select("*")
      .eq("project_id", projectId)
      .eq("project_type", projectType)
      .order("created_at", { ascending: true });
    setMessages(data ?? []);
  }, [projectId, projectType]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  // Mark as read
  useEffect(() => {
    const markRead = async () => {
      const unread = messages.filter(
        (m) => m.sender_id !== userId && !(m.read_by ?? []).includes(userId)
      );
      for (const m of unread) {
        await (supabase.from("project_messages") as any)
          .update({ read_by: [...(m.read_by ?? []), userId] })
          .eq("id", m.id);
      }
    };
    if (messages.length > 0) markRead();
  }, [messages, userId]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`chat-panel-${projectId}-${projectType}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "project_messages",
        filter: `project_id=eq.${projectId}`,
      }, (payload: any) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === payload.new.id)) return prev;
          return [...prev, payload.new as ChatMessage];
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [projectId, projectType]);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 72) + "px";
    }
  }, [text]);

  const handleSend = async () => {
    if (!text.trim() && attachments.length === 0) return;
    setSending(true);
    try {
      let urls: string[] = [];
      for (const file of attachments) {
        const path = `${projectId}/${Date.now()}-${file.name}`;
        const { error } = await supabase.storage.from("chat-media").upload(path, file);
        if (error) throw error;
        const { data: urlData } = supabase.storage.from("chat-media").getPublicUrl(path);
        urls.push(urlData.publicUrl);
      }

      await (supabase.from("project_messages") as any).insert({
        project_id: projectId,
        project_type: projectType,
        sender_id: userId,
        sender_name: senderName || "User",
        message_text: text.trim() || null,
        attachment_urls: urls,
        read_by: [userId],
      });

      setText("");
      setAttachments([]);
    } catch (err: any) {
      toast.error(err.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const valid = files.filter((f) => f.type.startsWith("image/")).slice(0, 3 - attachments.length);
    if (valid.length < files.length) toast.info("Only JPEG/PNG images allowed, max 3");
    setAttachments((prev) => [...prev, ...valid].slice(0, 3));
    e.target.value = "";
  };

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  // Group messages by date
  const groupedMessages: { label: string; msgs: ChatMessage[] }[] = [];
  let lastLabel = "";
  messages.forEach((m) => {
    const label = dateSeparatorLabel(m.created_at);
    if (label !== lastLabel) {
      groupedMessages.push({ label, msgs: [m] });
      lastLabel = label;
    } else {
      groupedMessages[groupedMessages.length - 1].msgs.push(m);
    }
  });

  return (
    <>
      {/* Overlay for mobile */}
      <div className="fixed inset-0 z-50 bg-black/30 md:bg-transparent md:pointer-events-none" onClick={onClose} />

      {/* Panel */}
      <div
        className="fixed z-50 flex flex-col bg-background shadow-2xl overflow-hidden
          bottom-0 left-0 right-0 h-[70vh] rounded-t-2xl
          md:bottom-auto md:top-0 md:left-auto md:right-0 md:h-full md:w-[380px] md:rounded-none md:border-l border-border"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: "slideIn 0.2s ease-out" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border" style={{ borderTopWidth: 3, borderTopColor: "hsl(var(--primary))" }}>
          <div className="min-w-0">
            <h3 className="font-display text-sm font-bold truncate" style={{ color: "hsl(var(--foreground))" }}>{projectName}</h3>
            <p className="text-xs text-muted-foreground">Project Chat</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1" style={{ backgroundColor: "hsl(var(--background))" }}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <p className="text-sm text-muted-foreground mt-3">No messages yet. Start the conversation.</p>
            </div>
          ) : (
            groupedMessages.map((group) => (
              <div key={group.label}>
                <div className="flex justify-center my-3">
                  <span className="text-xs px-3 py-1 rounded-full bg-muted text-muted-foreground">{group.label}</span>
                </div>
                {group.msgs.map((m) => {
                  const isOwn = m.sender_id === userId;
                  return (
                    <div key={m.id} className={`flex mb-2 ${isOwn ? "justify-end" : "justify-start"}`}>
                      <div className="max-w-[75%]">
                        {!isOwn && (
                          <p className="text-[11px] font-semibold mb-0.5 px-1" style={{ color: "#666666" }}>{m.sender_name}</p>
                        )}
                        <div
                          className="px-3 py-2 text-[13px] leading-relaxed"
                          style={{
                            backgroundColor: isOwn ? "hsl(var(--accent))" : "hsl(var(--card))",
                            color: isOwn ? "hsl(var(--accent-foreground))" : "hsl(var(--foreground))",
                            borderRadius: isOwn ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
                          }}
                        >
                          {(m.attachment_urls ?? []).length > 0 && (
                            <div className="flex gap-1.5 mb-1.5 flex-wrap">
                              {m.attachment_urls.map((url, i) => (
                                <img
                                  key={i}
                                  src={url}
                                  alt="attachment"
                                  className="w-[160px] h-[120px] object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                  onClick={() => setPreviewImg(url)}
                                  loading="lazy"
                                />
                              ))}
                            </div>
                          )}
                          {m.message_text && <p className="whitespace-pre-wrap break-words">{m.message_text}</p>}
                          <p className="text-[10px] text-muted-foreground mt-1 text-right">
                            {format(new Date(m.created_at), "HH:mm")}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Attachment previews */}
        {attachments.length > 0 && (
          <div className="flex gap-2 px-3 py-2 border-t border-border bg-muted/30">
            {attachments.map((f, i) => (
              <div key={i} className="relative">
                <img src={URL.createObjectURL(f)} alt="" className="w-12 h-12 rounded-md object-cover" />
                <button
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[10px]"
                  style={{ backgroundColor: "hsl(var(--destructive))", color: "hsl(var(--destructive-foreground))" }}
                  onClick={() => removeAttachment(i)}
                >×</button>
              </div>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="flex items-end gap-2 px-3 py-3 border-t border-border" style={{ backgroundColor: "hsl(var(--background))" }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => fileInputRef.current?.click()}
            disabled={attachments.length >= 3}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 resize-none border border-input rounded-[20px] px-3 py-2 text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            style={{ maxHeight: 72 }}
          />
          <button
            onClick={handleSend}
            disabled={sending || (!text.trim() && attachments.length === 0)}
            className="flex items-center justify-center rounded-full h-9 w-9 shrink-0 transition-colors disabled:opacity-40"
            style={{
              backgroundColor: (!text.trim() && attachments.length === 0) ? "hsl(var(--muted))" : "hsl(var(--primary))",
              color: "hsl(var(--primary-foreground))",
            }}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Fullscreen image preview */}
      {previewImg && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center" onClick={() => setPreviewImg(null)}>
          <img src={previewImg} alt="Preview" className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg" />
          <button className="absolute top-4 right-4 text-white" onClick={() => setPreviewImg(null)}>
            <X className="h-6 w-6" />
          </button>
        </div>
      )}

      <style>{`
        @keyframes slideIn {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @media (min-width: 768px) {
          @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
        }
      `}</style>
    </>
  );
}
