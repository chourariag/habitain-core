import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, Send, Paperclip, Image as ImageIcon, Reply } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format, isToday, isYesterday } from "date-fns";
import { effectiveDisplayName, getTestingPersonaName } from "@/lib/effective-user";
import { insertNotifications } from "@/lib/notifications";


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
  reply_to_id: string | null;
  mentioned_ids: string[];
}

interface TeamMember {
  authUserId: string;
  name: string;
}

function dateSeparatorLabel(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "dd MMM yyyy");
}

export function ProjectChatPanel({ projectId, projectName, projectType, userId, onClose }: ProjectChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [senderNames, setSenderNames] = useState<Record<string, string>>({});
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const fetchedSenderIds = useRef<Set<string>>(new Set());
  const signedFetched = useRef<Set<string>>(new Set());
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [senderName, setSenderName] = useState("");
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [mentionedIds, setMentionedIds] = useState<string[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get sender name (own)
  useEffect(() => {
    supabase.from("profiles").select("display_name").eq("auth_user_id", userId).maybeSingle()
      .then(({ data }) => setSenderName(effectiveDisplayName((data as any)?.display_name, "User")));
  }, [userId]);

  // Load people with access to this project's chat for @-mentions
  useEffect(() => {
    (async () => {
      const { data } = await (supabase.from("project_team_members") as any)
        .select("profile_id, is_active, profiles!inner(auth_user_id, display_name)")
        .eq("project_id", projectId)
        .eq("is_active", true);
      let list: TeamMember[] = ((data as any[]) ?? [])
        .map((r) => ({
          authUserId: r.profiles?.auth_user_id as string,
          name: (r.profiles?.display_name as string) || "User",
        }))
        .filter((m) => !!m.authUserId);

      // Fallback: project team not populated -> allow mentioning any active colleague
      if (list.length === 0) {
        const { data: dir } = await (supabase.rpc as any)("get_active_profiles_directory");
        list = ((dir as any[]) ?? [])
          .map((p) => ({ authUserId: p.auth_user_id as string, name: (p.display_name as string) || "User" }))
          .filter((m) => !!m.authUserId);
      }

      const seen = new Set<string>();
      setTeamMembers(list.filter((m) => (seen.has(m.authUserId) ? false : (seen.add(m.authUserId), true))));
    })();
  }, [projectId]);




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

  // Resolve sender display names from profiles
  useEffect(() => {
    const ids = Array.from(
      new Set(messages.map((m) => m.sender_id).filter((id) => id && !fetchedSenderIds.current.has(id)))
    );
    if (ids.length === 0) return;
    ids.forEach((id) => fetchedSenderIds.current.add(id));

    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("auth_user_id, display_name")
        .in("auth_user_id", ids);
      if (!data) return;
      setSenderNames((prev) => {
        const next = { ...prev };
        (data as any[]).forEach((p) => {
          if (p.display_name) next[p.auth_user_id] = p.display_name;
        });
        return next;
      });
    })();
  }, [messages]);

  // Resolve signed URLs for chat-media attachments (private bucket)
  useEffect(() => {
    const pathFromValue = (v: string): string | null => {
      if (!v) return null;
      const marker = "/chat-media/";
      const idx = v.indexOf(marker);
      if (idx >= 0) return v.substring(idx + marker.length).split("?")[0];
      if (v.startsWith("http")) return null;
      return v;
    };
    const toResolve: string[] = [];
    messages.forEach((m) => {
      (m.attachment_urls ?? []).forEach((v) => {
        if (!v || signedFetched.current.has(v)) return;
        const p = pathFromValue(v);
        if (p) toResolve.push(v);
      });
    });
    if (toResolve.length === 0) return;
    toResolve.forEach((v) => signedFetched.current.add(v));
    (async () => {
      const updates: Record<string, string> = {};
      for (const v of toResolve) {
        const p = pathFromValue(v);
        if (!p) continue;
        const { data } = await supabase.storage.from("chat-media").createSignedUrl(p, 3600);
        if (data?.signedUrl) updates[v] = data.signedUrl;
      }
      if (Object.keys(updates).length) setSignedUrls((prev) => ({ ...prev, ...updates }));
    })();
  }, [messages]);




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
        // Store storage path; signed URLs are minted on render
        urls.push(path);
      }

      const body = text.trim();
      // Keep only mentions still present in the final text
      const finalMentions = Array.from(new Set(
        mentionedIds.filter((id) => {
          const m = teamMembers.find((t) => t.authUserId === id);
          return m ? body.includes(`@${m.name}`) : false;
        })
      ));

      const { data: inserted } = await (supabase.from("project_messages") as any).insert({
        project_id: projectId,
        project_type: projectType,
        sender_id: userId,
        sender_name: getTestingPersonaName() || senderName || "User",
        message_text: body || null,
        attachment_urls: urls,
        read_by: [userId],
        reply_to_id: replyTo?.id ?? null,
        mentioned_ids: finalMentions,
      }).select("id").maybeSingle();

      // Distinct mention notification (separate from general new-message alerts)
      const recipients = finalMentions.filter((id) => id !== userId);
      if (recipients.length > 0) {
        const from = getTestingPersonaName() || senderName || "Someone";
        const snippet = body.length > 120 ? `${body.slice(0, 120)}…` : body || "sent an attachment";
        await insertNotifications(
          recipients.map((rid) => ({
            recipient_id: rid,
            title: `${from} mentioned you in ${projectName}`,
            body: snippet,
            category: "chat_mention",
            related_table: "project_messages",
            related_id: (inserted as any)?.id,
            navigate_to: `/projects/${projectId}`,
            priority: "high" as const,
          }))
        );
      }


      setText("");
      setAttachments([]);
      setReplyTo(null);
      setMentionedIds([]);
      setMentionQuery(null);

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

  // @-mention handling
  const handleTextChange = (value: string) => {
    setText(value);
    const caret = textareaRef.current?.selectionStart ?? value.length;
    const upto = value.slice(0, caret);
    const match = upto.match(/(?:^|\s)@([\p{L}0-9 ]{0,20})$/u);
    setMentionQuery(match ? match[1] : null);
  };

  const mentionOptions = mentionQuery === null
    ? []
    : teamMembers
        .filter((m) => m.name.toLowerCase().includes(mentionQuery.trim().toLowerCase()))
        .slice(0, 6);

  const selectMention = (m: TeamMember) => {
    const caret = textareaRef.current?.selectionStart ?? text.length;
    const upto = text.slice(0, caret);
    const rest = text.slice(caret);
    const replaced = upto.replace(/@([\p{L}0-9 ]{0,20})$/u, `@${m.name} `);
    setText(replaced + rest);
    setMentionedIds((prev) => Array.from(new Set([...prev, m.authUserId])));
    setMentionQuery(null);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      const pos = replaced.length;
      textareaRef.current?.setSelectionRange(pos, pos);
    });
  };

  // Render message text with highlighted mentions
  const renderText = (body: string) => {
    const names = teamMembers.map((t) => t.name).filter(Boolean).sort((a, b) => b.length - a.length);
    if (names.length === 0) return body;
    const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const re = new RegExp(`@(${escaped.join("|")})`, "g");
    const parts: (string | JSX.Element)[] = [];
    let last = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(body))) {
      if (match.index > last) parts.push(body.slice(last, match.index));
      parts.push(
        <span key={`${match.index}-${match[1]}`} className="font-semibold" style={{ color: "hsl(var(--primary))" }}>
          {match[0]}
        </span>
      );
      last = match.index + match[0].length;
    }
    if (last < body.length) parts.push(body.slice(last));
    return parts;
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
          bottom-0 left-0 right-0 h-[70dvh] max-h-[100dvh] rounded-t-2xl
          md:bottom-0 md:top-0 md:left-auto md:right-0 md:h-[100dvh] md:w-[380px] md:rounded-none md:border-l border-border"
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
        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-1" style={{ backgroundColor: "hsl(var(--background))" }}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <MessageSquareIcon />
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
                  const quoted = m.reply_to_id ? messages.find((x) => x.id === m.reply_to_id) : null;
                  return (
                    <div key={m.id} className={`group flex mb-2 items-center gap-1 ${isOwn ? "justify-end" : "justify-start"}`}>
                      {isOwn && (
                        <button
                          className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-muted-foreground p-1"
                          aria-label="Reply"
                          onClick={() => { setReplyTo(m); textareaRef.current?.focus(); }}
                        >
                          <Reply className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <div className="max-w-[75%]">
                        {!isOwn && (
                          <p className="text-[11px] font-bold mb-0.5 px-1" style={{ color: "#666666" }}>{senderNames[m.sender_id] || m.sender_name || "User"}</p>
                        )}
                        <div
                          className="px-3 py-2 text-[13px] leading-relaxed"
                          style={{
                            backgroundColor: isOwn ? "hsl(var(--accent))" : "hsl(var(--card))",
                            color: isOwn ? "hsl(var(--accent-foreground))" : "hsl(var(--foreground))",
                            borderRadius: isOwn ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
                          }}
                        >
                          {quoted && (
                            <div className="mb-1.5 px-2 py-1 rounded-md border-l-2 bg-muted/60" style={{ borderLeftColor: "hsl(var(--primary))" }}>
                              <p className="text-[10px] font-bold text-muted-foreground">
                                {senderNames[quoted.sender_id] || quoted.sender_name || "User"}
                              </p>
                              <p className="text-[11px] text-muted-foreground truncate">
                                {quoted.message_text || "Attachment"}
                              </p>
                            </div>
                          )}
                          {(m.attachment_urls ?? []).length > 0 && (
                            <div className="flex gap-1.5 mb-1.5 flex-wrap">
                              {m.attachment_urls.map((url, i) => {
                                const display = signedUrls[url] ?? (url.startsWith("http") ? url : "");
                                return (
                                  <img
                                    key={i}
                                    src={display}
                                    alt="attachment"
                                    className="w-[160px] h-[120px] object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity bg-muted"
                                    onClick={() => display && setPreviewImg(display)}
                                    loading="lazy"
                                  />
                                );
                              })}
                            </div>
                          )}
                          {m.message_text && <p className="whitespace-pre-wrap break-words">{renderText(m.message_text)}</p>}
                          <p className="text-[10px] text-muted-foreground mt-1 text-right">
                            {format(new Date(m.created_at), "HH:mm")}
                          </p>
                        </div>
                      </div>
                      {!isOwn && (
                        <button
                          className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-muted-foreground p-1"
                          aria-label="Reply"
                          onClick={() => { setReplyTo(m); textareaRef.current?.focus(); }}
                        >
                          <Reply className="h-3.5 w-3.5" />
                        </button>
                      )}
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

        {/* Reply preview */}
        {replyTo && (
          <div className="flex items-start gap-2 px-3 py-2 border-t border-border bg-muted/40">
            <div className="flex-1 min-w-0 border-l-2 pl-2" style={{ borderLeftColor: "hsl(var(--primary))" }}>
              <p className="text-[11px] font-bold text-muted-foreground">
                Replying to {senderNames[replyTo.sender_id] || replyTo.sender_name || "User"}
              </p>
              <p className="text-[12px] text-muted-foreground truncate">
                {replyTo.message_text ? replyTo.message_text.slice(0, 120) : "Attachment"}
              </p>
            </div>
            <button className="text-muted-foreground shrink-0" aria-label="Cancel reply" onClick={() => setReplyTo(null)}>
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Input */}
        <div className="relative shrink-0 flex items-end gap-2 px-3 py-3 border-t border-border" style={{ backgroundColor: "hsl(var(--background))", paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
          {mentionOptions.length > 0 && (
            <div className="absolute bottom-full left-3 right-3 mb-1 z-10 max-h-48 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
              {mentionOptions.map((m) => (
                <button
                  key={m.authUserId}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                  onClick={() => selectMention(m)}
                >
                  {m.name}
                </button>
              ))}
            </div>
          )}
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
            onChange={(e) => handleTextChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") { setMentionQuery(null); return; }
              if (e.key === "Enter" && !e.shiftKey) {
                if (mentionOptions.length > 0) {
                  e.preventDefault();
                  selectMention(mentionOptions[0]);
                  return;
                }
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type a message... use @ to mention"
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

function MessageSquareIcon() {
  return (
    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    </div>
  );
}
