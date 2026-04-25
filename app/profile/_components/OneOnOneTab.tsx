"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import { toast } from "sonner";
import {
  MessageSquare, Plus, X, Loader2, Archive, RotateCcw,
  Trash2, Paperclip, FileText, Image as ImageIcon, Download,
  ChevronLeft, Users, AlertTriangle, CalendarDays, Send,
} from "lucide-react";
import {
  createConversation,
  listMyConversations,
  listSupervisorConversations,
  archiveConversation,
  unarchiveConversation,
  deleteConversation,
  addConversationItem,
  updateConversationItem,
  deleteConversationItem,
  uploadConversationAttachment,
  deleteConversationAttachment,
  listConversationItemComments,
  addConversationItemComment,
  listConversationTodos,
  addConversationTodo,
  toggleConversationTodo,
  deleteConversationTodo,
  listConversationCreateTargets,
  type ConversationRow,
  type ConversationItemRow,
  type ConversationAttachmentRow,
  type ConversationItemCommentRow,
  type ConversationTodoRow,
} from "@/app/actions/conversationActions";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("de-AT", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtDateOnly(d: Date | string) {
  return new Date(d).toLocaleDateString("de-AT", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name.trim().split(/\s+/).map((p) => p[0]).join("").toUpperCase().slice(0, 2);
}

// ─── Comment thread (FB-style) ────────────────────────────────────────────────

function CommentThread({
  itemId,
  currentUserId,
  disabled,
}: {
  itemId: string;
  currentUserId: string;
  disabled: boolean;
}) {
  const [comments, setComments] = useState<ConversationItemCommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  const load = async () => {
    setLoading(true);
    const rows = await listConversationItemComments(itemId);
    setComments(rows);
    setLoading(false);
  };

  useEffect(() => { load(); }, [itemId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() || disabled) return;
    startTransition(async () => {
      const r = await addConversationItemComment(itemId, body);
      if (r.ok && r.comment) {
        setComments((prev) => [...prev, r.comment!]);
        setBody("");
      } else {
        toast.error(r.error ?? "Fehler.");
      }
    });
  };

  return (
    <div className="space-y-2">
      <div className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">
        Kommentare
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-1">
          <Loader2 size={14} className="animate-spin" />
          <span className="text-xs">Laden…</span>
        </div>
      ) : comments.length === 0 ? (
        <p className="text-xs text-muted-foreground italic py-1">Noch keine Kommentare.</p>
      ) : (
        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {comments.map((c) => {
            const isMe = c.authorId === currentUserId;
            return (
              <div key={c.id} className={`flex gap-2.5 ${isMe ? "flex-row-reverse" : ""}`}>
                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-[#1a3826] to-[#0f2218] flex items-center justify-center text-[#FFC72C] text-[9px] font-black shrink-0 overflow-hidden">
                  {c.author.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.author.image} alt="" className="w-full h-full object-cover rounded-full" />
                  ) : initials(c.author.name)}
                </div>
                <div className={`flex-1 min-w-0 ${isMe ? "items-end flex flex-col" : ""}`}>
                  <div className={`rounded-2xl px-3.5 py-2.5 text-sm max-w-[85%] ${isMe ? "bg-[#1a3826] text-white ml-auto" : "bg-muted/60 text-foreground"}`}>
                    <p className="leading-snug whitespace-pre-wrap">{c.body}</p>
                  </div>
                  <p className="text-[9px] text-muted-foreground mt-1 px-1">
                    {c.author.name ?? "?"} · {fmtDate(c.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <form onSubmit={handleAdd} className="flex gap-2 items-end pt-2 border-t border-border/40">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          maxLength={2000}
          disabled={disabled}
          placeholder={disabled ? "Archiviert" : "Kommentar schreiben…"}
          className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1a3826]/20 transition disabled:opacity-70 disabled:cursor-not-allowed"
        />
        <button
          type="submit"
          disabled={disabled || pending || !body.trim()}
          className="p-2.5 rounded-xl bg-[#1a3826] text-[#FFC72C] hover:bg-[#142d1f] transition disabled:opacity-50"
          title="Senden"
        >
          {pending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
        </button>
      </form>
    </div>
  );
}

// ─── Attachment chip ──────────────────────────────────────────────────────────

function AttachmentChip({ a }: { a: ConversationAttachmentRow }) {
  const isImage = a.fileType.startsWith("image/");
  const isPdf = a.fileType === "application/pdf";
  return (
    <a
      href={a.fileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1a3826]/8 dark:bg-[#FFC72C]/8 border border-[#1a3826]/15 dark:border-[#FFC72C]/15 text-[10px] font-bold text-[#1a3826] dark:text-[#FFC72C] hover:opacity-80 transition max-w-[240px]"
      title={a.fileName}
    >
      {isImage ? <ImageIcon size={11} /> : isPdf ? <FileText size={11} /> : <Download size={11} />}
      <span className="truncate">{a.fileName}</span>
    </a>
  );
}

// ─── Conversation Item (Thema) ────────────────────────────────────────────────

function ConversationItemCard({
  item,
  conversationId,
  isArchived,
  isRequester,
  currentUserId,
  onChanged,
}: {
  item: ConversationItemRow;
  conversationId: string;
  isArchived: boolean;
  isRequester: boolean;
  currentUserId: string;
  onChanged: () => void;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [savePending, startSave] = useTransition();
  const [delPending, startDel] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [attPending, startAttTransition] = useTransition();

  const handleSaveTitle = () => {
    if (!title.trim()) return;
    startSave(async () => {
      const r = await updateConversationItem(item.id, { title });
      if (r.ok) { setEditingTitle(false); onChanged(); }
      else toast.error(r.error ?? "Fehler.");
    });
  };

  const handleDelete = () => {
    startDel(async () => {
      const r = await deleteConversationItem(item.id);
      if (r.ok) { toast.success("Thema gelöscht."); onChanged(); }
      else toast.error(r.error ?? "Fehler.");
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const r = await uploadConversationAttachment(fd, { conversationId, itemId: item.id });
    setUploading(false);
    if (r.ok) { toast.success("Datei hochgeladen."); onChanged(); }
    else toast.error(r.error ?? "Fehler.");
    e.target.value = "";
  };

  const handleDeleteAttachment = (attachmentId: string) => {
    startAttTransition(async () => {
      const r = await deleteConversationAttachment(attachmentId);
      if (r.ok) {
        toast.success("Datei entfernt.");
        onChanged();
      } else {
        toast.error(r.error ?? "Fehler.");
      }
    });
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      {/* Title row */}
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          {editingTitle && !isArchived ? (
            <div className="flex gap-2">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                className="flex-1 rounded-xl border border-border bg-background px-3 py-1.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#1a3826]/20"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveTitle();
                  if (e.key === "Escape") { setEditingTitle(false); setTitle(item.title); }
                }}
              />
              <button
                type="button"
                onClick={handleSaveTitle}
                disabled={savePending || !title.trim()}
                className="px-3 py-1.5 rounded-xl bg-[#1a3826] text-[#FFC72C] text-xs font-black disabled:opacity-60"
              >
                {savePending ? <Loader2 size={12} className="animate-spin" /> : "OK"}
              </button>
              <button
                type="button"
                onClick={() => { setEditingTitle(false); setTitle(item.title); }}
                className="px-3 py-1.5 rounded-xl border border-border text-xs font-bold text-muted-foreground"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => !isArchived && setEditingTitle(true)}
              className={`text-sm font-black text-foreground text-left w-full leading-snug ${!isArchived ? "hover:text-[#1a3826] dark:hover:text-[#FFC72C] transition" : ""}`}
              disabled={isArchived}
            >
              {item.title}
            </button>
          )}
          <p className="text-[10px] text-muted-foreground mt-1">
            Hinzugefügt von: <span className="font-bold text-foreground">{item.createdBy?.name ?? "—"}</span>
            {" · "}
            {fmtDate(item.createdAt)}
          </p>
        </div>

        {(isRequester || !isArchived) && !isArchived && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={delPending}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition shrink-0"
            title="Thema löschen"
          >
            {delPending ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
          </button>
        )}
      </div>

      {/* Discussion comments */}
      <CommentThread itemId={item.id} currentUserId={currentUserId} disabled={isArchived} />

      {/* Attachments */}
      {item.attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center">
          {item.attachments.map((a) => (
            <div key={a.id} className="inline-flex items-center gap-1">
              <AttachmentChip a={a} />
              {!isArchived && (
                <button
                  type="button"
                  onClick={() => handleDeleteAttachment(a.id)}
                  disabled={attPending}
                  className="p-1 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition"
                  title="Entfernen"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
          {attPending && <Loader2 size={12} className="animate-spin text-muted-foreground" />}
        </div>
      )}

      {!isArchived && (
        <div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-bold transition"
          >
            {uploading ? <Loader2 size={12} className="animate-spin" /> : <Paperclip size={12} />}
            {uploading ? "Hochladen…" : item.attachments.length > 0 ? "Dokument ersetzen / weitere hochladen" : "Dokument anhängen"}
          </button>
          <input ref={fileRef} type="file" className="hidden" onChange={handleFileUpload} />
        </div>
      )}
    </div>
  );
}

// ─── Conversation Detail View ─────────────────────────────────────────────────

function ConversationDetail({
  conversation,
  userId,
  userRole,
  onBack,
  onChanged,
}: {
  conversation: ConversationRow;
  userId: string;
  userRole: string;
  onBack: () => void;
  onChanged: () => void;
}) {
  const GOD_ROLES = new Set(["SYSTEM_ARCHITECT", "ADMIN"]);
  const isGod = GOD_ROLES.has(userRole);
  const isSupervisor = conversation.supervisorUserId === userId || isGod;
  const isRequester = conversation.requesterUserId === userId || isGod;
  const isArchived = conversation.status === "ARCHIVED";

  const [items, setItems] = useState<ConversationItemRow[]>(conversation.items);
  const [todos, setTodos] = useState<ConversationTodoRow[]>([]);
  const [todosLoading, setTodosLoading] = useState(true);
  const [newTodo, setNewTodo] = useState("");
  const [newThemeTitle, setNewThemeTitle] = useState("");
  const [addPending, startAdd] = useTransition();
  const [archivePending, startArchive] = useTransition();
  const [deletePending, startDelete] = useTransition();
  const [todoPending, startTodoTransition] = useTransition();

  const reload = () => onChanged();

  const loadTodos = async () => {
    setTodosLoading(true);
    const rows = await listConversationTodos(conversation.id);
    setTodos(rows);
    setTodosLoading(false);
  };

  useEffect(() => { loadTodos(); }, [conversation.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newThemeTitle.trim()) return;
    startAdd(async () => {
      const r = await addConversationItem(conversation.id, { title: newThemeTitle.trim() });
      if (r.ok && r.item) {
        setItems((prev) => [...prev, r.item!]);
        setNewThemeTitle("");
      } else {
        toast.error(r.error ?? "Fehler.");
      }
    });
  };

  const handleArchive = () => {
    startArchive(async () => {
      const r = await archiveConversation(conversation.id);
      if (r.ok) { toast.success("Gespräch archiviert."); reload(); onBack(); }
      else toast.error(r.error ?? "Fehler.");
    });
  };

  const handleUnarchive = () => {
    startArchive(async () => {
      const r = await unarchiveConversation(conversation.id);
      if (r.ok) { toast.success("Gespräch wiederhergestellt."); reload(); onBack(); }
      else toast.error(r.error ?? "Fehler.");
    });
  };

  const handleDelete = () => {
    if (!confirm("Gespräch wirklich löschen?")) return;
    startDelete(async () => {
      const r = await deleteConversation(conversation.id);
      if (r.ok) { toast.success("Gespräch gelöscht."); reload(); onBack(); }
      else toast.error(r.error ?? "Fehler.");
    });
  };

  const handleItemChanged = async () => {
    // Re-fetch items by reloading parent and using updated conversation
    onChanged();
  };

  const handleAddTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodo.trim() || isArchived) return;
    startTodoTransition(async () => {
      const r = await addConversationTodo(conversation.id, newTodo);
      if (r.ok && r.todo) {
        setTodos((prev) => [...prev, r.todo!]);
        setNewTodo("");
      } else {
        toast.error(r.error ?? "Fehler.");
      }
    });
  };

  const handleToggleTodo = (todoId: string, completed: boolean) => {
    if (isArchived) return;
    startTodoTransition(async () => {
      const r = await toggleConversationTodo(todoId, completed);
      if (r.ok) {
        setTodos((prev) => prev.map((t) => (t.id === todoId ? { ...t, completed } : t)));
      } else {
        toast.error(r.error ?? "Fehler.");
      }
    });
  };

  const handleDeleteTodo = (todoId: string) => {
    if (isArchived) return;
    startTodoTransition(async () => {
      const r = await deleteConversationTodo(todoId);
      if (r.ok) setTodos((prev) => prev.filter((t) => t.id !== todoId));
      else toast.error(r.error ?? "Fehler.");
    });
  };

  const otherUser = isRequester && !isSupervisor
    ? conversation.supervisor
    : conversation.requester;

  return (
    <div className="space-y-4">
      {/* Back nav */}
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition"
      >
        <ChevronLeft size={14} /> Zurück zur Übersicht
      </button>

      {/* Conversation header */}
      <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#1a3826] to-[#0f2218] flex items-center justify-center text-[#FFC72C] text-xs font-black shrink-0 overflow-hidden">
              {otherUser.image
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={otherUser.image} alt="" className="w-full h-full object-cover" />
                : initials(otherUser.name)
              }
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black text-foreground">{otherUser.name ?? otherUser.email ?? "—"}</p>
              <p className="text-[10px] text-muted-foreground">
                {isSupervisor && !isRequester ? "Mitarbeiter" : "Vorgesetzter"}
              </p>
            </div>
          </div>

          {isArchived ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300/50 shrink-0">
              <Archive size={10} /> Archiviert
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-300/50 shrink-0">
              Aktiv
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
          <div>
            <span className="font-bold text-foreground">Erstellt:</span>{" "}
            {fmtDate(conversation.createdAt)}
          </div>
          {conversation.meetingDate && (
            <div className="flex items-center gap-1">
              <CalendarDays size={11} className="text-[#1a3826] dark:text-[#FFC72C]" />
              <span className="font-bold text-foreground">Termin:</span>{" "}
              {fmtDateOnly(conversation.meetingDate)}
            </div>
          )}
        </div>

        {conversation.notes && (
          <p className="text-xs text-muted-foreground whitespace-pre-wrap">{conversation.notes}</p>
        )}
      </div>

      {/* Themes list */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-black text-muted-foreground uppercase tracking-wider">
            Themen ({items.length})
          </h3>
        </div>

        {items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <MessageSquare size={24} className="mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground font-semibold">Noch keine Themen.</p>
            {!isArchived && (
              <p className="text-xs text-muted-foreground mt-0.5">Füge unten ein erstes Thema hinzu.</p>
            )}
          </div>
        )}

        {items.map((item) => (
          <ConversationItemCard
            key={item.id}
            item={item}
            conversationId={conversation.id}
            isArchived={isArchived}
            isRequester={isRequester}
            currentUserId={userId}
            onChanged={handleItemChanged}
          />
        ))}

        {/* Add theme form */}
        {!isArchived && (
          <form onSubmit={handleAddItem} className="flex gap-2">
            <input
              value={newThemeTitle}
              onChange={(e) => setNewThemeTitle(e.target.value)}
              maxLength={200}
              placeholder="Neues Thema hinzufügen…"
              className="flex-1 rounded-xl border border-border bg-card px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3826]/20 focus:border-[#1a3826] transition"
            />
            <button
              type="submit"
              disabled={addPending || !newThemeTitle.trim()}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-[#1a3826] text-[#FFC72C] text-sm font-black hover:bg-[#142d1f] transition disabled:opacity-60 shrink-0"
            >
              {addPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Thema
            </button>
          </form>
        )}
      </div>

      {/* Actions bar */}
      <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
        {isSupervisor && !isArchived && (
          <button
            type="button"
            onClick={handleArchive}
            disabled={archivePending}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1a3826] text-[#FFC72C] text-xs font-black hover:bg-[#142d1f] transition disabled:opacity-60"
          >
            {archivePending ? <Loader2 size={13} className="animate-spin" /> : <Archive size={13} />}
            Gespräch archivieren
          </button>
        )}
        {isSupervisor && isArchived && (
          <button
            type="button"
            onClick={handleUnarchive}
            disabled={archivePending}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border text-xs font-bold text-muted-foreground hover:bg-muted transition disabled:opacity-60"
          >
            {archivePending ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
            Wiederherstellen
          </button>
        )}
        {isRequester && !isArchived && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deletePending}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs font-bold hover:bg-red-50 dark:hover:bg-red-900/10 transition disabled:opacity-60"
          >
            {deletePending ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            Gespräch löschen
          </button>
        )}
      </div>

      {/* To-Do list */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-black text-muted-foreground uppercase tracking-wider">
            To-Do Liste
          </div>
          {todoPending && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
        </div>

        {todosLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-1">
            <Loader2 size={14} className="animate-spin" />
            <span className="text-xs">Laden…</span>
          </div>
        ) : todos.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Noch keine To-Dos.</p>
        ) : (
          <div className="space-y-2">
            {todos
              .slice()
              .sort((a, b) => Number(a.completed) - Number(b.completed) || a.sortOrder - b.sortOrder)
              .map((t) => (
                <div key={t.id} className="flex items-start gap-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={t.completed}
                    disabled={isArchived}
                    onChange={(e) => handleToggleTodo(t.id, e.target.checked)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${t.completed ? "line-through text-muted-foreground" : "text-foreground"} whitespace-pre-wrap`}>
                      {t.title}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {t.createdBy?.name ?? "?"} · {fmtDate(t.createdAt)}
                    </p>
                  </div>
                  {!isArchived && (
                    <button
                      type="button"
                      onClick={() => handleDeleteTodo(t.id)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition"
                      title="To-Do löschen"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
          </div>
        )}

        {!isArchived && (
          <form onSubmit={handleAddTodo} className="flex gap-2 pt-2 border-t border-border/40">
            <input
              value={newTodo}
              onChange={(e) => setNewTodo(e.target.value)}
              maxLength={200}
              placeholder="+ To-Do hinzufügen…"
              className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3826]/20 transition"
            />
            <button
              type="submit"
              disabled={todoPending || !newTodo.trim()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1a3826] text-[#FFC72C] text-sm font-black hover:bg-[#142d1f] transition disabled:opacity-60"
            >
              <Plus size={14} /> To-Do
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Conversation Card ────────────────────────────────────────────────────────

function ConversationCard({
  conv,
  userId,
  onOpen,
}: {
  conv: ConversationRow;
  userId: string;
  onOpen: () => void;
}) {
  const isRequester = conv.requesterUserId === userId;
  const other = isRequester ? conv.supervisor : conv.requester;
  const isArchived = conv.status === "ARCHIVED";

  return (
    <div
      className={`rounded-2xl border ${isArchived ? "border-border/50 opacity-75" : "border-border"} bg-card shadow-sm hover:shadow-md transition overflow-hidden`}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#1a3826] to-[#0f2218] flex items-center justify-center text-[#FFC72C] text-xs font-black shrink-0 overflow-hidden">
            {other.image
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={other.image} alt="" className="w-full h-full rounded-full object-cover" />
              : initials(other.name)
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-foreground leading-snug">
              {isRequester
                ? `Mit: ${other.name ?? other.email ?? "—"}`
                : `Von: ${other.name ?? other.email ?? "—"}`
              }
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {fmtDate(conv.createdAt)}
              {conv.meetingDate && (
                <> &middot; <CalendarDays size={10} className="inline" /> {fmtDateOnly(conv.meetingDate)}</>
              )}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {conv.items.length > 0
                ? `${conv.items.length} Thema${conv.items.length !== 1 ? "en" : ""}: ${conv.items.map((i) => i.title).slice(0, 2).join(", ")}${conv.items.length > 2 ? "…" : ""}`
                : "Keine Themen"}
            </p>
          </div>
        </div>
      </div>
      <div className="px-4 pb-3 flex items-center gap-2 border-t border-border/40 pt-2.5">
        <button
          type="button"
          onClick={onOpen}
          className="flex-1 py-2 rounded-xl bg-[#1a3826]/8 hover:bg-[#1a3826]/15 dark:bg-[#FFC72C]/8 dark:hover:bg-[#FFC72C]/15 text-[#1a3826] dark:text-[#FFC72C] text-xs font-black transition"
        >
          Öffnen
        </button>
      </div>
    </div>
  );
}

// ─── New Conversation Modal ───────────────────────────────────────────────────

function NewConversationModal({
  supervisorName,
  isGod,
  onClose,
  onCreated,
}: {
  supervisorName: string | null;
  isGod: boolean;
  onClose: () => void;
  onCreated: (conv: ConversationRow) => void;
}) {
  const [meetingDate, setMeetingDate] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();
  const [targets, setTargets] = useState<{ id: string; name: string | null; email: string | null; image: string | null }[]>([]);
  const [targetId, setTargetId] = useState("");

  useEffect(() => {
    if (!isGod) return;
    listConversationCreateTargets().then((rows) => {
      setTargets(rows);
      setTargetId(rows[0]?.id ?? "");
    });
  }, [isGod]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const r = await createConversation({
        meetingDate: meetingDate || undefined,
        notes: notes || undefined,
        withUserId: isGod ? (targetId || undefined) : undefined,
      });
      if (r.ok) {
        toast.success("Gespräch erstellt.");
        onCreated(r.conversation);
        onClose();
      } else {
        toast.error(r.error);
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-card rounded-2xl shadow-2xl border border-border w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 bg-[#1a3826]">
          <div className="flex items-center gap-2.5">
            <MessageSquare size={18} className="text-[#FFC72C]" />
            <span className="text-sm font-black text-white">Neues Gespräch</span>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {supervisorName && (
            <div className="flex items-center gap-2 rounded-xl bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
              <Users size={13} className="shrink-0 text-[#1a3826] dark:text-[#FFC72C]" />
              Gespräch mit: <strong className="text-foreground ml-1">{supervisorName}</strong>
            </div>
          )}

          {isGod && (
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                Gespräch mit (Mitarbeiter)
              </label>
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3826]/20"
              >
                {targets.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name ?? u.email ?? u.id}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground mt-1">
                Als Admin/System Architect wirst du als „Vorgesetzter“ gesetzt.
              </p>
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
              Besuchsdatum (optional)
            </label>
            <input
              type="date"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
              className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3826]/20 focus:border-[#1a3826] transition"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
              Allgemeine Notizen (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Kontext, Anliegen…"
              className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1a3826]/20 focus:border-[#1a3826] transition"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Themen werden nach dem Erstellen hinzugefügt.
          </p>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl border border-border text-sm font-bold text-muted-foreground hover:bg-muted transition">
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1a3826] text-[#FFC72C] text-sm font-black hover:bg-[#142d1f] transition disabled:opacity-60"
            >
              {pending ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
              {pending ? "Erstellen…" : "Gespräch erstellen"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Tab Component ───────────────────────────────────────────────────────

type Props = {
  userId: string;
  userRole: string;
  hasSupervisor: boolean;
  supervisorName: string | null;
  supervisorImage: string | null;
  hasSubordinates: boolean;
  initialOpenTopicId?: string | null;
};

export default function OneOnOneTab({
  userId,
  userRole,
  hasSupervisor,
  supervisorName,
  supervisorImage,
  hasSubordinates,
}: Props) {
  const GOD_ROLES = new Set(["SYSTEM_ARCHITECT", "ADMIN"]);
  const isGod = GOD_ROLES.has(userRole);

  const [activeTab, setActiveTab] = useState<"active" | "archive">("active");
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConv, setSelectedConv] = useState<ConversationRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const canCreate = hasSupervisor || isGod;

  const loadConversations = async () => {
    setLoading(true);
    const archived = activeTab === "archive";
    const [asRequester, asSupervisor] = await Promise.all([
      listMyConversations({ archived }),
      listSupervisorConversations({ archived }),
    ]);
    // Merge and deduplicate
    const seen = new Set<string>();
    const all: ConversationRow[] = [];
    for (const c of [...asRequester, ...asSupervisor]) {
      if (!seen.has(c.id)) { seen.add(c.id); all.push(c); }
    }
    all.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    setConversations(all);
    setLoading(false);
  };

  useEffect(() => { loadConversations(); }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // When a conversation is selected, always use the fresh version
  const openConversation = (conv: ConversationRow) => {
    setSelectedConv(conv);
  };

  const handleChanged = async () => {
    // Reload conversations and update selectedConv if still open
    setLoading(true);
    const archived = activeTab === "archive";
    const [asRequester, asSupervisor] = await Promise.all([
      listMyConversations({ archived }),
      listSupervisorConversations({ archived }),
    ]);
    const seen = new Set<string>();
    const all: ConversationRow[] = [];
    for (const c of [...asRequester, ...asSupervisor]) {
      if (!seen.has(c.id)) { seen.add(c.id); all.push(c); }
    }
    all.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    setConversations(all);
    setLoading(false);

    if (selectedConv) {
      const updated = all.find((c) => c.id === selectedConv.id);
      if (updated) setSelectedConv(updated);
    }
  };

  // ─── Detail view ──────────────────────────────────────────────────────────

  if (selectedConv) {
    return (
      <ConversationDetail
        conversation={selectedConv}
        userId={userId}
        userRole={userRole}
        onBack={() => setSelectedConv(null)}
        onChanged={handleChanged}
      />
    );
  }

  // ─── List view ────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-foreground flex items-center gap-2">
            <MessageSquare size={20} className="text-[#1a3826] dark:text-[#FFC72C]" />
            Gesprächsthemen
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Themen für das nächste Gespräch mit dem Vorgesetzten
          </p>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1a3826] text-[#FFC72C] text-sm font-black hover:bg-[#142d1f] transition shadow-md"
          >
            <Plus size={15} /> Neues Gespräch
          </button>
        )}
      </div>

      {/* No supervisor notice */}
      {!hasSupervisor && !hasSubordinates && !isGod && (
        <div className="rounded-2xl border border-amber-300/60 bg-amber-50/50 dark:bg-amber-900/10 p-5 flex items-start gap-3">
          <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-foreground">Kein Vorgesetzter zugewiesen</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Bitte wende dich an einen Administrator, um deinen Vorgesetzten zuzuweisen.
            </p>
          </div>
        </div>
      )}

      {/* Supervisor info */}
      {supervisorName && activeTab === "active" && (
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-3">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#1a3826] to-[#0f2218] flex items-center justify-center text-[#FFC72C] text-[10px] font-black shrink-0 overflow-hidden">
            {supervisorImage
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={supervisorImage} alt="" className="w-full h-full object-cover" />
              : initials(supervisorName)
            }
          </div>
          <div>
            <p className="text-xs font-bold text-foreground">{supervisorName}</p>
            <p className="text-[10px] text-muted-foreground">Dein direkter Vorgesetzter</p>
          </div>
          <Users size={14} className="ml-auto text-muted-foreground shrink-0" />
        </div>
      )}

      {/* Aktiv / Archiv tabs */}
      <div className="flex rounded-xl border border-border overflow-hidden">
        <button
          type="button"
          onClick={() => setActiveTab("active")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-black transition ${activeTab === "active" ? "bg-[#1a3826] text-[#FFC72C]" : "bg-card text-muted-foreground hover:bg-muted"}`}
        >
          <MessageSquare size={13} /> Aktiv
          {!loading && conversations.length > 0 && activeTab === "active" && (
            <span className="inline-flex h-4 min-w-[16px] px-1 rounded-full text-[9px] font-black items-center justify-center bg-[#FFC72C]/20 text-[#FFC72C]">
              {conversations.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("archive")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-black transition ${activeTab === "archive" ? "bg-[#1a3826] text-[#FFC72C]" : "bg-card text-muted-foreground hover:bg-muted"}`}
        >
          <Archive size={13} /> Archiv
          {!loading && conversations.length > 0 && activeTab === "archive" && (
            <span className="inline-flex h-4 min-w-[16px] px-1 rounded-full text-[9px] font-black items-center justify-center bg-[#FFC72C]/20 text-[#FFC72C]">
              {conversations.length}
            </span>
          )}
        </button>
      </div>

      {/* Conversation list */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Laden…</span>
        </div>
      ) : conversations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <MessageSquare size={32} className="mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm font-semibold text-muted-foreground">
            {activeTab === "archive" ? "Keine archivierten Gespräche." : "Keine aktiven Gespräche."}
          </p>
          {activeTab === "active" && canCreate && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1a3826] text-[#FFC72C] text-xs font-black hover:bg-[#142d1f] transition"
            >
              <Plus size={13} /> Erstes Gespräch erstellen
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {conversations.map((conv) => (
            <ConversationCard
              key={conv.id}
              conv={conv}
              userId={userId}
              onOpen={() => openConversation(conv)}
            />
          ))}
        </div>
      )}

      {/* New Conversation Modal */}
      {createOpen && (
        <NewConversationModal
          supervisorName={supervisorName}
          isGod={isGod}
          onClose={() => setCreateOpen(false)}
          onCreated={(conv) => {
            setConversations((prev) => [conv, ...prev]);
            setSelectedConv(conv);
          }}
        />
      )}
    </div>
  );
}
