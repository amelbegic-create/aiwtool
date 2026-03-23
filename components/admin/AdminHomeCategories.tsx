import Link from "next/link";
import { ChevronDown, ChevronRight, type LucideIcon } from "lucide-react";
import {
  TAG_STYLES,
  type AdminCard,
  type AdminCategoryBlock,
  type AdminCategoryId,
} from "@/components/admin/adminHomeTypes";

/** Zwei unabhängige Spalten: links Personal+Finanzen, rechts Restaurant+Sonstiges – kein gemeinsames Grid-Zeilen-Höhe */
const COLUMN_LEFT: readonly AdminCategoryId[] = ["personal", "finance"];
const COLUMN_RIGHT: readonly AdminCategoryId[] = ["restaurant", "other"];

function blocksForColumn(visible: AdminCategoryBlock[], order: readonly AdminCategoryId[]) {
  const byId = new Map(visible.map((b) => [b.id, b]));
  return order.map((id) => byId.get(id)).filter((b): b is AdminCategoryBlock => b != null);
}

function AdminModuleRow({ card }: { card: AdminCard }) {
  const Icon = card.icon;
  const badge = typeof card.badge === "number" ? card.badge : 0;
  const style =
    TAG_STYLES[card.tag] ??
    "from-[#1a3826]/12 via-[#1a3826]/8 to-[#1a3826]/5 text-[#1a3826] dark:text-[#FFC72C] border-border";

  return (
    <li>
      <Link
        href={card.href}
        className="group/row relative flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 transition-colors hover:border-[#1a3826]/15 hover:bg-[#1a3826]/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a3826] focus-visible:ring-offset-1 dark:hover:bg-[#FFC72C]/10 dark:focus-visible:ring-[#FFC72C]"
      >
        {badge > 0 && (
          <span className="absolute right-10 top-2 z-10 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#1a3826]/12 bg-gradient-to-br ${style}`}
        >
          <Icon className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0">
            <span className="text-sm font-semibold text-[#1a3826] dark:text-foreground">{card.title}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[#1a3826]/60 dark:text-muted-foreground">
              {card.tag}
            </span>
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground line-clamp-2">{card.desc}</p>
        </div>
        <ChevronRight
          className="h-4 w-4 shrink-0 text-[#1a3826]/40 transition-opacity group-hover/row:text-[#1a3826] group-hover/row:opacity-100 dark:text-[#FFC72C]/50 dark:group-hover/row:text-[#FFC72C]"
          aria-hidden
        />
      </Link>
    </li>
  );
}

function CategoryEmpty({
  title,
  message,
  Icon,
}: {
  title: string;
  message: string;
  Icon: LucideIcon;
}) {
  return (
    <div
      className="rounded-lg border border-dashed border-[#1a3826]/25 bg-[#FFC72C]/[0.08] px-5 py-7 text-center dark:border-[#FFC72C]/25 dark:bg-[#FFC72C]/5"
      role="status"
    >
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-[#1a3826] text-[#FFC72C]">
        <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
      </div>
      <p className="text-sm font-bold text-[#1a3826] dark:text-[#FFC72C]">{title}</p>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{message}</p>
    </div>
  );
}

function AdminCategorySection({ block }: { block: AdminCategoryBlock }) {
  const SectionIcon = block.icon;
  const sectionHeadingId = `admin-cat-${block.id}-heading`;
  const hasModules = block.cards.length > 0;

  if (!block.alwaysShow && !hasModules) {
    return null;
  }

  const countLabel = hasModules
    ? `${block.cards.length} ${block.cards.length === 1 ? "Modul" : "Module"}`
    : block.id === "finance"
      ? "Demnächst"
      : "Keine Module";

  return (
    <details className="admin-category-details overflow-hidden rounded-xl border-2 border-[#1a3826]/15 bg-card shadow-[0_2px_12px_rgba(26,56,38,0.06)] dark:border-[#1a3826]/30 dark:shadow-[0_2px_16px_rgba(0,0,0,0.25)]">
      <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-4 transition-colors hover:bg-[#1a3826]/[0.04] dark:hover:bg-[#FFC72C]/[0.06] [&::-webkit-details-marker]:hidden">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#FFC72C] text-[#1a3826] shadow-sm ring-1 ring-[#1a3826]/10 dark:ring-[#1a3826]/30"
          aria-hidden
        >
          <SectionIcon className="h-6 w-6" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1 text-left">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2
              id={sectionHeadingId}
              className="text-base font-black tracking-tight text-[#1a3826] dark:text-[#FFC72C]"
            >
              {block.title}
            </h2>
            <span className="shrink-0 rounded-full bg-[#1a3826] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#FFC72C]">
              {countLabel}
            </span>
          </div>
          <p className="mt-1.5 text-sm leading-snug text-muted-foreground line-clamp-2">{block.description}</p>
        </div>
        <ChevronDown
          className="admin-category-chevron h-5 w-5 shrink-0 text-[#1a3826] dark:text-[#FFC72C]"
          aria-hidden
        />
      </summary>

      <div className="border-t-2 border-[#1a3826]/10 bg-[#1a3826]/[0.02] px-3 pb-3 pt-2 dark:border-[#FFC72C]/15 dark:bg-transparent">
        {hasModules ? (
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {block.cards.map((c) => (
              <AdminModuleRow key={c.href} card={c} />
            ))}
          </ul>
        ) : block.id === "finance" ? (
          <CategoryEmpty
            Icon={SectionIcon}
            title="Demnächst"
            message="Finanzmodule werden hier erscheinen, sobald sie verfügbar sind."
          />
        ) : (
          <CategoryEmpty
            Icon={SectionIcon}
            title="Keine Einträge"
            message="Sobald Sie Berechtigungen für Dashboard-Einstellungen haben, erscheinen diese hier."
          />
        )}
      </div>
    </details>
  );
}

export function AdminHomeCategories({ blocks }: { blocks: AdminCategoryBlock[] }) {
  const visible = blocks.filter((b) => b.alwaysShow || b.cards.length > 0);
  const leftCol = blocksForColumn(visible, COLUMN_LEFT);
  const rightCol = blocksForColumn(visible, COLUMN_RIGHT);

  const renderBlock = (block: AdminCategoryBlock) => (
    <AdminCategorySection key={block.id} block={block} />
  );

  return (
    <div>
      <h2 className="mb-5 text-lg font-black tracking-tight text-[#1a3826] dark:text-[#FFC72C]">
        Bereiche &amp; Module
      </h2>

      {/* Schmal: Reihenfolge wie bisher (Personal → Restaurant → …) */}
      <div className="mx-auto flex max-w-6xl flex-col gap-4 md:hidden">
        {visible.map(renderBlock)}
      </div>

      {/* Breit: zwei unabhängige Spalten – Höhe der rechten Karte drückt die linke Spalte nicht nach unten */}
      <div className="mx-auto hidden max-w-6xl gap-6 md:flex md:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-4 lg:gap-5">{leftCol.map(renderBlock)}</div>
        <div className="flex min-w-0 flex-1 flex-col gap-4 lg:gap-5">{rightCol.map(renderBlock)}</div>
      </div>
    </div>
  );
}
