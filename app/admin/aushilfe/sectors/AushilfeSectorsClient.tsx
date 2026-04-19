"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Pencil, Check, X, HandHelping } from "lucide-react";
import { toast } from "sonner";
import {
  createAushilfeCustomSector,
  updateAushilfeCustomSector,
  deleteAushilfeCustomSector,
} from "@/app/actions/aushilfeActions";

type Restaurant = { id: string; code: string; name: string | null };
type Sector = { id: string; key: string; label: string; group: string; sortOrder: number };

function slugify(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

function SectorRow({
  sector,
  onDeleted,
  onUpdated,
}: {
  sector: Sector;
  onDeleted: (id: string) => void;
  onUpdated: (id: string, label: string, group: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(sector.label);
  const [group, setGroup] = useState(sector.group);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    if (!label.trim()) return;
    startTransition(async () => {
      const res = await updateAushilfeCustomSector(sector.id, {
        label: label.trim(),
        group: group.trim() || "Sonstiges",
      });
      if (res.success) {
        toast.success("Gespeichert.");
        onUpdated(sector.id, label.trim(), group.trim() || "Sonstiges");
        setEditing(false);
      } else {
        toast.error(res.error ?? "Fehler.");
      }
    });
  }

  function handleDelete() {
    if (!confirm(`Sektor „${sector.label}" wirklich löschen?`)) return;
    startTransition(async () => {
      const res = await deleteAushilfeCustomSector(sector.id);
      if (res.success) {
        toast.success("Gelöscht.");
        onDeleted(sector.id);
      } else {
        toast.error(res.error ?? "Fehler.");
      }
    });
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="rounded-lg bg-[#1a3826]/8 px-2.5 py-1 font-mono text-xs text-[#1a3826]">
          {sector.key}
        </span>
        {editing ? (
          <>
            <input
              type="text"
              value={label}
              onChange={e => setLabel(e.target.value)}
              className="flex-1 rounded-lg border-2 border-[#1a3826] px-2.5 py-1 text-sm font-semibold text-gray-800 outline-none"
              maxLength={60}
              autoFocus
            />
            <input
              type="text"
              value={group}
              onChange={e => setGroup(e.target.value)}
              placeholder="Gruppe"
              className="w-28 rounded-lg border-2 border-gray-200 px-2.5 py-1 text-sm text-gray-600 outline-none"
              maxLength={40}
            />
          </>
        ) : (
          <>
            <span className="font-semibold text-gray-900">{sector.label}</span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">{sector.group}</span>
          </>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {editing ? (
          <>
            <button
              type="button"
              onClick={handleSave}
              disabled={pending || !label.trim()}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-white transition hover:bg-emerald-600 disabled:opacity-40"
            >
              <Check size={15} />
            </button>
            <button
              type="button"
              onClick={() => { setLabel(sector.label); setGroup(sector.group); setEditing(false); }}
              disabled={pending}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-50"
            >
              <X size={15} />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setEditing(true)}
              disabled={pending}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:border-[#1a3826] hover:text-[#1a3826]"
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={pending}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-100 text-red-400 transition hover:border-red-300 hover:bg-red-50"
            >
              <Trash2 size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function AushilfeSectorsClient({
  initialSectors,
  restaurants,
  defaultRestaurantId,
}: {
  initialSectors: Sector[];
  restaurants: Restaurant[];
  defaultRestaurantId: string;
}) {
  const [selectedRestId, setSelectedRestId] = useState(defaultRestaurantId);
  const [sectors, setSectors] = useState<Sector[]>(initialSectors);
  const [newLabel, setNewLabel] = useState("");
  const [newGroup, setNewGroup] = useState("");
  const [pending, startTransition] = useTransition();

  function handleRestaurantChange(id: string) {
    setSelectedRestId(id);
    // Reload sectors for selected restaurant via form submit pattern
    startTransition(async () => {
      const res = await fetch(`/admin/aushilfe/sectors?restaurantId=${id}`, {
        method: "GET",
      });
      // Navigate to same page with query param to reload server data
      window.location.href = `/admin/aushilfe/sectors?restaurantId=${id}`;
    });
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newLabel.trim()) return;
    const slug = slugify(newLabel);
    startTransition(async () => {
      const res = await createAushilfeCustomSector({
        restaurantId: selectedRestId,
        key: slug,
        label: newLabel.trim(),
        group: newGroup.trim() || "Sonstiges",
      });
      if (res.success) {
        toast.success("Sektor hinzugefügt.");
        setNewLabel("");
        setNewGroup("");
        // Refresh list
        window.location.href = `/admin/aushilfe/sectors?restaurantId=${selectedRestId}`;
      } else {
        toast.error(res.error ?? "Fehler.");
      }
    });
  }

  const selectedRest = restaurants.find(r => r.id === selectedRestId);
  const restLabel = selectedRest
    ? `${selectedRest.name ?? ""} (${selectedRest.code})`.trim()
    : "";

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6 font-sans md:p-8">
      <div className="mx-auto max-w-3xl space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1a3826]">
              <HandHelping size={24} className="text-[#FFC72C]" />
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight text-[#1a3826]">
                Aushilfe <span className="text-[#FFC72C]">Sektoren</span>
              </h1>
              <p className="text-sm text-gray-500">Besondere Arbeitsbereiche pro Restaurant</p>
            </div>
          </div>
        </div>

        {/* Restaurant selector */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-gray-500">
            Restaurant
          </label>
          <select
            value={selectedRestId}
            onChange={e => handleRestaurantChange(e.target.value)}
            className="w-full rounded-xl border-2 border-gray-200 px-3 py-2.5 text-sm font-semibold text-gray-800 outline-none focus:border-[#1a3826]"
          >
            {restaurants.map(r => (
              <option key={r.id} value={r.id}>
                {r.name ? `${r.name} (${r.code})` : r.code}
              </option>
            ))}
          </select>
        </div>

        {/* Create new sector */}
        <div className="rounded-2xl border border-[#FFC72C]/30 bg-[#1a3826]/[0.04] p-4">
          <p className="mb-3 text-xs font-black uppercase tracking-wider text-[#1a3826]/70">
            Neuen Sektor hinzufügen
          </p>
          <form onSubmit={handleCreate} className="flex flex-wrap gap-2">
            <input
              type="text"
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              placeholder="Bezeichnung *"
              maxLength={60}
              required
              className="flex-1 min-w-[160px] rounded-xl border-2 border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-300 outline-none focus:border-[#1a3826]"
            />
            <input
              type="text"
              value={newGroup}
              onChange={e => setNewGroup(e.target.value)}
              placeholder="Gruppe (optional)"
              maxLength={40}
              className="w-36 rounded-xl border-2 border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-600 placeholder:text-gray-300 outline-none focus:border-[#1a3826]"
            />
            <button
              type="submit"
              disabled={pending || !newLabel.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-[#1a3826] px-4 py-2.5 text-sm font-black text-[#FFC72C] transition hover:opacity-90 disabled:opacity-40"
            >
              <Plus size={15} /> Hinzufügen
            </button>
          </form>
          {newLabel.trim() && (
            <p className="mt-1.5 text-[11px] text-gray-400">
              Schlüssel: <span className="font-mono font-bold text-gray-600">{slugify(newLabel)}</span>
            </p>
          )}
        </div>

        {/* Sector list */}
        <div>
          <p className="mb-3 text-xs font-black uppercase tracking-wider text-gray-400">
            Besondere Sektoren für {restLabel} ({sectors.length})
          </p>
          {sectors.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-gray-200 py-10 text-center">
              <p className="text-sm text-gray-400">
                Keine besonderen Sektoren. Standard-Stationen (Ausgabe, Küche, Lobby …) sind immer verfügbar.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {sectors.map(s => (
                <SectorRow
                  key={s.id}
                  sector={s}
                  onDeleted={id => setSectors(prev => prev.filter(x => x.id !== id))}
                  onUpdated={(id, lbl, grp) =>
                    setSectors(prev =>
                      prev.map(x => x.id === id ? { ...x, label: lbl, group: grp } : x)
                    )
                  }
                />
              ))}
            </div>
          )}
        </div>

        {/* Info note */}
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-700">
          <strong>Hinweis:</strong> Standard-Stationen aus dem Produktivitätsmodul (Ausgabe, Küche, Lobby, McCafé,
          Drive, Getränke, Kasse, T.Serv., Pommes, SF Prod.) werden automatisch in der Aushilfe-Auswahl angezeigt.
          Benutzerdefinierte Stationen aus Produktivität werden ebenfalls übernommen.
          Hier können Sie zusätzliche, restaurantspezifische Bereiche definieren.
        </div>
      </div>
    </div>
  );
}
