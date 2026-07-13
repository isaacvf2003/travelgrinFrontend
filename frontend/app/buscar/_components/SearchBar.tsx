"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import DestinationSelect from "@/components/DestinationSelect";
import ButtonSolid from "@/components/ButtonSolid";
import { Check, ChevronDown, Search, Tag } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { pickI18nText } from "@/app/lib/i18nContent";
import { useCountry } from "@/app/context/CountryProvider";
import { writeStoredDestination } from "@/app/lib/destinationStore";
import { useSearchNavigation } from "./SearchNavigationContext";

type FilterGroupLite = {
  id: string;
  key?: string;
  label?: string;
  labelI18n?: Record<string, string> | null;
  imageUrl?: string | null;
  taxonomyType?: string;
  order?: number;
};

type CategoryLite = {
  id: string;
  parentId?: string | null;
  blockId?: string | null;
  order?: number;
  description: string;
  descriptionI18n?: Record<string, string> | null;
  iconImageUrl?: string | null;
  isPublicVisible?: boolean;
  isPrimaryCategory?: boolean;
  visibleInCard?: boolean;
};

function normalizeComparable(value: string) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[,\-/_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default function SearchBar() {
  const { params, applySearchParams, isNavigating } = useSearchNavigation();
  const { t, locale } = useTranslation();
  const { selectedCountry, setSelectedCountry, isCountryHydrated } = useCountry();

  const searchingLabel =
    locale === "en"
      ? "Searching..."
      : locale === "pt"
        ? "Buscando..."
        : locale === "it"
          ? "Ricerca in corso..."
          : "Buscando...";

  const [destinationCountry, setDestinationCountry] = useState(params.get("destinationCountry") || "");
  const [destinationError, setDestinationError] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(params.get("category") || "");
  const [selectedSubcategory, setSelectedSubcategory] = useState(params.get("subcategory") || "");
  const [openCategoryDropdown, setOpenCategoryDropdown] = useState(false);

  const [categoryBlocks, setCategoryBlocks] = useState<
    { id: string; label: string; imageUrl?: string | null; roots: CategoryLite[]; childrenBy: Map<string, CategoryLite[]> }[]
  >([]);

  const initialCountrySyncDone = useRef(false);

  useEffect(() => {
    const queryDestination = params.get("destinationCountry") || "";
    if (queryDestination) {
      writeStoredDestination(queryDestination);
    }
  }, [params]);

  useEffect(() => {
    if (destinationCountry.trim()) writeStoredDestination(destinationCountry);
  }, [destinationCountry]);

  const applySearchBarSelection = useCallback(() => {
    applySearchParams((next) => {
      if (selectedCategory) next.set("category", selectedCategory);
      else next.delete("category");

      if (selectedSubcategory && !selectedCategory) next.set("subcategory", selectedSubcategory);
      else next.delete("subcategory");

      if (destinationCountry) next.set("destinationCountry", destinationCountry);
      else next.delete("destinationCountry");

      if (selectedCountry) next.set("country", selectedCountry);
      else if (isCountryHydrated) next.delete("country");

      next.delete("page");
      next.delete("prestacionesPage");
    });
  }, [applySearchParams, selectedCategory, selectedSubcategory, destinationCountry, selectedCountry, isCountryHydrated]);

  const applyDestinationOnly = useCallback(
    (nextDestination: string) => {
      applySearchParams((next) => {
        if (nextDestination) next.set("destinationCountry", nextDestination);
        else next.delete("destinationCountry");
        next.delete("page");
        next.delete("prestacionesPage");
      });
    },
    [applySearchParams]
  );

  const applyCountryOnly = useCallback(
    (nextCountry: string) => {
      applySearchParams((next) => {
        if (nextCountry) next.set("country", nextCountry);
        else if (isCountryHydrated) next.delete("country");
        next.delete("page");
        next.delete("prestacionesPage");
      });
    },
    [applySearchParams, isCountryHydrated]
  );

  useEffect(() => {
    let active = true;

    Promise.all([fetch("/api/categories"), fetch("/api/filters")])
      .then(async ([categoriesRes, filtersRes]) => {
        const categoriesData = await categoriesRes.json().catch(() => ({}));
        const filtersData = await filtersRes.json().catch(() => ({}));
        if (!active) return;

        const groups: FilterGroupLite[] = Array.isArray(filtersData?.groups) ? filtersData.groups : [];
        const orderedGroups = [...groups].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

        const categoryItems: CategoryLite[] = Array.isArray(categoriesData?.items) ? categoriesData.items : [];
        const visibleCategories = categoryItems.filter(
          (category) => category.isPublicVisible !== false && category.blockId && (category.visibleInCard ?? category.isPrimaryCategory) === true
        );

        let blocks = orderedGroups
          .map((group) => {
            const scoped = visibleCategories.filter((category) => category.blockId === group.id);
            const roots = scoped
              .filter((category) => !category.parentId)
              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.description || "").localeCompare(b.description || ""));
            const childrenBy = new Map<string, CategoryLite[]>();
            scoped.forEach((category) => {
              if (!category.parentId) return;
              childrenBy.set(category.parentId, [...(childrenBy.get(category.parentId) ?? []), category]);
            });
            childrenBy.forEach((children, parentId) => {
              childrenBy.set(parentId, [...children].sort((a, b) => a.description.localeCompare(b.description)));
            });
            return {
              id: group.id,
              label: pickI18nText(group.labelI18n ?? null, locale, group.label ?? "Categorías"),
              imageUrl: group.imageUrl ?? null,
              roots,
              childrenBy,
            };
          })
          .filter((block) => block.roots.length > 0);

        if (!blocks.length && visibleCategories.length) {
          const fallbackGroup = orderedGroups[0];
          const fallbackScoped = visibleCategories.filter((category) => !category.parentId || category.blockId);
          const roots = fallbackScoped
            .filter((category) => !category.parentId)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.description || "").localeCompare(b.description || ""));
          const childrenBy = new Map<string, CategoryLite[]>();
          fallbackScoped.forEach((category) => {
            if (!category.parentId) return;
            childrenBy.set(category.parentId, [...(childrenBy.get(category.parentId) ?? []), category]);
          });
          blocks = [
            {
              id: fallbackGroup?.id ?? "__fallback__",
              label: fallbackGroup
                ? pickI18nText(fallbackGroup.labelI18n ?? null, locale, fallbackGroup.label ?? "Categorías")
                : "Categorías",
              imageUrl: fallbackGroup?.imageUrl ?? null,
              roots,
              childrenBy,
            },
          ].filter((block) => block.roots.length > 0);
        }

        setCategoryBlocks(blocks);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [locale]);

  useEffect(() => {
    setSelectedCategory(params.get("category") || "");
    setSelectedSubcategory(params.get("subcategory") || "");
    setDestinationCountry(params.get("destinationCountry") || "");
  }, [params]);

  useEffect(() => {
    if (!isCountryHydrated) return;
    const countryFromQuery = params.get("country") || "";
    if (countryFromQuery && normalizeComparable(countryFromQuery) !== normalizeComparable(selectedCountry)) {
      setSelectedCountry(countryFromQuery);
      return;
    }

    if (!countryFromQuery && !initialCountrySyncDone.current && selectedCountry) {
      initialCountrySyncDone.current = true;
      applyCountryOnly(selectedCountry);
      return;
    }

    initialCountrySyncDone.current = true;
  }, [params, selectedCountry, setSelectedCountry, isCountryHydrated, applyCountryOnly]);

  useEffect(() => {
    if (!openCategoryDropdown) return;
    const onScroll = () => setOpenCategoryDropdown(false);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [openCategoryDropdown]);

  useEffect(() => {
    const destinationFromQuery = params.get("destinationCountry") || "";
    if (normalizeComparable(destinationCountry) === normalizeComparable(destinationFromQuery)) return;
    applyDestinationOnly(destinationCountry);
  }, [destinationCountry, params, applyDestinationOnly]);

  useEffect(() => {
    if (!isCountryHydrated) return;
    const countryFromQuery = params.get("country") || "";
    if (normalizeComparable(selectedCountry) === normalizeComparable(countryFromQuery)) return;
    applyCountryOnly(selectedCountry);
  }, [selectedCountry, params, applyCountryOnly, isCountryHydrated]);

  const selectedCategoryValues = selectedCategory ? [selectedCategory] : [];
  const principalCategories = categoryBlocks
    .flatMap((block) => block.roots)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.description || "").localeCompare(b.description || ""));
  const matchedSelectedCategory = principalCategories.find(
    (category) => normalizeComparable(category.description) === normalizeComparable(selectedCategory)
  );

  const selectedLabels = [...selectedCategoryValues];

  const onSearch = () => {
    const hasDestination = Boolean(destinationCountry.trim());
    const hasCategoryFilter = Boolean(selectedCategory.trim() || selectedSubcategory.trim());
    if (!hasDestination && !hasCategoryFilter) {
      setDestinationError(true);
      return;
    }
    if (hasDestination) {
      fetch("/api/destination-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destinationCountry: destinationCountry.trim(),
          passportCountry: selectedCountry || "",
          category: selectedCategory || selectedSubcategory || "",
          source: "buscar-search",
        }),
        keepalive: true,
      }).catch(() => null);
    }
    applySearchBarSelection();
  };

  useEffect(() => {
    if (destinationCountry.trim() || selectedCategory.trim() || selectedSubcategory.trim()) setDestinationError(false);
  }, [destinationCountry, selectedCategory, selectedSubcategory]);

  return (
    <div className="relative isolate z-[90] w-full max-w-6xl mx-auto px-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-center">
        <div className="w-full md:flex-1 shadow-lg hover:shadow-xl transition-shadow duration-300 rounded-lg relative z-[110]">
          <button
            type="button"
            onClick={() => setOpenCategoryDropdown((prev) => !prev)}
            className="h-[3rem] w-full rounded-lg bg-white px-4 text-left shadow-md transition-all duration-300"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <Search className="h-5 w-5 text-black" />
                <span className="truncate text-[14px] font-medium text-[#5A6473]">
                  {selectedLabels.length
                    ? pickI18nText(
                        matchedSelectedCategory?.descriptionI18n ?? null,
                        locale,
                        matchedSelectedCategory?.description ?? selectedLabels[0]
                      )
                    : t("categoria_que_te_interesa")}
                </span>
              </div>
              <ChevronDown className={`h-5 w-5 text-gray-500 transition ${openCategoryDropdown ? "rotate-180" : ""}`} />
            </div>
          </button>

          {openCategoryDropdown ? (
            <div className="absolute left-0 right-0 z-[140] mt-2 max-h-80 overflow-y-auto rounded-xl bg-white p-2 shadow-2xl">
              {!categoryBlocks.length ? (
                <div className="px-3 py-2 text-sm text-gray-500">No hay categorías disponibles</div>
              ) : (
                <div className="space-y-1">
                  {principalCategories.map((category) => {
                    const checked = normalizeComparable(selectedCategory) === normalizeComparable(category.description);
                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => {
                          setSelectedCategory(category.description);
                          setSelectedSubcategory("");
                          setOpenCategoryDropdown(false);
                        }}
                        className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[14px] font-medium transition-colors ${checked ? "bg-[#EAF9FB] text-[#14758B]" : "text-[#3A4559] hover:bg-[#EAF9FB] hover:text-[#14758B]"}`}
                      >
                        {category.iconImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={category.iconImageUrl} alt="" className="h-4 w-4 rounded-sm object-cover" />
                        ) : (
                          <Tag className={`h-4 w-4 ${checked ? "text-[#14A7B8]" : "text-slate-400"}`} />
                        )}
                        <span className="flex-1">{pickI18nText(category.descriptionI18n ?? null, locale, category.description)}</span>
                        {checked ? <Check className="h-4 w-4 text-[#14A7B8]" /> : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div className="w-full md:flex-1 rounded-lg bg-[#F6F6F6] shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 flex items-center">
          <DestinationSelect
            destinationCountry={destinationCountry}
            setDestinationCountry={setDestinationCountry}
            textBuscarPais={t("buscar_pais")}
            label={t("lugar_de_destino")}
            customClass="mb-0 text-black"
            buttonClass="h-[3rem] pl-10"
            noHayPaises={t("no_hay_paises")}
            publishedOnly={true}
            error={destinationError}
          />
        </div>

        <ButtonSolid
          title={isNavigating ? searchingLabel : t("buscar")}
          hexButton="#15A4AE"
          classStyle={`cursor-pointer bg-teal-500 text-white px-6 py-3 rounded-lg font-medium transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1 ${isNavigating ? "opacity-80" : "hover:bg-teal-600"}`}
          hasSubmit={true}
          onSubmit={onSearch}
        />
      </div>
    </div>
  );
}
