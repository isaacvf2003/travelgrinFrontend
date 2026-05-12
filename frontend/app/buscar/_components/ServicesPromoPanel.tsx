"use client";

import { CheckSquare } from "lucide-react";
import type { FilterGroup, Publication } from "@/app/lib/types";
import { useTranslation } from "@/app/hooks/useTranslation";
import { pickI18nText } from "@/app/lib/i18nContent";
import { useSearchNavigation } from "./SearchNavigationContext";

function normKey(value: string) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[,\-/_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitCsv(v: string | null) {
  if (!v) return [];
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

function joinCsv(values: string[]) {
  return [...new Set(values)].filter(Boolean).join(",");
}

function hasCsvValue(list: string[], value: string) {
  const needle = normKey(value);
  return list.some((entry) => normKey(entry) === needle);
}

function mergeCsvValue(list: string[], value: string, checked: boolean) {
  const needle = normKey(value);
  if (checked) {
    if (list.some((entry) => normKey(entry) === needle)) return list;
    return [...list, value];
  }
  return list.filter((entry) => normKey(entry) !== needle);
}

function taxonomyTypeQueryKey(group: FilterGroup) {
  const tf = normKey(String(group.taxonomyType ?? ""));
  const aliasMap: Record<string, string> = {
    prestacion: "prestacion",
    prestaciones: "prestacion",
  };
  return aliasMap[tf] ?? group.key;
}

export default function ServicesPromoPanel({ filterGroups, publications }: { filterGroups: FilterGroup[]; publications: Publication[] }) {
  const { locale, t } = useTranslation();
  const { params, applySearchParams } = useSearchNavigation();
  const orderedGroups = [...filterGroups].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const secondaryServicesGroup = orderedGroups.find((group) => {
    const taxonomy = normKey(String(group.taxonomyType ?? ""));
    const key = normKey(group.key);
    return ["prestacion", "prestaciones", "service", "services"].includes(taxonomy)
      || ["prestacion", "prestaciones", "service", "services"].includes(key);
  });


  const availablePrestaciones = new Set<string>();
  publications.forEach((item) => {
    const rec = item as unknown as Record<string, unknown>;
    if (String(rec?.primaryGroupKey ?? "") !== "prestacion") return;
    const fields = ((rec?.fields ?? {}) as Record<string, unknown>);
    const vals = [String(rec?.category ?? ""), String(rec?.subcategory ?? "")];
    if (Array.isArray(fields.prestaciones)) vals.push(...fields.prestaciones.map((v) => String(v ?? "")));
    if (Array.isArray(fields.categorySelections)) vals.push(...fields.categorySelections.map((v) => String(v ?? "")));
    if (Array.isArray(fields.subcategorySelections)) vals.push(...fields.subcategorySelections.map((v) => String(v ?? "")));
    vals.filter(Boolean).forEach((v) => availablePrestaciones.add(normKey(v)));
  });
  if (!secondaryServicesGroup || (secondaryServicesGroup.options?.length ?? 0) === 0) return null;

  const visibleOptions = (secondaryServicesGroup.options ?? [])
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .filter((option) => availablePrestaciones.has(normKey(option.value)) || availablePrestaciones.has(normKey(option.label)));

  if (!visibleOptions.length) return null;

  const queryKey = taxonomyTypeQueryKey(secondaryServicesGroup);
  const selectedValues = splitCsv(params.get(queryKey));

  return (
    <div className="rounded-2xl border border-[#B9D8FF] bg-[#EAF4FF] p-4">
      <p className="text-sm font-semibold leading-5 text-[#123F73]">{t("servicios_promo_panel_title")}</p>
      <div className="tg-hide-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
        {visibleOptions.map((option) => {
            const selected = hasCsvValue(selectedValues, option.value);
            return (
              <button
                key={option.id}
                type="button"
                onClick={() =>
                  applySearchParams((next) => {
                    const curr = splitCsv(next.get(queryKey));
                    const nextValues = joinCsv(mergeCsvValue(curr, option.value, !selected));
                    if (nextValues) next.set(queryKey, nextValues);
                    else next.delete(queryKey);
                    next.delete("page");
                    next.delete("prestacionesPage");
                  })
                }
                className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  selected
                    ? "border-[#2C7BE5] bg-[#2C7BE5] text-white shadow-sm"
                    : "border-[#2C7BE5]/30 bg-white text-[#2C7BE5] shadow-sm hover:bg-[#2C7BE5]/10"
                }`}
              >
                <CheckSquare className="h-3.5 w-3.5" />
                {pickI18nText(option.labelI18n ?? null, locale, option.label)}
              </button>
            );
          })}
      </div>
    </div>
  );
}
