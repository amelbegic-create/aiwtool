"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Lightbulb, X, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { submitIdea } from "@/app/actions/ideaActions";

export default function DeineIdeeButton() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imageLabel, setImageLabel] = useState<string>("Keine Bilder ausgewählt");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfLabel, setPdfLabel] = useState<string>("Kein PDF ausgewählt");
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);

  const handleImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) {
      setImageFiles([]);
      setImageLabel("Keine Bilder ausgewählt");
      return;
    }
    const maxBytes = 10 * 1024 * 1024;
    const valid: File[] = [];
    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        toast.error("Nur Bilddateien sind als Bilder erlaubt.");
        continue;
      }
      if (file.size > maxBytes) {
        toast.error(`Bild "${file.name}" ist zu groß (max. 10 MB).`);
        continue;
      }
      valid.push(file);
    }
    e.target.value = "";
    if (valid.length === 0) {
      setImageFiles([]);
      setImageLabel("Keine Bilder ausgewählt");
      return;
    }
    setImageFiles(valid);
    setImageLabel(valid.length === 1 ? valid[0].name : `${valid.length} Bilder ausgewählt`);
  };

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setPdfFile(null);
      setPdfLabel("Kein PDF ausgewählt");
      return;
    }
    const maxBytes = 10 * 1024 * 1024;
    const type = file.type || "";
    const isPdf = type === "application/pdf" || type.endsWith("/pdf");
    if (!isPdf) {
      toast.error("Bitte nur PDF-Dateien als Dokument hochladen.");
      e.target.value = "";
      return;
    }
    if (file.size > maxBytes) {
      toast.error("Die PDF-Datei ist zu groß (max. 10 MB).");
      e.target.value = "";
      return;
    }
    e.target.value = "";
    setPdfFile(file);
    setPdfLabel(file.name);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("text", trimmed);
      imageFiles.forEach((file) => formData.append("images", file));
      if (pdfFile) formData.set("pdf", pdfFile);
      const result = await submitIdea(formData);
      if (result.ok) {
        toast.success("Danke für deine Idee!");
        setText("");
        setImageFiles([]);
        setImageLabel("Keine Bilder ausgewählt");
        setPdfFile(null);
        setPdfLabel("Kein PDF ausgewählt");
        setOpen(false);
      } else {
        toast.error(result.error ?? "Fehler beim Senden.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const modal = open && typeof document !== "undefined" && (
    createPortal(
      <div
        className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm overflow-y-auto flex items-center justify-center p-4"
        onClick={() => setOpen(false)}
        role="dialog"
        aria-modal="true"
        aria-label="Deine Idee / Wünsche / Feedback"
      >
        <div
          className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6 border-b border-border flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-black text-foreground flex items-center gap-2 leading-tight">
              <Lightbulb className="text-yellow-500 shrink-0" size={24} />
              <span>Deine Idee / Wünsche / Feedback</span>
            </h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-2 rounded-lg hover:bg-muted"
              aria-label="Schließen"
            >
              <X size={20} />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Beschreibe deine Idee hier..."
              rows={5}
              className="w-full p-3 rounded-xl border border-border bg-background text-foreground text-sm outline-none focus:ring-2 focus:ring-[#1a3826] dark:focus:ring-[#FFC72C] resize-y min-h-[120px]"
              disabled={submitting}
            />
            <div className="space-y-3 text-xs text-muted-foreground">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={submitting}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-muted/60 hover:bg-muted text-xs font-semibold"
                  >
                    <Paperclip size={14} />
                    Bilder auswählen
                  </button>
                  <span className="truncate max-w-[180px]" title={imageLabel}>{imageLabel}</span>
                </div>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImagesChange}
                />
              </div>
              <div>
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => pdfInputRef.current?.click()}
                    disabled={submitting}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-muted/60 hover:bg-muted text-xs font-semibold"
                  >
                    <Paperclip size={14} />
                    PDF hinzufügen
                  </button>
                  <span className="truncate max-w-[180px]" title={pdfLabel}>{pdfLabel}</span>
                </div>
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={handlePdfChange}
                />
              </div>
              <p>Optional: Du kannst mehrere Bilder und ein PDF bis jeweils 10 MB hinzufügen.</p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold border border-border hover:bg-muted"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={submitting || !text.trim()}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-[#1a3826] dark:bg-[#FFC72C] text-white dark:text-[#1a3826] hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? "Wird gesendet…" : "Idee absenden"}
              </button>
            </div>
          </form>
        </div>
      </div>,
      document.body
    )
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center justify-center h-11 w-11 md:h-14 md:w-14 rounded-xl bg-white hover:bg-white/95 border-2 border-white/80 text-[#FFC72C] transition-all shadow-md"
        title="Deine Idee / Wünsche / Feedback"
        aria-label="Deine Idee / Wünsche / Feedback"
      >
        <Lightbulb size={25} strokeWidth={2} className="md:w-7 md:h-7" />
      </button>
      {modal}
    </>
  );
}
