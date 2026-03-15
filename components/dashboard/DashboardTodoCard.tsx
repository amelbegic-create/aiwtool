"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Plus, ListTodo, Flag, X } from "lucide-react";
import { addTodo, toggleTodo, type TodoItem } from "@/app/actions/todoActions";

type Props = {
  userId: string;
  initialTodos: TodoItem[];
};

const MAX_VISIBLE = 4;

const PRIORITY_LABELS: Record<number, string> = { 1: "Hoch", 2: "Mittel", 3: "Niedrig" };
const PRIORITY_DOT = (p: number) =>
  p === 1 ? "bg-amber-400" : p === 2 ? "bg-[#FFC72C]/90" : "bg-white/50";

export default function DashboardTodoCard({ userId, initialTodos }: Props) {
  const [todos, setTodos] = useState<TodoItem[]>(() =>
    initialTodos.filter((t) => !t.completed)
  );
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<number>(2);
  const [loading, setLoading] = useState(false);

  const handleAddFromModal = async () => {
    const t = newTitle.trim();
    if (!t || loading) return;
    setLoading(true);
    try {
      const added = await addTodo(userId, t, newPriority);
      if (added) {
        setTodos((prev) => [...prev, added].sort((a, b) => a.priority - b.priority));
        closeAddModal();
      }
    } finally {
      setLoading(false);
    }
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    setNewTitle("");
  };

  const handleToggle = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    const ok = await toggleTodo(id);
    if (ok) setTodos((prev) => prev.filter((item) => item.id !== id));
  };

  const visible = todos.slice(0, MAX_VISIBLE);
  const hasMore = todos.length > MAX_VISIBLE;

  return (
    <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-[#1a3826] to-[#0a1f14] p-4 flex flex-col gap-3 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 min-h-[140px] h-full">
      <div className="absolute right-3 top-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-white/5 pointer-events-none" />
      <div className="absolute -right-2 -top-2 w-16 h-16 rounded-full bg-[#FFC72C]/10 blur-xl pointer-events-none" />

      <header className="relative z-10 shrink-0 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
            <ListTodo size={16} className="text-[#FFC72C]" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-black text-white leading-tight">Meine Aufgaben</h3>
            <p className="text-xs text-white/70 leading-tight">Aufgaben & Notizen</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="shrink-0 flex items-center justify-center w-9 h-9 rounded-lg bg-[#FFC72C] text-[#1a3826] hover:opacity-90 transition-opacity font-bold"
          aria-label="Neue Aufgabe"
        >
          <Plus size={16} />
        </button>
      </header>

      <div className="relative z-10 flex-1 min-h-0 flex flex-col">
        <ul className="max-h-[6.5rem] overflow-y-auto overflow-x-hidden space-y-0.5 min-h-0">
          {visible.length === 0 ? (
            <li className="text-xs text-white/60 py-1">Noch keine offenen Aufgaben.</li>
          ) : (
            visible.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-2 py-1 cursor-pointer group/item rounded hover:bg-white/5 transition-colors"
                onClick={(e) => handleToggle(e, item.id)}
              >
                <span className="shrink-0 w-3.5 h-3.5 rounded border-2 border-white/40 group-hover/item:border-[#FFC72C] flex items-center justify-center transition-colors">
                  <span className="w-1.5 h-1.5 rounded-sm bg-transparent" />
                </span>
                <span
                  className={`h-1.5 w-1.5 rounded-full shrink-0 ${PRIORITY_DOT(item.priority)}`}
                  title={PRIORITY_LABELS[item.priority] ?? "Mittel"}
                  aria-hidden
                />
                <span className="flex-1 min-w-0 text-xs text-white truncate leading-tight">
                  {item.title}
                </span>
              </li>
            ))
          )}
          {hasMore && (
            <li className="text-[10px] text-white/50 py-0.5 pl-5">
              +{todos.length - MAX_VISIBLE} weitere
            </li>
          )}
        </ul>
      </div>

      <footer className="relative z-10 shrink-0 pt-2 border-t border-white/10 mt-auto">
        <Link
          href="/tools/todo"
          className="flex items-center gap-1.5 text-sm font-bold text-[#FFC72C] hover:opacity-80 transition-opacity"
        >
          Liste öffnen <ChevronRight size={14} />
        </Link>
      </footer>

      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-xl shadow-xl border border-border w-full max-w-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="font-bold text-foreground uppercase">Neue Aufgabe</h3>
              <button
                type="button"
                onClick={closeAddModal}
                className="text-muted-foreground hover:text-foreground p-1"
                aria-label="Schließen"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Aufgabe *</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="z.B. Bericht erstellen"
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-[#1a3826]/30"
                  disabled={loading}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddFromModal())}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1 flex items-center gap-1.5">
                  <Flag size={12} /> Priorität
                </label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(Number(e.target.value))}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-[#1a3826]/30"
                >
                  <option value={1}>Hoch</option>
                  <option value={2}>Mittel</option>
                  <option value={3}>Niedrig</option>
                </select>
              </div>
            </div>
            <div className="p-4 border-t border-border flex justify-end gap-2">
              <button
                type="button"
                onClick={closeAddModal}
                className="px-4 py-2 rounded-lg border border-border hover:bg-muted text-sm font-medium"
              >
                Schließen
              </button>
              <button
                type="button"
                onClick={handleAddFromModal}
                disabled={loading || !newTitle.trim()}
                className="px-4 py-2 rounded-lg bg-[#1a3826] dark:bg-[#FFC72C] dark:text-[#1a3826] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Wird hinzugefügt…" : "Hinzufügen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
