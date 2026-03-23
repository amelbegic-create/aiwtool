"use client";

import { useState, useId, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, Pencil, Trash2, GripVertical } from "lucide-react";
import {
  createDepartment,
  updateDepartment,
  deleteDepartment,
  reorderDepartments,
} from "@/app/actions/departmentActions";
import { toast } from "sonner";

interface DepartmentItem {
  id: string;
  name: string;
  color: string;
  restaurantId?: string | null;
  sortOrder?: number;
}

interface RestaurantItem {
  id: string;
  name: string | null;
  code: string;
}

interface DepartmentsClientProps {
  departments: DepartmentItem[];
  restaurants: RestaurantItem[];
}

function SortableDepartmentRow({
  d,
  children,
  disabled,
}: {
  d: DepartmentItem;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: d.id,
    disabled: !!disabled,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-lg border border-gray-200 p-2 ${isDragging ? "opacity-60 shadow-md z-10 bg-white" : ""}`}
    >
      <button
        type="button"
        className="p-1.5 rounded-lg text-slate-400 hover:bg-gray-100 hover:text-slate-600 cursor-grab active:cursor-grabbing touch-none shrink-0"
        title="Zum Sortieren ziehen"
        aria-label="Zum Sortieren ziehen"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={18} />
      </button>
      {children}
    </li>
  );
}

export default function DepartmentsClient({ departments, restaurants }: DepartmentsClientProps) {
  const dndId = useId();
  const [departmentsList, setDepartmentsList] = useState<DepartmentItem[]>(departments);
  const [newDeptName, setNewDeptName] = useState("");
  const [newDeptColor, setNewDeptColor] = useState("#1a3826");
  const [isCreatingDept, setIsCreatingDept] = useState(false);

  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [editDeptName, setEditDeptName] = useState("");
  const [editDeptColor, setEditDeptColor] = useState("#1a3826");
  const [isUpdatingDept, setIsUpdatingDept] = useState(false);
  const [isDeletingDeptId, setIsDeletingDeptId] = useState<string | null>(null);
  const [isReordering, setIsReordering] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const sortableIds = departmentsList.filter((d) => d.id !== editingDeptId).map((d) => d.id);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = departmentsList.findIndex((x) => x.id === active.id);
      const newIndex = departmentsList.findIndex((x) => x.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return;

      const previous = departmentsList;
      const newOrder = arrayMove(departmentsList, oldIndex, newIndex);
      setDepartmentsList(newOrder);
      setIsReordering(true);
      try {
        const res = await reorderDepartments(newOrder.map((x) => x.id));
        if (!res.success) {
          setDepartmentsList(previous);
          toast.error(res.error ?? "Reihenfolge speichern fehlgeschlagen.");
        }
      } catch (err: unknown) {
        setDepartmentsList(previous);
        toast.error(err instanceof Error ? err.message : "Reihenfolge speichern fehlgeschlagen.");
      } finally {
        setIsReordering(false);
      }
    },
    [departmentsList]
  );

  const startEdit = (d: DepartmentItem) => {
    setEditingDeptId(d.id);
    setEditDeptName(d.name);
    setEditDeptColor(d.color);
  };

  const cancelEdit = () => {
    setEditingDeptId(null);
    setEditDeptName("");
    setEditDeptColor("#1a3826");
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newDeptName.trim();
    if (!name) return;
    setIsCreatingDept(true);
    try {
      const res = await createDepartment({ name, color: newDeptColor });
      if (res.success && res.data) {
        toast.success("Gespeichert.");
        setDepartmentsList((prev) => [
          ...prev,
          {
            id: res.data.id,
            name: res.data.name,
            color: res.data.color,
            sortOrder: res.data.sortOrder,
            restaurantId: null,
          },
        ]);
        setNewDeptName("");
        setNewDeptColor("#1a3826");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Erstellen der Abteilung.");
    } finally {
      setIsCreatingDept(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDeptId) return;
    const name = editDeptName.trim();
    if (!name) return;
    setIsUpdatingDept(true);
    try {
      const current = departmentsList.find((d) => d.id === editingDeptId);
      await updateDepartment({
        id: editingDeptId,
        name,
        color: editDeptColor,
        restaurantId: current?.restaurantId ?? null,
      });
      setDepartmentsList((prev) =>
        prev.map((d) => (d.id === editingDeptId ? { ...d, name, color: editDeptColor } : d))
      );
      cancelEdit();
      toast.success("Gespeichert.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Aktualisieren der Abteilung.");
    } finally {
      setIsUpdatingDept(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        "Sind Sie sicher, dass Sie diese Abteilung löschen möchten? Benutzer mit dieser Abteilung haben danach keine Abteilung mehr."
      )
    )
      return;
    setIsDeletingDeptId(id);
    try {
      const res = await deleteDepartment(id);
      if (res.success) {
        setDepartmentsList((prev) => prev.filter((d) => d.id !== id));
        toast.success("Abteilung gelöscht.");
      } else {
        toast.error(res.error ?? "Fehler beim Löschen der Abteilung.");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Löschen der Abteilung.");
    } finally {
      setIsDeletingDeptId(null);
    }
  };

  const resolveRestaurantLabel = (dept: DepartmentItem) => {
    if (!dept.restaurantId) return "Global";
    const r = restaurants.find((x) => x.id === dept.restaurantId);
    if (!r) return "Unbekannt";
    const name = r.name && r.name.trim() !== "" ? r.name : r.code;
    return name || r.code;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Abteilungen</h2>
          <p className="text-sm text-slate-600 mt-1">
            Verwalten Sie Abteilungen, die Sie Benutzern im Dropdown „Abteilung“ zuordnen können. Reihenfolge per
            Ziehen am Griff links ändern – gilt in Filtern und Dropdowns.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Liste vorhandener Abteilungen */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4">
            Vorhandene Abteilungen
          </h3>
          {departmentsList.length === 0 ? (
            <p className="text-sm text-slate-500">Noch keine Abteilungen angelegt.</p>
          ) : (
            <DndContext
              id={dndId}
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                <ul className={`space-y-2 max-h-[420px] overflow-y-auto pr-1 ${isReordering ? "pointer-events-none opacity-70" : ""}`}>
                  {departmentsList.map((d) =>
                    editingDeptId === d.id ? (
                      <li key={d.id} className="flex items-center gap-2 rounded-lg border border-gray-200 p-2 pl-3">
                        <form onSubmit={handleUpdate} className="flex-1 flex flex-wrap items-center gap-2">
                          <input
                            value={editDeptName}
                            onChange={(e) => setEditDeptName(e.target.value)}
                            className="flex-1 min-w-0 min-h-[36px] px-3 py-1.5 rounded border border-gray-300 text-sm focus:ring-2 focus:ring-[#1a3826] focus:border-[#1a3826]"
                            placeholder="Name"
                            required
                          />
                          <input
                            type="color"
                            value={editDeptColor}
                            onChange={(e) => setEditDeptColor(e.target.value)}
                            className="h-8 w-10 rounded border border-gray-300 cursor-pointer"
                            title="Farbe"
                          />
                          <button
                            type="submit"
                            disabled={isUpdatingDept}
                            className="px-3 py-1.5 rounded-lg text-sm font-bold bg-[#1a3826] text-white hover:bg-[#142d1f] disabled:opacity-50"
                          >
                            {isUpdatingDept ? "…" : "Speichern"}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-gray-100"
                            title="Abbrechen"
                          >
                            ✕
                          </button>
                        </form>
                      </li>
                    ) : (
                      <SortableDepartmentRow key={d.id} d={d}>
                        <>
                          <span
                            className="inline-block w-4 h-4 rounded flex-shrink-0"
                            style={{ backgroundColor: d.color }}
                            title={d.color}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-slate-800 truncate">{d.name}</div>
                            <div className="text-xs text-slate-400">Zuständig für: {resolveRestaurantLabel(d)}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => startEdit(d)}
                            className="p-2 rounded-lg text-slate-500 hover:bg-gray-100 hover:text-[#1a3826]"
                            title="Abteilung bearbeiten"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(d.id)}
                            disabled={isDeletingDeptId === d.id}
                            className="p-2 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                            title="Abteilung löschen"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      </SortableDepartmentRow>
                    )
                  )}
                </ul>
              </SortableContext>
            </DndContext>
          )}
        </div>

        {/* Neue Abteilung */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4">
            Neue Abteilung anlegen
          </h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Name
              </label>
              <input
                value={newDeptName}
                onChange={(e) => setNewDeptName(e.target.value)}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#1a3826] focus:border-[#1a3826]"
                placeholder="z. B. Buchhaltung, Office"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Farbe (HEX)
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={newDeptColor}
                  onChange={(e) => setNewDeptColor(e.target.value)}
                  className="h-10 w-14 rounded border border-gray-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={newDeptColor}
                  onChange={(e) => setNewDeptColor(e.target.value)}
                  className="flex-1 min-h-[44px] px-4 py-2.5 rounded-lg border border-gray-300 font-mono text-sm focus:ring-2 focus:ring-[#1a3826] focus:border-[#1a3826]"
                  placeholder="#1a3826"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isCreatingDept}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold bg-[#1a3826] text-white hover:bg-[#142d1f] disabled:opacity-50"
            >
              {isCreatingDept ? (
                "Erstellen…"
              ) : (
                <>
                  <Plus size={16} />
                  Abteilung anlegen
                </>
              )}
            </button>
            <p className="text-[11px] text-muted-foreground mt-3">
              Abteilungen können später Benutzern auf der Benutzer-Seite zugeordnet werden. Änderungen wirken sich
              sofort auf alle zugeordneten Benutzer aus.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
