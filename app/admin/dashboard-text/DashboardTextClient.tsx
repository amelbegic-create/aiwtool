"use client";

import { useState, useTransition } from "react";
import { Loader2, Check, Bold, Italic, List, ListOrdered, Heading1, Heading2 } from "lucide-react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { updateDashboardChangelog } from "@/app/actions/dashboardChangelogActions";
import type { ChangelogEntry } from "@/app/actions/dashboardChangelogActions";
import { toast } from "sonner";

type Props = {
  initial: ChangelogEntry | null;
};

function Toolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null;
  const btn = "p-2.5 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:border-[#1a3826] dark:hover:border-[#FFC72C] hover:text-[#1a3826] dark:hover:text-[#FFC72C] transition-colors";
  const active = "bg-[#1a3826]/10 dark:bg-[#FFC72C]/20 border-[#1a3826] dark:border-[#FFC72C] text-[#1a3826] dark:text-[#FFC72C]";
  return (
    <div className="flex flex-wrap items-center gap-1.5 p-3 border-b border-border bg-muted/40 rounded-t-2xl">
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={`${btn} ${editor.isActive("bold") ? active : ""}`}
        title="Fett"
      >
        <Bold size={18} />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={`${btn} ${editor.isActive("italic") ? active : ""}`}
        title="Kursiv"
      >
        <Italic size={18} />
      </button>
      <span className="w-px h-6 bg-border mx-0.5" />
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={`${btn} ${editor.isActive("heading", { level: 1 }) ? active : ""}`}
        title="Überschrift 1"
      >
        <Heading1 size={18} />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={`${btn} ${editor.isActive("heading", { level: 2 }) ? active : ""}`}
        title="Überschrift 2"
      >
        <Heading2 size={18} />
      </button>
      <span className="w-px h-6 bg-border mx-0.5" />
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={`${btn} ${editor.isActive("bulletList") ? active : ""}`}
        title="Aufzählung"
      >
        <List size={18} />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={`${btn} ${editor.isActive("orderedList") ? active : ""}`}
        title="Nummerierte Liste"
      >
        <ListOrdered size={18} />
      </button>
    </div>
  );
}

export default function DashboardTextClient({ initial }: Props) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<"saved" | "error" | null>(null);

  const editor = useEditor({
    extensions: [StarterKit],
    content: initial?.content?.trim() || "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "min-h-[calc(100vh-280px)] px-6 py-5 focus:outline-none text-[15px] leading-relaxed",
      },
    },
  });

  const handleSave = () => {
    if (!editor) return;
    startTransition(async () => {
      const html = editor.getHTML();
      const res = await updateDashboardChangelog(html);
      if (res.ok) {
        setMessage("saved");
        setTimeout(() => setMessage(null), 3000);
        toast.success("Gespeichert.");
      } else {
        setMessage("error");
        setTimeout(() => setMessage(null), 5000);
        toast.error("Fehler beim Speichern.");
      }
    });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] min-h-[400px] rounded-2xl border border-border bg-card shadow-lg overflow-hidden">
      <Toolbar editor={editor} />
      <div className="flex-1 overflow-auto border-t border-border">
        <EditorContent editor={editor} />
      </div>
      <div className="flex items-center gap-4 px-6 py-4 border-t border-border bg-muted/30 shrink-0">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1a3826] text-white text-sm font-bold hover:bg-[#142e1e] disabled:opacity-60 transition-colors"
        >
          {isPending ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
          Speichern
        </button>
        {message === "saved" && (
          <span className="text-sm font-bold text-green-600">Gespeichert. Er erscheint jetzt auf der Startseite.</span>
        )}
        {message === "error" && (
          <span className="text-sm font-bold text-red-500">Fehler beim Speichern.</span>
        )}
      </div>
      {initial?.updatedAt && (
        <div className="px-6 py-2.5 border-t border-border text-xs font-bold text-muted-foreground uppercase tracking-wider">
          Letzte Aktualisierung: {new Date(initial.updatedAt).toLocaleDateString("de-AT")}
          {initial.updatedByName ? ` · von ${initial.updatedByName}` : ""}
        </div>
      )}
    </div>
  );
}
