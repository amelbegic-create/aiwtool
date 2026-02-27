"use client";

import { useRef, useState } from "react";
import { Lightbulb, ChevronRight, X, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { submitIdea } from "@/app/actions/ideaActions";

export default function DeineIdeeCard() {
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

    const maxBytes = 10 * 1024 * 1024; // 10 MB po fajlu
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
    setImageLabel(
      valid.length === 1 ? valid[0].name : `${valid.length} Bilder ausgewählt`
    );
  };

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setPdfFile(null);
      setPdfLabel("Kein PDF ausgewählt");
      return;
    }

    const maxBytes = 10 * 1024 * 1024; // 10 MB
    const type = file.type || "";
    const isPdf = type === "application/pdf" || type.endsWith("/pdf");

    if (!isPdf) {
      toast.error("Bitte nur PDF-Dateien als Dokument hochladen.");
      e.target.value = "";
      setPdfFile(null);
      setPdfLabel("Kein PDF ausgewählt");
      return;
    }

    if (file.size > maxBytes) {
      toast.error("Die PDF-Datei ist zu groß (max. 10 MB).");
      e.target.value = "";
      setPdfFile(null);
      setPdfLabel("Kein PDF ausgewählt");
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
      imageFiles.forEach((file) => {
        formData.append("images", file);
      });
      if (pdfFile) {
        formData.set("pdf", pdfFile);
      }
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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group block w-full h-full text-left rounded-2xl md:rounded-3xl overflow-hidden border border-amber-200/60 dark:border-amber-500/30 bg-gradient-to-br from-amber-50 via-yellow-50/50 to-amber-100/80 dark:from-amber-950/50 dark:via-yellow-950/30 dark:to-amber-900/40 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 p-6 md:p-8 min-h-[180px]"
      >
        <div className="flex flex-col h-full justify-between">
          <div className="flex items-start justify-between">
            <div className="h-14 w-14 md:h-16 md:w-16 rounded-2xl bg-gradient-to-br from-yellow-400 to-amber-500 text-[#1a3826] flex items-center justify-center shadow-md group-hover:scale-105 transition-transform duration-300">
              <Lightbulb size={28} strokeWidth={2} className="md:w-8 md:h-8 text-yellow-600" />
            </div>
          </div>
          <div>
            <p className="text-lg md:text-xl font-black text-[#1a3826] dark:text-amber-100 uppercase tracking-tight">
              Deine Idee
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Hast du eine Idee zur Verbesserung? Lass es uns wissen!
            </p>
          </div>
          <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[#1a3826] dark:text-amber-300 group-hover:gap-3 transition-all">
            Idee einreichen <ChevronRight size={16} />
          </span>
        </div>
      </button>

       {open && (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="min-h-full w-full flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="p-6 border-b border-border flex items-center justify-between">
                <h2 className="text-xl font-black text-foreground flex items-center gap-2">
                  <Lightbulb className="text-yellow-500" size={24} />
                  Deine Idee
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
                       <span className="truncate max-w-[180px]" title={imageLabel}>
                         {imageLabel}
                       </span>
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
                       <span className="truncate max-w-[180px]" title={pdfLabel}>
                         {pdfLabel}
                       </span>
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
          </div>
        </div>
      )}
    </>
  );
}
