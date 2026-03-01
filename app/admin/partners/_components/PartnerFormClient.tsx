"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Save, Plus, Trash2, User, Building2, FolderTree, ExternalLink, ImagePlus, Loader2, X, Images, FileText } from "lucide-react";
import {
  createPartner,
  updatePartner,
  uploadPartnerLogo,
  uploadPartnerGalleryImage,
  uploadPartnerPriceListPdf,
  type PartnerContactInput,
} from "@/app/actions/partnerActions";
import { toast } from "sonner";

const contactSchema = z.object({
  contactName: z.string().min(1, "Name ist Pflichtfeld"),
  phone: z.string().optional(),
  email: z.string().optional(),
  role: z.string().optional(),
});

const formSchema = z.object({
  categoryId: z.string().min(1, "Bitte Kategorie wählen"),
  companyName: z.string().min(1, "Firmenname ist Pflichtfeld"),
  logoUrl: z.string().optional(),
  serviceDescription: z.string().optional(),
  notes: z.string().optional(),
  websiteUrl: z.string().optional(),
  priceListPdfUrl: z.string().optional(),
  galleryUrls: z.array(z.string()).default([]),
  contacts: z.array(contactSchema),
});

type FormValues = z.infer<typeof formSchema>;

type CategoryOption = { id: string; name: string };

type PartnerFormClientProps = {
  categories: CategoryOption[];
  initialData?: {
    id: string;
    categoryId: string | null;
    companyName: string;
    logoUrl: string | null;
    serviceDescription: string | null;
    notes: string | null;
    websiteUrl: string | null;
    priceListPdfUrl: string | null;
    galleryUrls: string[];
    contacts: Array<{
      id: string;
      contactName: string;
      phone: string | null;
      email: string | null;
      role: string | null;
    }>;
  } | null;
};

export default function PartnerFormClient({ categories, initialData }: PartnerFormClientProps) {
  const router = useRouter();
  const isEdit = !!initialData?.id;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData
      ? {
          categoryId: initialData.categoryId ?? (categories[0]?.id ?? ""),
          companyName: initialData.companyName,
          logoUrl: initialData.logoUrl ?? "",
          serviceDescription: initialData.serviceDescription ?? "",
          notes: initialData.notes ?? "",
          websiteUrl: initialData.websiteUrl ?? "",
          priceListPdfUrl: initialData.priceListPdfUrl ?? "",
          galleryUrls: initialData.galleryUrls ?? [],
          contacts:
            initialData.contacts.length > 0
              ? initialData.contacts.map((c) => ({
                  contactName: c.contactName,
                  phone: c.phone ?? "",
                  email: c.email ?? "",
                  role: c.role ?? "",
                }))
              : [{ contactName: "", phone: "", email: "", role: "" }],
        }
      : {
          categoryId: categories[0]?.id ?? "",
          companyName: "",
          logoUrl: "",
          serviceDescription: "",
          notes: "",
          websiteUrl: "",
          priceListPdfUrl: "",
          galleryUrls: [],
          contacts: [{ contactName: "", phone: "", email: "", role: "" }],
        },
  });

  const logoUrl = form.watch("logoUrl");
  const galleryUrls = form.watch("galleryUrls");
  const [logoUploading, setLogoUploading] = useState(false);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [pdfUploading, setPdfUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const priceListPdfUrl = form.watch("priceListPdfUrl");

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Bitte ein Bild wählen (z. B. JPG, PNG).");
      return;
    }
    e.target.value = "";
    setLogoUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const result = await uploadPartnerLogo(formData);
      if (result.success) {
        form.setValue("logoUrl", result.url);
        toast.success("Logo wurde hochgeladen.");
      } else {
        toast.error(result.error ?? "Fehler beim Hochladen.");
      }
    } catch {
      toast.error("Fehler beim Hochladen.");
    } finally {
      setLogoUploading(false);
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Bitte nur PDF-Dateien (z. B. Cjenovnik) hochladen.");
      return;
    }
    e.target.value = "";
    setPdfUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const result = await uploadPartnerPriceListPdf(formData);
      if (result.success) {
        form.setValue("priceListPdfUrl", result.url);
        toast.success("Cjenovnik (PDF) wurde hochgeladen.");
      } else {
        toast.error(result.error ?? "Fehler beim Hochladen.");
      }
    } catch {
      toast.error("Fehler beim Hochladen.");
    } finally {
      setPdfUploading(false);
    }
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    if (!imageFiles.length) {
      toast.error("Bitte nur Bilddateien auswählen.");
      return;
    }
    setGalleryUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of imageFiles) {
        const fd = new FormData();
        fd.set("file", file);
        const result = await uploadPartnerGalleryImage(fd);
        if (result.success) {
          uploaded.push(result.url);
        } else {
          toast.error(result.error ?? "Fehler beim Hochladen.");
        }
      }
      if (uploaded.length > 0) {
        const current = form.getValues("galleryUrls") ?? [];
        form.setValue(
          "galleryUrls",
          [...current, ...uploaded],
          { shouldDirty: true },
        );
        toast.success("Galeriebilder wurden hochgeladen.");
      }
    } catch {
      toast.error("Fehler beim Hochladen.");
    } finally {
      setGalleryUploading(false);
    }
  };

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "contacts" });

  const onSubmit = async (values: FormValues) => {
    const contacts: PartnerContactInput[] = values.contacts
      .filter((c) => c.contactName?.trim())
      .map((c) => ({
        contactName: c.contactName.trim(),
        phone: c.phone?.trim() || undefined,
        email: c.email?.trim() || undefined,
        role: c.role?.trim() || undefined,
      }));

    try {
      if (isEdit && initialData?.id) {
        await updatePartner(initialData.id, {
          categoryId: values.categoryId,
          companyName: values.companyName.trim(),
          logoUrl: values.logoUrl?.trim() || null,
          serviceDescription: values.serviceDescription?.trim() || undefined,
          notes: values.notes?.trim() || undefined,
          websiteUrl: values.websiteUrl?.trim() || undefined,
          priceListPdfUrl: values.priceListPdfUrl?.trim() || null,
          galleryUrls: values.galleryUrls ?? [],
          contacts,
        });
        toast.success("Gespeichert.");
      } else {
        await createPartner({
          categoryId: values.categoryId,
          companyName: values.companyName.trim(),
          logoUrl: values.logoUrl?.trim() || null,
          serviceDescription: values.serviceDescription?.trim() || undefined,
          notes: values.notes?.trim() || undefined,
          websiteUrl: values.websiteUrl?.trim() || undefined,
          priceListPdfUrl: values.priceListPdfUrl?.trim() || null,
          galleryUrls: values.galleryUrls ?? [],
          contacts,
        });
        toast.success("Gespeichert.");
      }
      if (typeof window !== "undefined") window.close();
      router.push("/admin/partners");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/30 to-background font-sans text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-8 md:py-12">
        <Link
          href="/admin/partners"
          className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-[#1a3826] dark:hover:text-[#FFC72C] mb-8"
        >
          <ArrowLeft size={18} /> Nazad na listu firmi
        </Link>

        <div className="bg-card rounded-3xl border border-border shadow-xl overflow-hidden">
          <div className="bg-[#1a3826] dark:bg-[#1a3826]/90 px-6 py-6 text-white">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-white/20 flex items-center justify-center">
                <Building2 size={24} />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-black tracking-tight">
                  {isEdit ? "Unternehmen bearbeiten" : "Neues Unternehmen"}
                </h1>
                <p className="text-white/80 text-sm mt-0.5">
                  {isEdit ? "Daten und Kontakte ändern" : "Partner oder Serviceunternehmen hinzufügen"}
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 md:p-8 space-y-8">
            <section className="space-y-4">
              <h2 className="text-sm font-black uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Building2 size={16} /> Stammdaten
              </h2>
              <div className="grid gap-4">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label className="text-sm font-semibold text-foreground">
                      Abteilung (Kategorie) *
                    </label>
                    <Link
                      href="/admin/partners/categories"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1a3826] dark:text-[#FFC72C] hover:underline"
                    >
                      <FolderTree size={14} /> Abteilungen verwalten
                      <ExternalLink size={12} />
                    </Link>
                  </div>
                  <select
                    {...form.register("categoryId")}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground font-medium focus:ring-2 focus:ring-[#1a3826] dark:focus:ring-[#FFC72C] focus:border-transparent transition-shadow"
                  >
                    <option value="">— Abteilung wählen —</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Neue Abteilungen können Sie unter „Abteilungen verwalten“ anlegen oder umbenennen.
                  </p>
                  {form.formState.errors.categoryId && (
                    <p className="text-xs text-red-600 mt-1">{form.formState.errors.categoryId.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">
                    Naziv firme *
                  </label>
                  <input
                    {...form.register("companyName")}
                    placeholder="npr. Tech Support d.o.o."
                    className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-[#1a3826] dark:focus:ring-[#FFC72C] focus:border-transparent"
                  />
                  {form.formState.errors.companyName && (
                    <p className="text-xs text-red-600 mt-1">{form.formState.errors.companyName.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">
                    Logo / Titelbild
                  </label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Wird oben auf der Unternehmenskarte angezeigt (z. B. Logo). Optional.
                  </p>
                  <div className="flex flex-wrap items-start gap-4">
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={handleLogoUpload}
                    />
                    {logoUrl ? (
                      <div className="relative">
                        <div className="w-28 h-28 rounded-xl border border-border overflow-hidden bg-muted flex items-center justify-center shrink-0">
                          <Image
                            src={logoUrl}
                            alt="Logo"
                            width={112}
                            height={112}
                            className="object-contain w-full h-full"
                            unoptimized={logoUrl.includes("blob.vercel-storage.com")}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => form.setValue("logoUrl", "")}
                          className="absolute -top-2 -right-2 p-1.5 rounded-full bg-red-500 text-white shadow hover:bg-red-600"
                          title="Ukloni logo"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={logoUploading}
                      className="inline-flex items-center gap-2 px-4 py-3 rounded-xl border border-dashed border-border text-sm font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
                    >
                      {logoUploading ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
                      {logoUrl ? "Bild ersetzen" : "Logo / Titelbild hinzufügen"}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">
                    Website
                  </label>
                  <input
                    {...form.register("websiteUrl")}
                    placeholder="https://firma.de"
                    className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-[#1a3826] dark:focus:ring-[#FFC72C] focus:border-transparent"
                  />
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Offizielle Website des Unternehmens (optional).
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">
                    Cjenovnik / Preisliste (PDF)
                  </label>
                  <p className="text-xs text-muted-foreground mb-2">
                    PDF-Dokument (z. B. Cjenovnik) wird auf der Detailseite der Firma angezeigt. Optional.
                  </p>
                  <input
                    ref={pdfInputRef}
                    type="file"
                    accept="application/pdf"
                    className="sr-only"
                    onChange={handlePdfUpload}
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    {priceListPdfUrl ? (
                      <>
                        <a
                          href={priceListPdfUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-muted/50 hover:bg-muted text-sm font-medium text-foreground"
                        >
                          <FileText size={18} className="text-red-500 shrink-0" />
                          PDF öffnen
                        </a>
                        <button
                          type="button"
                          onClick={() => form.setValue("priceListPdfUrl", "")}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium"
                        >
                          <X size={16} /> Entfernen
                        </button>
                      </>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => pdfInputRef.current?.click()}
                      disabled={pdfUploading}
                      className="inline-flex items-center gap-2 px-4 py-3 rounded-xl border border-dashed border-border text-sm font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
                    >
                      {pdfUploading ? <Loader2 size={18} className="animate-spin" /> : <FileText size={18} />}
                      {priceListPdfUrl ? "PDF ersetzen" : "Cjenovnik (PDF) hinzufügen"}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">
                    Galerie-Bilder
                  </label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Mehrere Bilder zur Illustration der Leistungen (optional).
                  </p>
                  <input
                    ref={galleryInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="sr-only"
                    onChange={handleGalleryUpload}
                  />
                  <div className="flex flex-wrap items-start gap-4">
                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      disabled={galleryUploading}
                      className="inline-flex items-center gap-2 px-4 py-3 rounded-xl border border-dashed border-border text-sm font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
                    >
                      {galleryUploading ? <Loader2 size={18} className="animate-spin" /> : <Images size={18} />}
                      Galerie-Bilder hinzufügen
                    </button>
                    {galleryUrls && galleryUrls.length > 0 && (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                        {galleryUrls.map((url, idx) => (
                          <div key={`${url}-${idx}`} className="relative">
                            <div className="w-24 h-24 rounded-xl border border-border overflow-hidden bg-muted flex items-center justify-center">
                              <Image
                                src={url}
                                alt={`Galeriebild ${idx + 1}`}
                                width={96}
                                height={96}
                                className="object-cover w-full h-full"
                                unoptimized={url.includes("blob.vercel-storage.com")}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const next = (galleryUrls || []).filter((u, i) => !(u === url && i === idx));
                                form.setValue("galleryUrls", next, { shouldDirty: true });
                              }}
                              className="absolute -top-2 -right-2 p-1.5 rounded-full bg-red-500 text-white shadow hover:bg-red-600"
                              title="Bild entfernen"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">
                    Leistungsbeschreibung
                  </label>
                  <textarea
                    {...form.register("serviceDescription")}
                    placeholder="Kurze Beschreibung der Leistungen des Unternehmens"
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-[#1a3826] dark:focus:ring-[#FFC72C] resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">
                    Anmerkungen
                  </label>
                  <textarea
                    {...form.register("notes")}
                    placeholder="Optionale Anmerkungen"
                    rows={2}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-[#1a3826] dark:focus:ring-[#FFC72C] resize-none"
                  />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <User size={16} /> Ansprechpartner
                </h2>
                <button
                  type="button"
                  onClick={() => append({ contactName: "", phone: "", email: "", role: "" })}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold text-[#1a3826] dark:text-[#FFC72C] hover:bg-[#1a3826]/10 dark:hover:bg-[#FFC72C]/10 transition-colors"
                >
                  <Plus size={18} /> Kontakt hinzufügen
                </button>
              </div>
              <div className="space-y-4">
                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="p-4 rounded-2xl border border-border bg-muted/30 space-y-3"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-muted-foreground">Kontakt {index + 1}</span>
                      {fields.length > 1 && (
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="text-xs text-red-600 hover:underline font-bold"
                        >
                          Ukloni
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        {...form.register(`contacts.${index}.contactName`)}
                        placeholder="Name (Vor- und Nachname) *"
                        className="px-3 py-2.5 rounded-lg border border-border bg-background text-sm"
                      />
                      <input
                        {...form.register(`contacts.${index}.role`)}
                        placeholder="Funktion"
                        className="px-3 py-2.5 rounded-lg border border-border bg-background text-sm"
                      />
                      <input
                        {...form.register(`contacts.${index}.phone`)}
                        placeholder="Telefon"
                        className="px-3 py-2.5 rounded-lg border border-border bg-background text-sm"
                      />
                      <input
                        {...form.register(`contacts.${index}.email`)}
                        placeholder="Email"
                        type="email"
                        className="px-3 py-2.5 rounded-lg border border-border bg-background text-sm"
                      />
                    </div>
                    {form.formState.errors.contacts?.[index]?.contactName && (
                      <p className="text-xs text-red-600">
                        {form.formState.errors.contacts[index]?.contactName?.message}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 border-t border-border">
              <Link
                href="/admin/partners"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-border font-bold text-muted-foreground hover:bg-muted"
              >
                Abbrechen
              </Link>
              <button
                type="submit"
                disabled={form.formState.isSubmitting}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#1a3826] dark:bg-[#FFC72C] dark:text-[#1a3826] text-white font-black shadow-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                <Save size={18} /> {form.formState.isSubmitting ? "Speichern…" : "Speichern"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
