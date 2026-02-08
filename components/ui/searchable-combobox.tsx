"use client";

import { useRef, useEffect, useState } from "react";
import { ChevronDown, X } from "lucide-react";

export interface SearchableComboboxOption {
  id: string;
  label: string;
  subtitle?: string;
}

interface SearchableComboboxProps {
  value: string | null;
  onChange: (id: string | null) => void;
  options: SearchableComboboxOption[];
  placeholder?: string;
  getOptionLabel?: (opt: SearchableComboboxOption) => string;
  className?: string;
  disabled?: boolean;
  error?: string;
}

function defaultGetLabel(opt: SearchableComboboxOption) {
  return opt.subtitle ? `${opt.label} • ${opt.subtitle}` : opt.label;
}

export function SearchableCombobox({
  value,
  onChange,
  options,
  placeholder = "Pretraži ili odaberi…",
  getOptionLabel = defaultGetLabel,
  className = "",
  disabled = false,
  error,
}: SearchableComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.id === value);
  const displayValue = selected ? getOptionLabel(selected) : "";

  const filtered = !query.trim()
    ? options
    : options.filter((o) => {
        const text = `${o.label} ${o.subtitle || ""}`.toLowerCase();
        return text.includes(query.toLowerCase());
      });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (id: string) => {
    onChange(id);
    setQuery("");
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    setQuery("");
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? "combobox-listbox" : undefined}
        aria-haspopup="listbox"
        onClick={() => {
          if (disabled) return;
          setOpen((o) => {
            if (!o && selected) setQuery(getOptionLabel(selected));
            return !o;
          });
        }}
        className={`flex min-h-[44px] items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors focus-within:ring-2 focus-within:ring-[#1a3826]/20 focus-within:border-[#1a3826] ${
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
        } ${error ? "border-red-300" : ""}`}
      >
        <input
          type="text"
          value={open ? query : displayValue}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={!open}
          className="flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground min-w-0"
          aria-autocomplete="list"
          aria-controls="combobox-listbox"
        />
        <div className="flex shrink-0 items-center gap-1">
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="rounded p-1 hover:bg-accent text-muted-foreground"
              aria-label="Obriši odabir"
            >
              <X size={16} />
            </button>
          )}
          <ChevronDown
            size={18}
            className={`text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          />
        </div>
      </div>
      {open && (
        <ul
          id="combobox-listbox"
          role="listbox"
          className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-card py-1 shadow-lg"
        >
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-sm text-muted-foreground">Nema rezultata</li>
          ) : (
            filtered.map((opt) => (
              <li
                key={opt.id}
                role="option"
                aria-selected={value === opt.id}
                onClick={() => handleSelect(opt.id)}
                className={`cursor-pointer px-4 py-3 text-sm transition-colors hover:bg-[#1a3826]/5 dark:hover:bg-[#FFC72C]/10 ${
                  value === opt.id ? "bg-[#1a3826]/10 dark:bg-[#FFC72C]/20 font-medium text-[#1a3826] dark:text-[#FFC72C]" : "text-foreground"
                }`}
              >
                {getOptionLabel(opt)}
              </li>
            ))
          )}
        </ul>
      )}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}
