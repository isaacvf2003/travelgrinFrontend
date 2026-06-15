"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useTranslation } from "@/app/hooks/useTranslation";

type CountryApi = {
  name: { common: string };
  cca2: string;
  translations?: { spa?: { common: string } };
  flags?: { svg?: string; png?: string };
};

type Country = CountryApi & { spanishName: string };

type Props = {
  label: string;
  selected?: string[];
  onChange?: (countries: string[]) => void;
  selectedSingle?: string;
  onSingleChange?: (country: string) => void;
  selectionMode?: "multiple" | "single";
  compact?: boolean;
  showLabel?: boolean;
  placeholder?: string;
  disabled?: boolean;
};

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();

export default function CountryMultiSelect({
  label,
  selected = [],
  onChange,
  selectedSingle = "",
  onSingleChange,
  selectionMode = "multiple",
  compact = false,
  showLabel = true,
  placeholder,
  disabled,
}: Props) {
  const { t } = useTranslation();
  const [countries, setCountries] = useState<Country[]>([]);
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/countries")
      .then((res) => res.json())
      .then((payload) => {
        if (!active) return;
        const data = (Array.isArray(payload?.items) ? payload.items : []) as CountryApi[];
        const mapped = data.map((country) => ({
          ...country,
          spanishName: country.translations?.spa?.common || country.name.common,
        }));
        mapped.sort((a, b) => a.spanishName.localeCompare(b.spanishName));
        setCountries(mapped);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const selectedNormalized = useMemo(() => {
    if (selectionMode === "single") {
      return new Set(selectedSingle ? [normalize(selectedSingle)] : []);
    }
    return new Set(selected.map((c) => normalize(c)));
  }, [selectionMode, selected, selectedSingle]);

  const filtered = useMemo(() => {
    const term = normalize(search);
    if (!term) return countries;
    return countries.filter(
      (country) =>
        normalize(country.spanishName).includes(term) ||
        normalize(country.name.common).includes(term)
    );
  }, [countries, search]);

  const toggleCountry = (country: Country) => {
    if (disabled) return;
    const label = country.spanishName;
    if (selectionMode === "single") {
      if (selectedNormalized.has(normalize(label))) {
        onSingleChange?.("");
        setIsOpen(false);
        return;
      }
      onSingleChange?.(label);
      setIsOpen(false);
      return;
    }

    if (!onChange) return;
    if (selectedNormalized.has(normalize(label))) {
      onChange(selected.filter((c) => normalize(c) !== normalize(label)));
      return;
    }
    onChange([...selected, label].sort((a, b) => a.localeCompare(b)));
  };

  const selectedDetails = useMemo(() => {
    const selectedItems =
      selectionMode === "single"
        ? (selectedSingle ? [selectedSingle] : [])
        : selected;
    if (!selectedItems.length || !countries.length) return [];
    const byName = new Map<string, Country>();
    countries.forEach((c) => {
      byName.set(normalize(c.spanishName), c);
      byName.set(normalize(c.name.common), c);
    });
    return selectedItems.map((name) => ({
      name,
      flag: byName.get(normalize(name))?.flags?.svg || byName.get(normalize(name))?.flags?.png,
    }));
  }, [countries, selected, selectedSingle, selectionMode]);

  return (
    <div className="relative rounded-2xl border border-slate-200 bg-white p-4">
      {showLabel ? <div className="text-sm font-medium text-slate-700">{label}</div> : null}

      {compact ? (
        <button
          type="button"
          className="mt-3 flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left text-sm text-slate-700"
          onClick={() => setIsOpen((prev) => !prev)}
          disabled={disabled}
        >
          <span className="truncate">
            {selectedDetails[0]?.name || placeholder || t("buscar_pais")}
          </span>
          <span className="ml-2 text-xs text-slate-500">{isOpen ? "▲" : "▼"}</span>
        </button>
      ) : null}

      {selectedDetails.length && !compact ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {selectedDetails.map((country) => (
            <button
              key={country.name}
              type="button"
              className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700"
              onClick={() => {
                if (selectionMode === "single") {
                  onSingleChange?.("");
                  return;
                }
                onChange?.(selected.filter((c) => normalize(c) !== normalize(country.name)));
              }}
              disabled={disabled}
            >
              {country.flag ? (
                <Image src={country.flag} alt={`flag ${country.name}`} width={18} height={12} />
              ) : null}
              <span>{country.name}</span>
            </button>
          ))}
        </div>
      ) : !compact ? (
        <div className="mt-3 text-xs text-slate-400">
          {placeholder || t("no_hay_paises")}
        </div>
      ) : null}

      <div className={`${compact ? "mt-3" : "mt-4"} ${compact && !isOpen ? "hidden" : ""} ${compact && isOpen ? "absolute left-4 right-4 top-[calc(100%+0.4rem)] z-[120] rounded-xl border border-slate-200 bg-white p-3 shadow-2xl" : ""}`}>
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("buscar_pais")}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
          disabled={disabled}
        />
      </div>

      <div className={`mt-3 max-h-56 overflow-y-auto rounded-lg border border-slate-200 ${compact && !isOpen ? "hidden" : ""} ${compact && isOpen ? "absolute left-4 right-4 top-[calc(100%+5.4rem)] z-[120] bg-white shadow-2xl" : ""}`}>
        {filtered.length ? (
          <ul className="divide-y divide-slate-100">
            {filtered.map((country) => {
              const isChecked = selectedNormalized.has(normalize(country.spanishName));
              return (
                <li key={country.cca2}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50"
                    onClick={() => toggleCountry(country)}
                    disabled={disabled}
                  >
                    <input type={selectionMode === "single" ? "radio" : "checkbox"} checked={isChecked} readOnly />
                    {country.flags?.svg || country.flags?.png ? (
                      <Image
                        src={country.flags?.svg || country.flags?.png}
                        alt={`flag ${country.spanishName}`}
                        width={20}
                        height={14}
                      />
                    ) : null}
                    <span>{country.spanishName}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="px-3 py-4 text-sm text-slate-500">{t("no_hay_paises")}</div>
        )}
      </div>
    </div>
  );
}
