"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Lightbulb, Check, FileText, Image as ImageIcon } from "lucide-react";
import { markIdeaAsRead } from "@/app/actions/ideaActions";
import type { IdeaWithUser } from "@/app/actions/ideaActions";

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getRestaurantName(idea: IdeaWithUser): string {
  const first = idea.user.restaurants?.[0]?.restaurant?.name;
  return first ?? "–";
}

export default function IdeenboxClient({ initialIdeas }: { initialIdeas: IdeaWithUser[] }) {
  const router = useRouter();
  const [markingId, setMarkingId] = useState<string | null>(null);

  const handleMarkAsRead = async (id: string) => {
    setMarkingId(id);
    try {
      const result = await markIdeaAsRead(id);
      if (result.ok) router.refresh();
    } finally {
      setMarkingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8 font-sans text-foreground">
      <div className="max-w-[1200px] mx-auto space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-[#1a3826] dark:text-[#FFC72C] uppercase tracking-tighter flex items-center gap-2">
              <Lightbulb size={28} className="text-yellow-500" />
              Ideenbox
            </h1>
            <p className="text-muted-foreground text-xs font-semibold mt-0.5">
              Vorschläge von Mitarbeitern – als gelesen markieren
            </p>
          </div>
        </div>

        {initialIdeas.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">
            Noch keine Ideen eingegangen.
          </div>
        ) : (
          <div className="space-y-3">
            {initialIdeas.map((idea) => (
              <div
                key={idea.id}
                className={`rounded-2xl border overflow-hidden transition-colors ${
                  idea.isRead
                    ? "border-border bg-card"
                    : "border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30"
                }`}
              >
                <div className="p-4 md:p-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                      <span className={idea.isRead ? "font-medium text-foreground" : "font-bold text-foreground"}>
                        {idea.user.name ?? idea.user.email ?? "Unbekannt"}
                      </span>
                      <span className="text-muted-foreground">{getRestaurantName(idea)}</span>
                      <span className="text-muted-foreground tabular-nums">{formatDate(idea.createdAt)}</span>
                    </div>
                    <p
                      className={`mt-2 text-sm whitespace-pre-wrap ${
                        idea.isRead ? "text-muted-foreground" : "text-foreground font-medium"
                      }`}
                    >
                      {idea.text}
                    </p>

                    {/* NOVO: galerija slika + PDF blok */}
                    {(idea.imageUrls?.length ?? 0) > 0 && (
                      <div className="mt-3 space-y-1 text-xs">
                        <p className="font-semibold text-muted-foreground">Bilder</p>
                        <div className="flex flex-wrap gap-2">
                          {idea.imageUrls.map((url, idx) => (
                            <a
                              key={url}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="relative block w-20 h-16 rounded-lg overflow-hidden border border-border bg-muted hover:ring-2 hover:ring-emerald-500/70 transition-all"
                              title={idea.imageNames?.[idx] ?? undefined}
                            >
                              <Image
                                src={url}
                                alt={idea.imageNames?.[idx] ?? `Bild ${idx + 1}`}
                                fill
                                sizes="80px"
                                className="object-cover"
                                unoptimized={url.includes("blob.vercel-storage.com")}
                              />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {(idea.pdfUrl || idea.attachmentUrl) && (
                      <div className="mt-3 flex items-center gap-3 text-xs">
                        <a
                          href={idea.pdfUrl || idea.attachmentUrl || "#"}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-dashed border-border hover:bg-muted text-foreground font-semibold"
                        >
                          <FileText size={14} className="text-blue-600" />
                          <span
                            className="truncate max-w-[220px]"
                            title={idea.pdfName ?? idea.attachmentName ?? undefined}
                          >
                            {idea.pdfName || idea.attachmentName || "PDF öffnen"}
                          </span>
                        </a>
                        {typeof (idea.pdfSize ?? idea.attachmentSize) === "number" &&
                          (idea.pdfSize ?? idea.attachmentSize)! > 0 && (
                            <span className="text-muted-foreground">
                              {(((idea.pdfSize ?? idea.attachmentSize) as number) / (1024 * 1024)).toFixed(1)} MB
                            </span>
                          )}
                      </div>
                    )}
                  </div>
                  {!idea.isRead && (
                    <button
                      type="button"
                      onClick={() => handleMarkAsRead(idea.id)}
                      disabled={markingId === idea.id}
                      className="shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-[#1a3826] dark:bg-[#FFC72C] text-white dark:text-[#1a3826] hover:opacity-90 disabled:opacity-50"
                    >
                      <Check size={14} />
                      {markingId === idea.id ? "…" : "Als gelesen markieren"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
