"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Search, Tag } from "lucide-react";
import ButtonSolid from "../ButtonSolid";
import DestinationSelect from "../DestinationSelect";
import { useTranslation } from "@/app/hooks/useTranslation";
import { pickI18nText } from "@/app/lib/i18nContent";
import { useCountry } from "@/app/context/CountryProvider";

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
};

export default function SearchDestination() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { selectedCountry } = useCountry();

  const [destinationCountry, setDestinationCountry] = useState<string>("");
  const ALL_CATEGORIES_VALUE = "__all_categories__";
  const [selectedCategory, setSelectedCategory] = useState("");
  const [openCategoryDropdown, setOpenCategoryDropdown] = useState(false);

  const [categoryBlocks, setCategoryBlocks] = useState<
    { id: string; label: string; imageUrl?: string | null; roots: CategoryLite[]; childrenBy: Map<string, CategoryLite[]> }[]
  >([]);

  useEffect(() => {
    let active = true;

    Promise.all([fetch("/api/categories"), fetch("/api/filters")])
      .then(async ([categoriesRes, filtersRes]) => {
        const categoriesData = await categoriesRes.json().catch(() => ({}));
        const filtersData = await filtersRes.json().catch(() => ({}));
        if (!active) return;

        const groups: FilterGroupLite[] = Array.isArray(filtersData?.groups) ? filtersData.groups : [];
        const orderedGroups = [...groups]
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

        const categoryItems: CategoryLite[] = Array.isArray(categoriesData?.items) ? categoriesData.items : [];
        const visibleCategories = categoryItems.filter(
          (category) => category.isPublicVisible !== false && category.blockId && category.isPrimaryCategory === true
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

  const selectedCategoryValues = selectedCategory && selectedCategory !== ALL_CATEGORIES_VALUE ? [selectedCategory] : [];
  const isAllCategoriesSelected = selectedCategory === ALL_CATEGORIES_VALUE;
  const principalCategories = categoryBlocks
    .flatMap((block) => block.roots)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.description || "").localeCompare(b.description || ""));

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (selectedCategory && selectedCategory !== ALL_CATEGORIES_VALUE) params.set("category", selectedCategory);
    if (selectedCountry) params.set("country", selectedCountry);
    if (destinationCountry) params.set("destinationCountry", destinationCountry);
    params.set("page", "1");
    router.push(`/buscar?${params.toString()}`);
  };

  useEffect(() => {
    if (!openCategoryDropdown) return;
    const onScroll = () => setOpenCategoryDropdown(false);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [openCategoryDropdown]);

  return (
    <div
      className="h-auto min-h-[25rem] lg:min-h-[13rem] w-full flex flex-col px-4 sm:px-6 md:px-8 py-6 lg:py-0 justify-center items-center max-w-[25rem] sm:max-w-[41rem] md:max-w-full mx-auto md:mx-0"
      style={{ backgroundColor: "#EEEEEE", borderRadius: "36px" }}
    >
      <h1
        className="text-[22px] md:text-[25.76px] mb-4 text-center font-bold"
        style={{ color: "#273166" }}
      >
        {t("aqui_comienza_tu_viaje")}
      </h1>

      <div className="flex w-full flex-col lg:flex-row lg:space-x-2 space-y-4 lg:space-y-0 justify-center">
        <div className="w-full shadow-lg hover:shadow-xl transition-shadow duration-300 rounded-lg relative z-98">
          <button
            type="button"
            onClick={() => setOpenCategoryDropdown((prev) => !prev)}
            className="h-[4rem] w-full rounded-lg bg-white px-4 text-left shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <Search className="h-5 w-5 text-black" />
                <span className="truncate text-[14px] font-medium text-[#5A6473]">
                  {isAllCategoriesSelected
                    ? "Ver todas"
                    : selectedCategoryValues.length
                      ? pickI18nText(
                          principalCategories.find((category) => category.description === selectedCategory)?.descriptionI18n ?? null,
                          locale,
                          selectedCategoryValues[0]
                        )
                      : t("categoria_que_te_interesa")}
                </span>
              </div>
              <ChevronDown className={`h-5 w-5 text-gray-500 transition ${openCategoryDropdown ? "rotate-180" : ""}`} />
            </div>
          </button>

          {openCategoryDropdown ? (
            <div className="absolute left-0 right-0 z-30 mt-2 max-h-80 overflow-y-auto rounded-xl bg-white p-2 shadow-2xl">
              {!categoryBlocks.length ? (
                <div className="px-3 py-2 text-sm text-gray-500">{t("no_hay_categorias_disponibles") || "No hay categorías disponibles"}</div>
              ) : (
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory(ALL_CATEGORIES_VALUE);
                      setOpenCategoryDropdown(false);
                    }}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[14px] font-medium transition-colors ${isAllCategoriesSelected ? "bg-[#EAF9FB] text-[#14758B]" : "text-[#3A4559] hover:bg-[#EAF9FB] hover:text-[#14758B]"}`}
                  >
                    <Tag className={`h-4 w-4 ${isAllCategoriesSelected ? "text-[#14A7B8]" : "text-slate-400"}`} />
                    <span className="flex-1">Ver todas</span>
                    {isAllCategoriesSelected ? <Check className="h-4 w-4 text-[#14A7B8]" /> : null}
                  </button>
                  {principalCategories.map((category) => {
                    const checked = selectedCategory === category.description;
                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => {
                          setSelectedCategory(category.description);
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

        <div
          style={{ backgroundColor: "#F6F6F6" }}
          className="rounded-lg w-full lg:w-[22rem] text-black relative h-[4rem] shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
        >
          <div className="relative z-97">
            <DestinationSelect
              destinationCountry={destinationCountry}
              setDestinationCountry={setDestinationCountry}
              label={t("lugar_de_destino")}
              customClass="mb-0 text-black pb-4"
              labelStyle="top-[23px] left-10"
              buttonClass="h-[4rem] pl-10"
              isInModal={false}
              textBuscarPais={t("buscar_pais")}
              noHayPaises={t("no_hay_paises")}
            />
          </div>
        </div>

        <ButtonSolid
          title={t("buscar")}
          hexButton="#15A4AE"
          classStyle="z-0 cursor-pointer w-full lg:w-[9rem] bg-teal-500 hover:bg-teal-600 text-white px-4 py-3 rounded-lg font-medium transition-all duration-300 h-[4rem] shadow-lg hover:shadow-xl transform hover:-translate-y-1"
          hasSubmit={true}
          onSubmit={handleSearch}
        />
      </div>

      <p className="text-gray-600 text-center mt-[12px] text-[14px]">
        {t("filtramos_para_ti")}
      </p>

      {openCategoryDropdown ? (
        <div
          className="fixed inset-0 z-20"
          onClick={() => setOpenCategoryDropdown(false)}
        />
      ) : null}
    </div>
  );
}
