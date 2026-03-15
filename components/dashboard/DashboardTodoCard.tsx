"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Plus, ListTodo, Flag } from "lucide-react";
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
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<number>(2);
  const [loading, setLoading] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = newTitle.trim();
    if (!t || loading) return;
    setLoading(true);
    setNewTitle("");
    try {
      const added = await addTodo(userId, t, newPriority);
      if (added) setTodos((prev) => [...prev, added].sort((a, b) => a.priority - b.priority));
    } finally {
      setLoading(false);
    }
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
    <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-[#1a3826] to-[#0a1f14] p-4 flex flex-col gap-3 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 min-h-0 h-full">
      <div className="absolute right-3 top-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-white/5 pointer-events-none" />
      <div className="absolute -right-2 -top-2 w-16 h-16 rounded-full bg-[#FFC72C]/10 blur-xl pointer-events-none" />

      <header className="relative z-10 shrink-0 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
          <ListTodo size={16} className="text-[#FFC72C]" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-black text-white leading-tight">Meine Aufgaben</h3>
          <p className="text-xs text-white/70 leading-tight">Aufgaben & Notizen</p>
        </div>
      </header>

      <form onSubmit={handleAdd} className="relative z-10 flex flex-col gap-2 shrink-0">
        <div className="flex gap-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Neue Aufgabe..."
            className="flex-1 min-w-0 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/50 outline-none focus:ring-2 focus:ring-[#FFC72C]/50 focus:border-[#FFC72C]/50"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !newTitle.trim()}
            className="shrink-0 flex items-center justify-center w-9 h-9 rounded-lg bg-[#FFC72C] text-[#1a3826] hover:opacity-90 disabled:opacity-50 transition-opacity font-bold"
            aria-label="Hinzufügen"
          >
            <Plus size={16} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Flag size={12} className="text-white/60 shrink-0" />
          <select
            value={newPriority}
            onChange={(e) => setNewPriority(Number(e.target.value))}
            className="rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-xs text-white outline-none focus:ring-1 focus:ring-[#FFC72C]/50"
          >
            <option value={1} className="bg-[#0a1f14] text-white">Hoch</option>
            <option value={2} className="bg-[#0a1f14] text-white">Mittel</option>
            <option value={3} className="bg-[#0a1f14] text-white">Niedrig</option>
          </select>
        </div>
      </form>

      <ul className="relative z-10 flex-1 min-h-0 overflow-auto space-y-1">
        {visible.length === 0 ? (
          <li className="text-sm text-white/60 py-1">Noch keine offenen Aufgaben.</li>
        ) : (
          visible.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-2 py-1.5 cursor-pointer group/item rounded-lg hover:bg-white/5 transition-colors"
              onClick={(e) => handleToggle(e, item.id)}
            >
              <span className="shrink-0 w-4 h-4 rounded border-2 border-white/40 group-hover/item:border-[#FFC72C] flex items-center justify-center transition-colors">
                <span className="w-2 h-2 rounded-sm bg-transparent" />
              </span>
              <span
                className={`h-2 w-2 rounded-full shrink-0 ${PRIORITY_DOT(item.priority)}`}
                title={PRIORITY_LABELS[item.priority] ?? "Mittel"}
                aria-hidden
              />
              <span className="flex-1 min-w-0 text-sm text-white truncate">
                {item.title}
              </span>
            </li>
          ))
        )}
        {hasMore && (
          <li className="text-xs text-white/50 py-0.5 pl-6">
            +{todos.length - MAX_VISIBLE} weitere
          </li>
        )}
      </ul>

      <footer className="relative z-10 shrink-0 pt-2 border-t border-white/10">
        <Link
          href="/tools/todo"
          className="flex items-center gap-1.5 text-sm font-bold text-[#FFC72C] hover:opacity-80 transition-opacity"
        >
          Liste öffnen <ChevronRight size={13} />
        </Link>
      </footer>
    </div>
  );
}
