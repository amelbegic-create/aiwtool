"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Heart, MessageCircle, Send, Loader2, X, Trash2 } from "lucide-react";
import {
  toggleDashboardEventLike,
  getDashboardEventComments,
  addDashboardEventComment,
  deleteDashboardEventComment,
  type DashboardEventCommentPublic,
} from "@/app/actions/dashboardEventActions";
import { formatDateTimeDeAt } from "@/lib/dateUtils";
import { toast } from "sonner";
import { hasPermission } from "@/lib/permissionCheck";

export default function EventSocialPanel({
  eventId,
  initialLikeCount,
  initialCommentCount,
  initialLikedByMe,
}: {
  eventId: string;
  initialLikeCount: number;
  initialCommentCount: number;
  initialLikedByMe: boolean;
}) {
  const { data: session } = useSession();
  const sessionUser = session?.user as { role?: string; permissions?: string[] } | undefined;
  const canDeleteComments = hasPermission(
    String(sessionUser?.role ?? ""),
    Array.isArray(sessionUser?.permissions) ? sessionUser.permissions : [],
    "dashboard_events:manage"
  );

  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [liked, setLiked] = useState(initialLikedByMe);
  const [commentCount, setCommentCount] = useState(initialCommentCount);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<DashboardEventCommentPublic[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [likePending, setLikePending] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);

  useEffect(() => {
    setLikeCount(initialLikeCount);
    setLiked(initialLikedByMe);
    setCommentCount(initialCommentCount);
  }, [eventId, initialLikeCount, initialLikedByMe, initialCommentCount]);

  useEffect(() => {
    if (!commentsOpen) return;
    setLoadingComments(true);
    getDashboardEventComments(eventId)
      .then(setComments)
      .catch(() => toast.error("Kommentare konnten nicht geladen werden."))
      .finally(() => setLoadingComments(false));
  }, [commentsOpen, eventId]);

  const onToggleLike = async () => {
    if (likePending) return;
    setLikePending(true);
    const prevLiked = liked;
    const prevCount = likeCount;
    setLiked(!prevLiked);
    setLikeCount((c) => Math.max(0, c + (prevLiked ? -1 : 1)));
    try {
      const r = await toggleDashboardEventLike(eventId);
      if (!r.ok || r.likeCount == null || r.likedByMe == null) throw new Error(r.error ?? "Fehler");
      setLikeCount(r.likeCount);
      setLiked(r.likedByMe);
    } catch {
      setLiked(prevLiked);
      setLikeCount(prevCount);
      toast.error("Gefällt mir konnte nicht gespeichert werden.");
    } finally {
      setLikePending(false);
    }
  };

  const onSend = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    try {
      const r = await addDashboardEventComment(eventId, t);
      if (!r.ok || !r.comment) throw new Error(r.error ?? "Fehler");
      setComments((prev) => [...prev, r.comment]);
      setCommentCount((c) => c + 1);
      setText("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler.");
    } finally {
      setSending(false);
    }
  };

  const onDeleteComment = async (id: string) => {
    if (!canDeleteComments || deletingCommentId) return;
    setDeletingCommentId(id);
    try {
      const r = await deleteDashboardEventComment(id);
      if (!r.ok) throw new Error(r.error ?? "Fehler");
      setComments((prev) => prev.filter((c) => c.id !== id));
      setCommentCount((c) => Math.max(0, c - 1));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler.");
    } finally {
      setDeletingCommentId(null);
    }
  };

  return (
    <div className="border-t border-border bg-card shrink-0">
      <div className="flex items-center gap-1 px-3 py-2.5 sm:px-4">
        <button
          type="button"
          onClick={() => void onToggleLike()}
          disabled={likePending}
          className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold transition-colors min-h-[44px] ${
            liked ? "text-red-500 bg-red-500/10" : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <Heart size={20} className={liked ? "fill-red-500 text-red-500" : ""} />
          <span>{likeCount}</span>
        </button>
        <button
          type="button"
          onClick={() => setCommentsOpen((o) => !o)}
          className="flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold text-muted-foreground hover:bg-muted transition-colors min-h-[44px]"
        >
          <MessageCircle size={20} />
          <span>{commentCount}</span>
        </button>
      </div>

      {commentsOpen && (
        <div className="border-t border-border bg-muted/30 max-h-[min(320px,45vh)] flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/60 bg-card/80">
            <span className="text-xs font-black uppercase tracking-wider text-[#1a3826] dark:text-[#FFC72C]">
              Kommentare
            </span>
            <button
              type="button"
              onClick={() => setCommentsOpen(false)}
              className="p-1.5 rounded-lg hover:bg-muted"
              aria-label="Kommentare schließen"
            >
              <X size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3 min-h-[100px]">
            {loadingComments ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin text-[#1a3826]" size={24} />
              </div>
            ) : comments.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-6">
                Noch keine Kommentare. Schreiben Sie die erste!
              </p>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="flex gap-2">
                  <div className="h-8 w-8 rounded-full bg-[#1a3826] flex items-center justify-center text-xs font-bold text-[#FFC72C] shrink-0 overflow-hidden">
                    {c.userImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.userImage} alt="" className="h-full w-full object-cover" />
                    ) : (
                      (c.userName || "?").charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md bg-background border border-border px-3 py-2 shadow-sm">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs font-bold text-foreground truncate">
                        {c.userName || "Unbekannt"}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          {formatDateTimeDeAt(c.createdAt)}
                        </span>
                        {canDeleteComments && (
                          <button
                            type="button"
                            onClick={() => void onDeleteComment(c.id)}
                            disabled={!!deletingCommentId}
                            className="p-1 rounded-lg hover:bg-muted text-muted-foreground disabled:opacity-50"
                            aria-label="Kommentar löschen"
                            title="Löschen"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-wrap break-words mt-0.5">{c.body}</p>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="p-3 border-t border-border bg-card flex gap-2">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void onSend();
                }
              }}
              placeholder="Kommentar schreiben…"
              className="flex-1 rounded-full border border-input bg-background px-4 py-2.5 text-sm"
              maxLength={2000}
            />
            <button
              type="button"
              onClick={() => void onSend()}
              disabled={sending || !text.trim()}
              className="rounded-full bg-[#1a3826] dark:bg-[#FFC72C] text-[#FFC72C] dark:text-[#1a3826] p-2.5 disabled:opacity-50 min-w-[44px]"
              aria-label="Senden"
            >
              {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
