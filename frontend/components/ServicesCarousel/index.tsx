"use client";

import { useEffect, useMemo, useRef, useState, type TouchEvent } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { useIsClient } from "@/app/hooks/isClient";
import ChangingText from "../ChangingText";
import { useCountry } from "@/app/context/CountryProvider";
import { useTranslation } from "@/app/hooks/useTranslation";
import { readStoredDestination } from "@/app/lib/destinationStore";
import { pickI18nText, type I18nRecord } from "@/app/lib/i18nContent";

type HomeCategoryCard = {
  id: string;
  description: string;
  descriptionI18n?: I18nRecord | null;
  taxonomyType?: string | null;
  blockId?: string | null;
  iconImageUrl?: string | null;
  cardImageUrl?: string | null;
  order?: number;
  parentId?: string | null;
  isPrimaryCategory?: boolean;
  visibleInCard?: boolean;
};

type FilterGroupLite = {
  id: string;
  taxonomyType?: string | null;
};

function normalizeTaxonomyType(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[,\-/_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function taxonomyTypeQueryKey(taxonomyType: unknown) {
  const taxonomy = normalizeTaxonomyType(taxonomyType);
  const aliasMap: Record<string, string> = {
    actividad: "actividad",
    actividades: "actividad",
    tipo: "tipos",
    tipos: "tipos",
    modalidad: "modalidad",
    modalidades: "modalidad",
    idioma: "idiomas",
    idiomas: "idiomas",
    prestacion: "prestacion",
    prestaciones: "prestacion",
  };

  return aliasMap[taxonomy] ?? "category";
}

function isCategoryTaxonomy(taxonomyType: unknown) {
  const taxonomy = normalizeTaxonomyType(taxonomyType);
  return (
    !taxonomy ||
    [
      "default",
      "inherit",
      "categoria",
      "categorias",
      "category",
      "categories",
      "destino",
      "destinos",
      "voluntariado",
      "voluntariados",
    ].includes(taxonomy)
  );
}

function shouldUseBlockTaxonomy(taxonomyType: unknown) {
  const taxonomy = normalizeTaxonomyType(taxonomyType);
  return !taxonomy || ["default", "inherit", "predeterminado"].includes(taxonomy);
}

function useCardsPerView() {
  const [cardsPerView, setCardsPerView] = useState(4);

  useEffect(() => {
    const update = () => {
      if (window.innerWidth >= 1024) {
        setCardsPerView(4);
      } else if (window.innerWidth >= 768) {
        setCardsPerView(2);
      } else {
        setCardsPerView(1);
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return cardsPerView;
}

export default function ServicesCarousel() {
  const { t, locale } = useTranslation();
  const isClient = useIsClient();
  const router = useRouter();
  const { isOpenModalDemandante, isOpenModalOferente, selectedCountry } = useCountry();
  const cardsPerView = useCardsPerView();

  const [categories, setCategories] = useState<HomeCategoryCard[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchEndX, setTouchEndX] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInView, setIsInView] = useState(false);
  const sectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isInView) return;
    let mounted = true;
    setIsLoading(true);
    Promise.all([
      fetch("/api/categories", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/filters", { cache: "no-store" }).then((r) => r.json()).catch(() => ({ groups: [] })),
    ])
      .then(([categoriesData, filtersData]) => {
        if (!mounted) return;
        const items = Array.isArray(categoriesData?.items) ? categoriesData.items : [];
        const groups = Array.isArray(filtersData?.groups) ? (filtersData.groups as FilterGroupLite[]) : [];
        const taxonomyTypeByBlockId = new Map(groups.map((group) => [group.id, group.taxonomyType ?? null]));
        const principal = items
          .filter((category: HomeCategoryCard) => (category.visibleInCard ?? category.isPrimaryCategory) === true && !category.parentId)
          .map((category: HomeCategoryCard) => ({
            ...category,
            taxonomyType: shouldUseBlockTaxonomy(category.taxonomyType)
              ? (taxonomyTypeByBlockId.get(String(category.blockId ?? "")) ?? category.taxonomyType)
              : category.taxonomyType,
          }))
          .sort((a: HomeCategoryCard, b: HomeCategoryCard) => Number(a.order ?? 0) - Number(b.order ?? 0));
        setCategories(principal);
      })
      .catch(() => setCategories([]))
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [isInView]);

  const visibleCategories = useMemo(
    () => categories.filter((category) => String(category.description ?? "").trim()),
    [categories]
  );

  const phrasesCarousel = [
    t("categorias_con_proposito"),
    t("servicios_puntuales"),
    t("ofertas_reales"),
    t("conexiones_globales"),
  ];

  const enableCarousel = visibleCategories.length > cardsPerView;
  const totalPages = Math.max(1, Math.ceil(visibleCategories.length / cardsPerView));
  const safeSlide = Math.min(currentSlide, totalPages - 1);
  const startIndex = enableCarousel ? safeSlide * cardsPerView : 0;
  const pageItems = enableCarousel
    ? visibleCategories.slice(startIndex, startIndex + cardsPerView)
    : visibleCategories.slice(0, cardsPerView);

  const goToSearch = (category: HomeCategoryCard) => {
    const description = String(category.description ?? "").trim();
    if (!description) return;

    const params = new URLSearchParams();
    const queryKey = taxonomyTypeQueryKey(category.taxonomyType);

    if (isCategoryTaxonomy(category.taxonomyType)) {
      params.set("category", description);
    } else {
      params.set(queryKey, description);
      if (queryKey === "prestacion") params.set("primaryGroupKey", "prestacion");
    }

    if (selectedCountry) params.set("country", selectedCountry);
    const storedDestination = readStoredDestination();
    if (storedDestination) params.set("destinationCountry", storedDestination);
    params.set("page", "1");
    router.push(`/buscar?${params.toString()}`);
  };

  const nextSlide = () => {
    if (!enableCarousel) return;
    setCurrentSlide((prev) => (prev + 1) % totalPages);
  };

  const prevSlide = () => {
    if (!enableCarousel) return;
    setCurrentSlide((prev) => (prev - 1 + totalPages) % totalPages);
  };

  const onTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (!enableCarousel) return;
    setTouchEndX(null);
    setTouchStartX(event.changedTouches[0]?.clientX ?? null);
  };

  const onTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    if (!enableCarousel) return;
    setTouchEndX(event.changedTouches[0]?.clientX ?? null);
  };

  const onTouchEnd = () => {
    if (!enableCarousel || touchStartX == null || touchEndX == null) return;
    const deltaX = touchStartX - touchEndX;
    const minSwipe = 45;
    if (deltaX > minSwipe) nextSlide();
    if (deltaX < -minSwipe) prevSlide();
    setTouchStartX(null);
    setTouchEndX(null);
  };

  if (!isClient) return <div ref={sectionRef}>Cargando...</div>;
  if (isLoading || !isInView) {
    return (
      <div
        ref={sectionRef}
        className={`relative mx-auto mt-12 mb-12 w-full animate-pulse rounded-3xl px-4 py-8 ${isOpenModalDemandante || isOpenModalOferente ? "z-0" : "z-10"}`}
        style={{ background: "linear-gradient(90deg, #08D9BD 0%, #04B5BD 50%, #009ABC 100%)" }}
      >
        <div className="mx-auto mb-6 h-8 w-72 rounded-full bg-white/40" />
        <div className="grid grid-cols-1 gap-4 px-6 py-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: cardsPerView }).map((_, index) => (
            <div key={`services-skeleton-${index}`} className="h-72 rounded-[36px] bg-black/20" />
          ))}
        </div>
      </div>
    );
  }
  if (!visibleCategories.length) return null;

  return (
    <div
      ref={sectionRef}
      className={`relative mx-auto mt-12 mb-12 w-full rounded-3xl px-4 py-8 ${isOpenModalDemandante || isOpenModalOferente ? "z-0" : "z-10"}`}
      style={{ background: "linear-gradient(90deg, #08D9BD 0%, #04B5BD 50%, #009ABC 100%)" }}
    >
      <ChangingText phrases={phrasesCarousel} isNotAlone={false} isBlackText={false} isBiggerText={false} />

      <div
        className="relative overflow-hidden px-6 py-4"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="flex">
          <div className="flex w-full">
            {pageItems.map((category) => {
              const title = pickI18nText(category.descriptionI18n ?? null, locale, category.description);
              const icon = String(category.iconImageUrl ?? "").trim();
              const image = String(category.cardImageUrl ?? "").trim();
              return (
                <div
                  key={category.id}
                  className={`flex-shrink-0 px-3 ${cardsPerView === 4 ? "w-1/4" : cardsPerView === 2 ? "w-1/2" : "w-full"}`}
                >
                  <ServiceCard title={title} icon={icon} image={image} onOpen={() => goToSearch(category)} />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {enableCarousel ? (
        <>
          <button
            onClick={prevSlide}
            className="absolute left-3 top-[48%] z-10 flex -translate-y-1/2 items-center justify-center rounded-full bg-white p-3 shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-xl sm:left-2 lg:left-4 lg:top-1/2"
            aria-label="Slide anterior"
          >
            <ChevronRight className="h-6 w-6 rotate-180 text-gray-600" />
          </button>

          <button
            onClick={nextSlide}
            className="absolute right-3 top-[48%] z-10 flex -translate-y-1/2 items-center justify-center rounded-full bg-white p-3 shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-xl sm:right-2 lg:right-4 lg:top-1/2"
            aria-label="Siguiente slide"
          >
            <ChevronRight className="h-6 w-6 text-gray-600" />
          </button>

          <div className="mt-6 flex justify-center space-x-3">
            {Array.from({ length: totalPages }).map((_, index) => (
              <div
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`h-3 w-3 cursor-pointer rounded-full transition-all duration-300 ${
                  safeSlide === index ? "scale-110 bg-white" : "bg-white/50 hover:bg-white/70"
                }`}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function ServiceCard({
  title,
  icon,
  image,
  onOpen,
}: {
  title: string;
  icon: string;
  image: string;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative h-72 w-full cursor-pointer overflow-hidden rounded-[36px] shadow-2xl transition-all duration-300 hover:-translate-y-2 hover:scale-105 hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]"
    >
      <div
        className="absolute inset-0 bg-cover bg-center transition-transform duration-300 group-hover:scale-105"
        style={{
          backgroundImage: image ? `url('${image}')` : "linear-gradient(180deg,#0f172a 0%, #1e293b 100%)",
        }}
      >
        <div className="absolute inset-0 bg-black/50" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
      </div>

      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6">
        {icon ? (
          <div className="mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={icon} alt={`${title} icon`} className="h-20 w-20 object-contain drop-shadow-lg md:h-24 md:w-24" />
          </div>
        ) : null}

        <h3 className="text-center text-[19px] md:text-[22px] font-bold leading-tight text-white drop-shadow-lg">{title}</h3>

        <div className="mt-3 inline-flex items-center">
          <span className="rounded-full bg-white/20 px-3 py-1 text-[14px] text-white backdrop-blur-sm">{t("ver_mas")}</span>
        </div>
      </div>
    </button>
  );
}
