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
        aria-haspopup="listbox"
        onClick={() => {
          if (disabled) return;
          setOpen((o) => {
            if (!o && selected) setQuery(getOptionLabel(selected));
            return !o;
          });
        }}
        className={`flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-left transition-colors focus-within:ring-2 focus-within:ring-[#1a3826]/20 focus-within:border-[#1a3826] ${
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
          className="flex-1 bg-transparent text-slate-900 outline-none placeholder:text-slate-400 min-w-0"
          aria-autocomplete="list"
          aria-controls="combobox-listbox"
        />
        <div className="flex shrink-0 items-center gap-1">
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="rounded p-1 hover:bg-slate-100 text-slate-500"
              aria-label="Obriši odabir"
            >
              <X size={16} />
            </button>
          )}
          <ChevronDown
            size={18}
            className={`text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </div>
      </div>
      {open && (
        <ul
          id="combobox-listbox"
          role="listbox"
          className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-sm text-slate-500">Nema rezultata</li>
          ) : (
            filtered.map((opt) => (
              <li
                key={opt.id}
                role="option"
                aria-selected={value === opt.id}
                onClick={() => handleSelect(opt.id)}
                className={`cursor-pointer px-4 py-3 text-sm transition-colors hover:bg-[#1a3826]/5 ${
                  value === opt.id ? "bg-[#1a3826]/10 font-medium text-[#1a3826]" : "text-slate-800"
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
