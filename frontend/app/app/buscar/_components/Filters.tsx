"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";

import type { Category, FilterGroup, FilterOption } from "@/app/lib/types";
import { useTranslation } from "@/app/hooks/useTranslation";
import { pickI18nText } from "@/app/lib/i18nContent";
import { convertAmount, formatCurrency, getDefaultCurrencyForCountry, type CurrencyCode } from "@/app/lib/currency";
import { useSearchNavigation } from "./SearchNavigationContext";

function joinCsv(values: string[]) {
  return [...new Set(values)].filter(Boolean).join(",");
}

function splitCsv(v: string | null) {
  if (!v) return [];
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

function splitCsvWithKnownValues(v: string | null, knownValues: string[]) {
  const raw = String(v ?? "").trim();
  if (!raw) return [];

  const knownByKey = new Map(knownValues.map((value) => [normKey(value), value]));
  const exact = knownByKey.get(normKey(raw));
  if (exact) return [exact];

  const chunks = raw.split(",").map((chunk) => chunk.trim()).filter(Boolean);
  if (chunks.length <= 1 || !knownValues.length) return chunks;

  const values: string[] = [];
  for (let index = 0; index < chunks.length;) {
    let matchedValue = "";
    let matchedEnd = index;

    for (let end = chunks.length - 1; end >= index; end -= 1) {
      const candidate = chunks.slice(index, end + 1).join(", ");
      const known = knownByKey.get(normKey(candidate));
      if (known) {
        matchedValue = known;
        matchedEnd = end;
        break;
      }
    }

    if (matchedValue) {
      values.push(matchedValue);
      index = matchedEnd + 1;
    } else {
      values.push(chunks[index]);
      index += 1;
    }
  }

  return values.filter(Boolean);
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

function normKey(value: string) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[,\-/_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatPricePresetLabel(rawValue: string, baseLabel: string, selectedCurrency: CurrencyCode) {
  if (selectedCurrency === "ARS" || rawValue === "negotiable") return baseLabel;
  const normalizedValue = String(rawValue ?? "").replace(/\./g, "").replace(/\s+/g, "").trim();
  const rangeMatch = normalizedValue.match(/^(\d+)-(\d+)$/);
  if (rangeMatch) {
    const min = Math.round(convertAmount(Number(rangeMatch[1]), "ARS", selectedCurrency));
    const max = Math.round(convertAmount(Number(rangeMatch[2]), "ARS", selectedCurrency));
    return `${formatCurrency(min, selectedCurrency)} - ${formatCurrency(max, selectedCurrency)}`;
  }
  const openMatch = normalizedValue.match(/^(\d+)\+$/) ?? normalizedValue.match(/^\+(\d+)$/);
  if (openMatch) {
    const min = Math.round(convertAmount(Number(openMatch[1]), "ARS", selectedCurrency));
    return `+ ${formatCurrency(min, selectedCurrency)}`;
  }
  return baseLabel;
}

function pricePresetIdentity(rawValue: string, rawLabel: string) {
  const compactValue = String(rawValue || rawLabel || "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, "")
    .trim();
  const labelKey = normKey(rawLabel);

  if (compactValue === "negotiable" || labelKey === "precio a convenir") return "negotiable";

  const rangeMatch = compactValue.match(/^(\d+)-(\d+)$/);
  if (rangeMatch) return `range:${rangeMatch[1]}-${rangeMatch[2]}`;

  const openMatch = compactValue.match(/^(\d+)\+$/) ?? compactValue.match(/^\+(\d+)$/);
  if (openMatch) return `open:${openMatch[1]}`;

  return normKey(rawValue || rawLabel);
}

function toSentenceCase(text: string) {
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-black/10 py-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-sm font-semibold text-[#0B2B30]">{title}</span>
        <span className="grid h-8 w-8 place-items-center text-[#0097B4] transition">
          {open ? <ChevronDown className="h-[22px] w-[22px]" strokeWidth={2.4} /> : <ChevronRight className="h-[22px] w-[22px]" strokeWidth={2.4} />}
        </span>
      </button>
      {open ? <div className="mt-3 space-y-2">{children}</div> : null}
    </div>
  );
}

function OptionRow({
  checked,
  label,
  onChange,
  indent = false,
  hasChildren = false,
  childrenOpen = false,
  onToggleChildren,
}: {
  checked: boolean;
  label: string;
  onChange: (next: boolean) => void;
  indent?: boolean;
  hasChildren?: boolean;
  childrenOpen?: boolean;
  onToggleChildren?: () => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-2 text-sm text-[#4B5C60] ${
        indent ? "pl-5" : ""
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-black/20 accent-[#00A9C6]"
      />
      <span className="flex-1">{label}</span>
      {hasChildren ? (
        <button
          type="button"
          aria-label={childrenOpen ? "Ocultar subcategorias" : "Mostrar subcategorias"}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onToggleChildren?.();
          }}
          className="grid h-8 w-8 shrink-0 place-items-center text-[#0097B4] transition"
        >
          {childrenOpen ? <ChevronDown className="h-[22px] w-[22px]" strokeWidth={2.4} /> : <ChevronRight className="h-[22px] w-[22px]" strokeWidth={2.4} />}
        </button>
      ) : null}
    </label>
  );
}

function taxonomyTypeQueryKey(group: FilterGroup) {
  const tf = normKey(String(group.taxonomyType ?? ""));
  const aliasMap: Record<string, string> = {
    actividad: "actividad",
    tipo: "tipos",
    tipos: "tipos",
    modalidad: "modalidad",
    modalidades: "modalidad",
    idioma: "idiomas",
    idiomas: "idiomas",
    prestacion: "prestacion",
    prestaciones: "prestacion",
    categoria: "categoria",
    categorias: "categoria",
  };
  return aliasMap[tf] ?? group.key;
}


function relatedQueryKeys(key: string) {
  const normalized = normKey(key);
  if (normalized === "idioma" || normalized === "idiomas") return ["idioma", "idiomas"];
  if (normalized === "tipo" || normalized === "tipos") return ["tipo", "tipos"];
  if (normalized === "categoria" || normalized === "categorias") return ["categoria", "categorias"];
  if (normalized === "prestacion" || normalized === "prestaciones") return ["prestacion", "prestaciones"];
  if (normalized === "modalidad" || normalized === "modalidades") return ["modalidad", "modalidades"];
  return [key];
}


function isPrestacionesGroup(group: FilterGroup) {
  const key = normKey(group.key);
  const label = normKey(group.label);
  const taxonomy = normKey(String(group.taxonomyType ?? ""));
  return ["prestacion", "prestaciones", "service", "services"].includes(key)
    || ["prestacion", "prestaciones", "service", "services"].includes(label)
    || ["prestacion", "prestaciones", "service", "services"].includes(taxonomy);
}

function isCategoryGroup(group: FilterGroup) {
  const key = normKey(group.key);
  if (key === "price") return false;

  const label = normKey(group.label);
  const taxonomy = normKey(String(group.taxonomyType ?? ""));
  return ["category", "categories", "categoria", "categorias"].includes(key)
    || ["category", "categories", "categoria", "categorias"].includes(label)
    || ["category", "categories", "categoria", "categorias"].includes(taxonomy);
}

function buildTree(options: FilterOption[]) {
  const byParent = new Map<string | null, FilterOption[]>();
  for (const o of options) {
    const k = o.parentId ?? null;
    byParent.set(k, [...(byParent.get(k) ?? []), o]);
  }
  const sort = (arr: FilterOption[]) => arr.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.label.localeCompare(b.label));
  for (const [k, v] of byParent) byParent.set(k, sort(v));
  return byParent;
}

export default function Filters({
  categories,
  filterGroups,
}: {
  categories: Category[];
  filterGroups: FilterGroup[];
}) {
  const { locale, t } = useTranslation();
  const { params: optimisticParams, applySearchParams, isNavigating } = useSearchNavigation();
  const [expandedCategoryGroups, setExpandedCategoryGroups] = useState<Record<string, boolean>>({});
  const [expandedFilterGroups, setExpandedFilterGroups] = useState<Record<string, boolean>>({});
  const [expandedSubcategoryRows, setExpandedSubcategoryRows] = useState<Record<string, boolean>>({});
  const [expandedFilterChildrenRows, setExpandedFilterChildrenRows] = useState<Record<string, boolean>>({});
  const [showAllFilterBlocks, setShowAllFilterBlocks] = useState(false);

  const isApplying = isNavigating;
  const categoryLabels = useMemo(() => categories.map((category) => category.description).filter(Boolean), [categories]);
  const splitCategoryCsv = (value: string | null) => splitCsvWithKnownValues(value, categoryLabels);

  const setParamCsv = (key: string, value: string, checked: boolean) => {
    applySearchParams((next) => {
      const aliases = relatedQueryKeys(key);
      const mergedCurrentValues = aliases.flatMap((alias) => (alias === "category" || alias === "subcategory" ? splitCategoryCsv(next.get(alias)) : splitCsv(next.get(alias))));
      const nextValues = joinCsv(mergeCsvValue(mergedCurrentValues, value, checked));

      aliases.forEach((alias) => next.delete(alias));

      if (nextValues) next.set(key, nextValues);
      else next.delete(key);
      next.delete("page");
      next.delete("prestacionesPage");
    });
  };

  const setParam = (key: string, value: string) => {
    applySearchParams((next) => {
      if (value) next.set(key, value);
      else next.delete(key);
      next.delete("page");
      next.delete("prestacionesPage");
    });
  };

  const clearAll = () => {
    applySearchParams((current) => {
      const preserveKeys = new Set(["country", "destinationCountry", "city", "sort", "q"]);
      const preserved = new URLSearchParams();

      current.forEach((value, key) => {
        if (!preserveKeys.has(key)) return;
        if (!value) return;
        preserved.set(key, value);
      });

      Array.from(current.keys()).forEach((key) => current.delete(key));
      preserved.forEach((value, key) => current.set(key, value));
      current.delete("page");
      current.delete("prestacionesPage");
    });
  };

  const categoryTreeByBlock = useMemo(() => {
    const map = new Map<string, { roots: Category[]; childrenBy: Map<string, Category[]> }>();
    const visibleCategories = categories.filter((c) => c.isPublicVisible !== false && c.blockId);
    const grouped = new Map<string, Category[]>();
    visibleCategories.forEach((category) => {
      const blockId = String(category.blockId);
      grouped.set(blockId, [...(grouped.get(blockId) ?? []), category]);
    });
    grouped.forEach((blockCategories, blockId) => {
      const roots = blockCategories
        .filter((category) => !category.parentId)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.description || "").localeCompare(b.description || ""));
      const childrenBy = new Map<string, Category[]>();
      blockCategories.forEach((category) => {
        if (!category.parentId) return;
        childrenBy.set(category.parentId, [...(childrenBy.get(category.parentId) ?? []), category]);
      });
      childrenBy.forEach((children, key) => {
        childrenBy.set(
          key,
          [...children].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.description || "").localeCompare(b.description || ""))
        );
      });
      map.set(blockId, { roots, childrenBy });
    });
    return map;
  }, [categories]);

  const selectedChips = useMemo(() => {
    const chips: { label: string; key: string; value?: string }[] = [];
    const categoryValues = splitCategoryCsv(optimisticParams.get("category"));
    categoryValues.forEach((value) => {
      const match = categories.find((c) => normKey(c.description) === normKey(value));
      const label = match ? pickI18nText(match.descriptionI18n ?? null, locale, value) : value;
      chips.push({ label, key: "category", value });
    });
    const subcategoryValues = splitCategoryCsv(optimisticParams.get("subcategory"));
    subcategoryValues.forEach((value) => {
      const match = categories.find((c) => normKey(c.description) === normKey(value));
      const label = match ? pickI18nText(match.descriptionI18n ?? null, locale, value) : value;
      chips.push({ label, key: "subcategory", value });
    });

    filterGroups.forEach((group) => {
      if (group.key === "price") {
        const selectedCurrency = (optimisticParams.get("priceCurrency") || getDefaultCurrencyForCountry(optimisticParams.get("country"))) as CurrencyCode;
        const pricePresets = splitCsv(optimisticParams.get("pricePreset"));
        pricePresets.forEach((value) => {
          const matched = group.options?.find((opt) => opt.value === value);
          const baseLabel = matched ? pickI18nText(matched.labelI18n ?? null, locale, matched.label) : value;
          const label = formatPricePresetLabel(String(value), baseLabel, selectedCurrency);
          chips.push({ label, key: "pricePreset", value });
        });
        const priceMin = optimisticParams.get("priceMin");
        if (priceMin) chips.push({ label: `${t("precio_minimo_label")}: ${priceMin}`, key: "priceMin" });
        const priceMax = optimisticParams.get("priceMax");
        if (priceMax) chips.push({ label: `${t("precio_maximo_label")}: ${priceMax}`, key: "priceMax" });
        return;
      }

      if (group.type === "range") {
        const minKey = `${group.key}Min`;
        const maxKey = `${group.key}Max`;
        const minVal = optimisticParams.get(minKey);
        const maxVal = optimisticParams.get(maxKey);
        const groupLabel = pickI18nText(group.labelI18n ?? null, locale, group.label);
        if (minVal) chips.push({ label: `${groupLabel} mín: ${minVal}`, key: minKey });
        if (maxVal) chips.push({ label: `${groupLabel} máx: ${maxVal}`, key: maxKey });
        return;
      }

      const queryKey = taxonomyTypeQueryKey(group);
      const values = splitCsv(optimisticParams.get(queryKey));
      values.forEach((value) => {
        const matched = group.options?.find((opt) => opt.value === value);
        const label = matched ? pickI18nText(matched.labelI18n ?? null, locale, matched.label) : value;
        chips.push({ label, key: queryKey, value });
      });
    });

    const seen = new Set<string>();
    return chips.filter((chip) => {
      const key = chip.label
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [optimisticParams, filterGroups, categories, locale, t]);

  const orderedGroups = useMemo(() => {
    return [...filterGroups].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [filterGroups]);

  const groupsForSidebar = useMemo(() => {
    return orderedGroups
      .filter((group) => !isPrestacionesGroup(group))
      .filter(
        (group) =>
          isCategoryGroup(group)
            ? (categoryTreeByBlock.get(group.id)?.roots.length ?? 0) > 0
            : (group.options ?? []).length > 0 || group.type === "range" || group.key === "price"
      );
  }, [orderedGroups, categoryTreeByBlock]);

  const visibleSidebarGroups = useMemo(
    () => (showAllFilterBlocks ? groupsForSidebar : groupsForSidebar.slice(0, 3)),
    [showAllFilterBlocks, groupsForSidebar]
  );

  const hiddenSidebarGroupsCount = Math.max(groupsForSidebar.length - 3, 0);
  const applyingFiltersLabel =
    locale === "en"
      ? "Applying filters…"
      : locale === "pt"
        ? "Aplicando filtros…"
        : locale === "it"
          ? "Applicazione filtri…"
          : "Aplicando filtros…";
  const showMoreLabel =
    locale === "en"
      ? `Show more filters (${hiddenSidebarGroupsCount})`
      : locale === "pt"
        ? `Ver mais filtros (${hiddenSidebarGroupsCount})`
        : locale === "it"
          ? `Mostra più filtri (${hiddenSidebarGroupsCount})`
          : `Ver más filtros (${hiddenSidebarGroupsCount})`;
  const showLessLabel =
    locale === "en"
      ? "Show fewer filters"
      : locale === "pt"
        ? "Ver menos filtros"
        : locale === "it"
          ? "Mostra meno filtri"
          : "Ver menos filtros";


  return (
    <div className="flex max-h-[calc(100svh-7rem)] flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_14px_50px_rgba(0,0,0,0.06)] lg:max-h-none">
      <div className="shrink-0 border-b border-[#D8E2E5] bg-white p-5 pb-4">
        <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xl font-semibold text-[#00A9C6]">{toSentenceCase(t("filtros_label"))}</div>
          {selectedChips.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedChips.map((chip) => (
                <button
                  key={`${chip.key}-${chip.value ?? chip.label}`}
                  type="button"
                  onClick={() => {
                    if (chip.value) {
                      setParamCsv(chip.key, chip.value, false);
                    } else {
                      setParam(chip.key, "");
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-[#00A9C6]/30 bg-[#00A9C6]/10 px-3 py-1 text-xs text-[#0B2B30] transition hover:bg-[#00A9C6]/20"
                >
                  <span>{chip.label}</span>
                  <span className="text-[#00A9C6]">×</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={clearAll}
          className="rounded-full border border-[#00A9C6] px-4 py-1 text-sm text-[#00A9C6] hover:bg-[#00A9C6]/10"
        >
          {t("limpiar")}
        </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-5 pt-4 overscroll-contain lg:overflow-visible">
      {isApplying ? (
        <div className="mt-2 inline-flex items-center gap-2 text-xs font-medium text-[#00A9C6]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {applyingFiltersLabel}
        </div>
      ) : null}

      {/* Grupos dinámicos (DB) */}
      {visibleSidebarGroups.map((group) => {
        const key = group.key;
        const queryKey = taxonomyTypeQueryKey(group);
        const options = group.options ?? [];

        if (isCategoryGroup(group)) {
          const tree = categoryTreeByBlock.get(group.id);
          if (!tree?.roots.length) return null;
          const isExpanded = expandedCategoryGroups[group.id] === true;
          const visibleRoots = isExpanded ? tree.roots : tree.roots.slice(0, 3);
          return (
            <Section
              key={group.id}
              title={toSentenceCase(pickI18nText(group.labelI18n ?? null, locale, group.label))}
              defaultOpen
            >
              {visibleRoots.map((root) => {
                const rootHasChildren = (tree.childrenBy.get(root.id) ?? []).length > 0;
                const rootSelected = hasCsvValue(splitCategoryCsv(optimisticParams.get("category")), root.description);
                const childSelections = (tree.childrenBy.get(root.id) ?? []).filter((child) =>
                  hasCsvValue(splitCategoryCsv(optimisticParams.get("subcategory")), child.description)
                );
                const subRowKey = `${group.id}:${root.id}`;
                const childOptions = tree.childrenBy.get(root.id) ?? [];
                const isSubExpanded = expandedSubcategoryRows[subRowKey] === true;
                const showChildren = rootSelected || childSelections.length > 0 || isSubExpanded;
                const visibleChildren = isSubExpanded ? childOptions : childOptions.slice(0, 2);
                return (
                  <div key={root.id} className="space-y-2">
                    <OptionRow
                      checked={rootSelected}
                      label={pickI18nText(root.descriptionI18n ?? null, locale, root.description)}
                      hasChildren={rootHasChildren}
                      childrenOpen={showChildren}
                      onToggleChildren={() => setExpandedSubcategoryRows((prev) => ({ ...prev, [subRowKey]: !isSubExpanded }))}
                      onChange={(ck) => setParamCsv("category", root.description, ck)}
                    />
                    {showChildren
                      ? visibleChildren.map((child) => {
                          const childSelected = hasCsvValue(splitCategoryCsv(optimisticParams.get("subcategory")), child.description);
                          return (
                            <OptionRow
                              key={child.id}
                              indent
                              checked={childSelected}
                              label={pickI18nText(child.descriptionI18n ?? null, locale, child.description)}
                              onChange={(ck) => setParamCsv("subcategory", child.description, ck)}
                            />
                          );
                        })
                      : null}
                    {showChildren && childOptions.length > 2 ? (
                      <button
                        type="button"
                        onClick={() => setExpandedSubcategoryRows((prev) => ({ ...prev, [subRowKey]: !isSubExpanded }))}
                        className="ml-5 text-xs font-semibold text-[#00A9C6] hover:underline"
                      >
                        {isSubExpanded ? "Ver menos subcategorías" : `Ver más subcategorías (${childOptions.length - 2})`}
                      </button>
                    ) : null}
                  </div>
                );
              })}
              {tree.roots.length > 3 ? (
                <button
                  type="button"
                  onClick={() => setExpandedCategoryGroups((prev) => ({ ...prev, [group.id]: !isExpanded }))}
                  className="mt-1 text-xs font-semibold text-[#00A9C6] hover:underline"
                >
                  {isExpanded ? "Ver menos" : "Ver más"}
                </button>
              ) : null}
            </Section>
          );
        }

        // Precio (configurable desde el admin).
        if (key === "price") {
          const selectedCurrency = (optimisticParams.get("priceCurrency") || getDefaultCurrencyForCountry(optimisticParams.get("country"))) as CurrencyCode;
          const basePresets = options
            .filter((opt) => !String(opt.value ?? "").toLowerCase().startsWith("currency:"))
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
          const fallbackPresets = [
            { value: "150000-250000", label: "ARS 150.000 - 250.000" },
            { value: "250000-350000", label: "ARS 250.000 - 350.000" },
            { value: "350000-650000", label: "ARS 350.000 - 650.000" },
            { value: "800000+", label: "+800.000" },
            { value: "negotiable", label: "Precio a convenir" },
          ];
          const seenPresetKeys = new Set<string>();
          const uniquePresets = (basePresets.length ? basePresets : fallbackPresets).filter((preset) => {
            const raw = String(preset.value ?? "");
            const baseLabel = pickI18nText("labelI18n" in preset ? preset.labelI18n ?? null : null, locale, preset.label ?? raw);
            const presetKey = pricePresetIdentity(raw, baseLabel);
            if (!presetKey || seenPresetKeys.has(presetKey)) return false;
            seenPresetKeys.add(presetKey);
            return true;
          });
          const presets = uniquePresets.map((preset) => {
            const raw = String(preset.value ?? "");
            const baseLabel = pickI18nText("labelI18n" in preset ? preset.labelI18n ?? null : null, locale, preset.label ?? raw);
            return { ...preset, label: formatPricePresetLabel(raw, baseLabel, selectedCurrency) };
          });
          const optionCurrencies = options
            .filter((opt) => String(opt.value ?? "").toLowerCase().startsWith("currency:"))
            .map((opt) => String(opt.value).split(":")[1]?.trim().toUpperCase())
            .filter(Boolean) as string[];
          const currencyList = [...new Set(["ARS", "USD", "EUR", "BRL", "CLP", "COP", "MXN", "PEN", "UYU", "JPY", "RUB", ...optionCurrencies])];
          return (
            <Section
              key={group.id}
              title={pickI18nText(group.labelI18n ?? null, locale, group.label)}
              defaultOpen
            >
              <div className="space-y-2">
                {presets.map((p) => {
                  const selected = hasCsvValue(splitCsv(optimisticParams.get("pricePreset")), p.value);
                  return (
                    <OptionRow
                      key={p.value}
                      checked={selected}
                      label={p.label}
                      onChange={(ck) => setParamCsv("pricePreset", p.value, ck)}
                    />
                  );
                })}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-[#6B7C80]">{t("filtro_minimo")}</div>
                  <input
                    value={optimisticParams.get("priceMin") ?? ""}
                    onChange={(e) => setParam("priceMin", e.target.value)}
                    placeholder="0"
                    className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-[#00A9C6]"
                  />
                </div>
                <div>
                  <div className="text-xs text-[#6B7C80]">{t("filtro_maximo")}</div>
                  <input
                    value={optimisticParams.get("priceMax") ?? ""}
                    onChange={(e) => setParam("priceMax", e.target.value)}
                    placeholder="1000000"
                    className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-[#00A9C6]"
                  />
                </div>
              </div>

              <div className="mt-4">
                <div className="text-xs text-[#6B7C80]">{t("moneda_label")}</div>
                <select
                  value={selectedCurrency}
                  onChange={(e) => setParam("priceCurrency", e.target.value)}
                  className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-[#00A9C6]"
                >
                  <option value="">{t("moneda_todas")}</option>
                  {currencyList.map((currency) => (
                    <option key={currency} value={currency}>{currency}</option>
                  ))}
                </select>
              </div>
            </Section>
          );
        }

        if (group.type === "range") {
          const minKey = `${key}Min`;
          const maxKey = `${key}Max`;
          return (
            <Section
              key={group.id}
              title={pickI18nText(group.labelI18n ?? null, locale, group.label)}
              defaultOpen
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-[#6B7C80]">{t("filtro_minimo")}</div>
                  <input
                    value={optimisticParams.get(minKey) ?? ""}
                    onChange={(e) => setParam(minKey, e.target.value)}
                    placeholder={String(group.min ?? "")}
                    className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-[#00A9C6]"
                  />
                </div>
                <div>
                  <div className="text-xs text-[#6B7C80]">{t("filtro_maximo")}</div>
                  <input
                    value={optimisticParams.get(maxKey) ?? ""}
                    onChange={(e) => setParam(maxKey, e.target.value)}
                    placeholder={String(group.max ?? "")}
                    className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-[#00A9C6]"
                  />
                </div>
              </div>
            </Section>
          );
        }

        const tree = buildTree(options);
        const roots = tree.get(null) ?? [];
        const isFilterExpanded = expandedFilterGroups[group.id] === true;
        const visibleRoots = isFilterExpanded ? roots : roots.slice(0, 3);

        return (
          <Section
            key={group.id}
            title={pickI18nText(group.labelI18n ?? null, locale, group.label)}
            defaultOpen
          >
            {visibleRoots.map((o) => {
              const selected = hasCsvValue(splitCsv(optimisticParams.get(queryKey)), o.value);
              const hasChildren = (tree.get(o.id) ?? []).length > 0;
              const childRowKey = `${group.id}:${o.id}`;
              const children = tree.get(o.id) ?? [];
              const isChildExpanded = expandedFilterChildrenRows[childRowKey] === true;
              const childSelections = children.filter((child) => hasCsvValue(splitCsv(optimisticParams.get(queryKey)), child.value));
              const showChildren = selected || childSelections.length > 0 || isChildExpanded;
              const visibleChildren = isChildExpanded ? children : children.slice(0, 2);
              return (
                <div key={o.id} className="space-y-2">
                  <OptionRow
                    checked={selected}
                    label={pickI18nText(o.labelI18n ?? null, locale, o.label)}
                    hasChildren={hasChildren}
                    childrenOpen={showChildren}
                    onToggleChildren={() => setExpandedFilterChildrenRows((prev) => ({ ...prev, [childRowKey]: !isChildExpanded }))}
                    onChange={(ck) => setParamCsv(queryKey, o.value, ck)}
                  />
                  {showChildren ? visibleChildren.map((child) => {
                    const childSelected = hasCsvValue(splitCsv(optimisticParams.get(queryKey)), child.value);
                    return (
                      <OptionRow
                        key={child.id}
                        indent
                        checked={childSelected}
                        label={pickI18nText(child.labelI18n ?? null, locale, child.label)}
                        onChange={(ck) => setParamCsv(queryKey, child.value, ck)}
                      />
                    );
                  }) : null}
                  {showChildren && children.length > 2 ? (
                    <button
                      type="button"
                      onClick={() => setExpandedFilterChildrenRows((prev) => ({ ...prev, [childRowKey]: !isChildExpanded }))}
                      className="ml-5 text-xs font-semibold text-[#00A9C6] hover:underline"
                    >
                      {isChildExpanded ? "Ver menos subcategorías" : `Ver más subcategorías (${children.length - 2})`}
                    </button>
                  ) : null}
                </div>
              );
            })}
            {roots.length > 3 ? (
              <button
                type="button"
                onClick={() => setExpandedFilterGroups((prev) => ({ ...prev, [group.id]: !isFilterExpanded }))}
                className="mt-1 text-xs font-semibold text-[#00A9C6] hover:underline"
              >
                {isFilterExpanded ? "Ver menos" : `Ver más (${roots.length - 3})`}
              </button>
            ) : null}
          </Section>
        );
      })}

      {hiddenSidebarGroupsCount > 0 ? (
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setShowAllFilterBlocks((prev) => !prev);
          }}
          className="w-full rounded-xl border border-[#00A9C6]/30 bg-[#00A9C6]/8 px-3 py-2 text-sm font-semibold text-[#0B5E6B] transition hover:bg-[#00A9C6]/15"
        >
          {showAllFilterBlocks ? showLessLabel : showMoreLabel}
        </button>
      ) : null}
      </div>
    </div>
  );
}
