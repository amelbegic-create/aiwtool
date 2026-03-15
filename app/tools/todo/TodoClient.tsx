"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Plus, Trash2, ListTodo, Flag } from "lucide-react";
import { addTodo, toggleTodo, deleteTodo, type TodoItem } from "@/app/actions/todoActions";

const PRIORITY_LABELS: Record<number, string> = { 1: "Hoch", 2: "Mittel", 3: "Niedrig" };
const priorityOrder = (a: TodoItem, b: TodoItem) =>
  (a.priority ?? 2) - (b.priority ?? 2) || a.order - b.order;

export default function TodoClient({
  userId,
  initialTodos,
}: {
  userId: string;
  initialTodos: TodoItem[];
}) {
  const [todos, setTodos] = useState<TodoItem[]>(initialTodos);
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
      if (added) setTodos((prev) => [...prev, added].sort(priorityOrder));
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (id: string) => {
    const ok = await toggleTodo(id);
    if (ok) {
      setTodos((prev) =>
        prev.map((item) => (item.id === id ? { ...item, completed: !item.completed } : item))
      );
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await deleteTodo(id);
    if (ok) setTodos((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/dashboard"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#1a3826]/20 dark:border-[#FFC72C]/30 text-[#1a3826] dark:text-[#FFC72C] hover:bg-[#1a3826]/5 dark:hover:bg-[#FFC72C]/10"
          aria-label="Zurück"
        >
          <ChevronLeft size={18} />
        </Link>
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1a3826]/10 dark:bg-[#FFC72C]/10">
            <ListTodo size={18} className="text-[#1a3826] dark:text-[#FFC72C]" />
          </div>
          <h1 className="text-xl font-black text-foreground">Meine Aufgaben</h1>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <form onSubmit={handleAdd} className="p-3 border-b border-border space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Neue Aufgabe..."
              className="flex-1 min-w-0 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#FFBC0D]/50 focus:border-[#1a3826]/50 dark:focus:border-[#FFC72C]/50"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !newTitle.trim()}
              className="flex items-center gap-1.5 rounded-xl bg-[#1a3826] dark:bg-[#FFC72C] text-white dark:text-[#1a3826] px-4 py-2 text-sm font-bold hover:opacity-90 disabled:opacity-50"
            >
              <Plus size={16} />
              Hinzufügen
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Flag size={14} className="text-muted-foreground" />
            <select
              value={newPriority}
              onChange={(e) => setNewPriority(Number(e.target.value))}
              className="rounded-lg border border-border bg-background px-2 py-1 text-sm text-foreground"
            >
              <option value={1}>Hoch</option>
              <option value={2}>Mittel</option>
              <option value={3}>Niedrig</option>
            </select>
          </div>
        </form>

        <ul className="divide-y divide-border">
          {todos.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-muted-foreground">
              Noch keine Aufgaben. Fügen Sie eine hinzu.
            </li>
          ) : (
            todos.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors"
              >
                <button
                  type="button"
                  onClick={() => handleToggle(item.id)}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 border-[#1a3826]/40 dark:border-[#FFC72C]/40 focus:outline-none focus:ring-2 focus:ring-[#FFBC0D]/50"
                  aria-label={item.completed ? "Als offen markieren" : "Als erledigt markieren"}
                >
                  {item.completed && (
                    <span className="h-2.5 w-2.5 rounded-sm bg-[#1a3826] dark:bg-[#FFC72C]" />
                  )}
                </button>
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    (item.priority ?? 2) === 1
                      ? "bg-amber-500"
                      : (item.priority ?? 2) === 2
                        ? "bg-[#FFC72C]"
                        : "bg-muted-foreground/60"
                  }`}
                  title={PRIORITY_LABELS[item.priority ?? 2]}
                  aria-hidden
                />
                <span
                  className={`flex-1 min-w-0 text-sm ${
                    item.completed
                      ? "text-muted-foreground line-through"
                      : "text-foreground"
                  }`}
                >
                  {item.title}
                </span>
                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:bg-red-100 hover:text-[#DA291C] dark:hover:bg-red-950/30 dark:hover:text-[#DA291C] transition-colors"
                  aria-label="Löschen"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
