"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type TouchEvent } from "react";
import { ChevronLeft, ChevronRight, Compass, MapPin } from "lucide-react";
import { useCountry } from "@/app/context/CountryProvider";
import { useTranslation } from "@/app/hooks/useTranslation";
import { pickI18nText, type I18nRecord } from "@/app/lib/i18nContent";

const MAX_ITEMS = 8;

type PublicationLite = {
  id: string;
  title: string;
  titleI18n?: I18nRecord | null;
  publisherName?: string | null;
  primaryGroupKey?: string | null;
  category?: string | null;
  categoryI18n?: I18nRecord | null;
  subcategory?: string | null;
  subcategoryI18n?: I18nRecord | null;
  descriptionI18n?: I18nRecord | null;
  city?: string | null;
  country?: string | null;
  price?: string | null;
  currency?: string | null;
  featured?: boolean;
  images?: unknown;
  fields?: Record<string, unknown> | null;
};

type MoreCardLite = {
  id: "__more__";
};
type PrestCategoryLite = { id: string; description: string };
type CategoryApiLite = { id?: string | number; description?: string; taxonomyType?: string | null };

function firstImage(item: PublicationLite) {
  const raw = item.images;
  const arr = Array.isArray(raw) ? raw : [];
  const first = arr.find((entry) => String(entry ?? "").trim());
  return String(first ?? "https://i.ibb.co/VmrmGrx/sin-foto.jpg");
}

function normalizeKey(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function firstPrestacionImage(item: PublicationLite, locale: "es" | "en" | "pt" | "it") {
  const fields = (item.fields ?? {}) as Record<string, unknown>;
  const hero = pickI18nText((fields.prestationHeroImageI18n as I18nRecord | null) ?? null, locale, String(fields.prestationHeroImage ?? "").trim());
  if (hero) return hero;
  const resources = Array.isArray(fields.prestationResources) ? fields.prestationResources : [];
  const firstWithImage = resources.find((entry) => {
    const e = (entry ?? {}) as Record<string, unknown>;
    return String(e.image ?? "").trim();
  }) as Record<string, unknown> | undefined;
  if (firstWithImage) {
    const localized = pickI18nText((firstWithImage.imageI18n as I18nRecord | null) ?? null, locale, String(firstWithImage.image ?? "").trim());
    if (localized) return localized;
  }
  return firstImage(item);
}

function useCardsPerView() {
  const [cardsPerView, setCardsPerView] = useState(4);

  useEffect(() => {
    const update = () => {
      if (window.innerWidth >= 1280) setCardsPerView(4);
      else if (window.innerWidth >= 1024) setCardsPerView(3);
      else if (window.innerWidth >= 768) setCardsPerView(2);
      else setCardsPerView(1);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return cardsPerView;
}

function isPartnerPublication(item: PublicationLite) {
  const fields = (item.fields ?? {}) as Record<string, unknown>;
  return Boolean(fields.partner);
}

function publicationScore(item: PublicationLite) {
  const fields = (item.fields ?? {}) as Record<string, unknown>;
  const visitCount = Number(fields?.visitCount ?? fields?.views ?? 0);
  const contractCount = Number(fields?.contractCount ?? fields?.contracts ?? 0);
  const featuredBoost = item.featured ? 1000 : 0;
  const safeVisits = Number.isFinite(visitCount) ? visitCount : 0;
  const safeContracts = Number.isFinite(contractCount) ? contractCount : 0;
  return featuredBoost + safeVisits + safeContracts * 3;
}

function samePassportPrestacionScore(item: PublicationLite, selectedCountry: string) {
  const base = publicationScore(item);
  const match = normalizeKey(item.country) === normalizeKey(selectedCountry) ? 500 : 0;
  return base + match;
}

export default function FeaturedPublicationsSection() {
  const { selectedCountry } = useCountry();
  const { locale, t } = useTranslation();
  const cardsPerView = useCardsPerView();
  const [items, setItems] = useState<PublicationLite[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [prestacionesSlide, setPrestacionesSlide] = useState(0);
  const [prestTouchStartX, setPrestTouchStartX] = useState<number | null>(null);
  const [prestTouchEndX, setPrestTouchEndX] = useState<number | null>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchEndX, setTouchEndX] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInView, setIsInView] = useState(false);
  const [prestacionCategories, setPrestacionCategories] = useState<PrestCategoryLite[]>([]);
  const [prestacionItems, setPrestacionItems] = useState<PublicationLite[]>([]);
  const [selectedPrestCategory, setSelectedPrestCategory] = useState<string>("");
  const sectionRef = useRef<HTMLElement | null>(null);

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
    const load = async () => {
      const params = new URLSearchParams({
        status: "active",
        page: "1",
        perPage: String(MAX_ITEMS),
      });
      if (selectedCountry) params.set("country", selectedCountry);

      const byPassport = await fetch(`/api/publications?${params.toString()}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .catch(() => ({ items: [] }));
      const list = Array.isArray(byPassport?.items) ? byPassport.items : [];

      const nonPrestaciones = list.filter((pub: PublicationLite) => pub?.primaryGroupKey !== "prestacion");
      const featured = nonPrestaciones.filter((pub: PublicationLite) => Boolean(pub.featured));
      const partners = nonPrestaciones.filter((pub: PublicationLite) => !pub.featured && isPartnerPublication(pub));
      const rest = nonPrestaciones
        .filter((pub: PublicationLite) => !pub.featured && !isPartnerPublication(pub))
        .sort((a: PublicationLite, b: PublicationLite) => publicationScore(b) - publicationScore(a));
      const ordered = [...featured, ...partners, ...rest].slice(0, MAX_ITEMS);

      if (mounted) setItems(ordered);
      const [catsPayload, prestacionesPayload] = await Promise.all([
        fetch("/api/categories", { cache: "no-store" }).then((r) => (r.ok ? r.json() : { items: [] })).catch(() => ({ items: [] })),
        fetch(`/api/publications?status=active&page=1&perPage=48`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : { items: [] })).catch(() => ({ items: [] })),
      ]);
      const categoryItems = (Array.isArray(catsPayload?.items) ? catsPayload.items : []) as CategoryApiLite[];
      const categories = categoryItems
        .filter((c) => String(c?.taxonomyType ?? "").toLowerCase().includes("prestacion"))
        .map((c) => ({ id: String(c.id), description: String(c.description ?? "").trim() }))
        .filter((c: PrestCategoryLite) => c.description);
      const prestationsList = (Array.isArray(prestacionesPayload?.items) ? prestacionesPayload.items : []).filter(
        (pub: PublicationLite) => pub?.primaryGroupKey === "prestacion"
      );
      if (mounted) {
        setPrestacionCategories(categories);
        setPrestacionItems(prestationsList.slice(0, 40));
      }
      if (mounted) setIsLoading(false);
    };
    load().catch(() => {
      if (mounted) setIsLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [selectedCountry, isInView]);

  useEffect(() => {
    if (!selectedPrestCategory && prestacionCategories.length) {
      setSelectedPrestCategory(prestacionCategories[0].description);
    }
  }, [prestacionCategories, selectedPrestCategory]);

  const list = useMemo(() => items.slice(0, MAX_ITEMS), [items]);
  const listWithMore = useMemo<(PublicationLite | MoreCardLite)[]>(
    () => [...list, { id: "__more__" }],
    [list]
  );
  const totalPages = Math.max(1, Math.ceil(listWithMore.length / cardsPerView));
  const safeSlide = Math.min(currentSlide, totalPages - 1);
  const start = safeSlide * cardsPerView;
  const pageItems = listWithMore.slice(start, start + cardsPerView);
  const showCarousel = listWithMore.length > cardsPerView;

  useEffect(() => {
    setCurrentSlide(0);
  }, [cardsPerView, list.length]);

  const onTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (!showCarousel) return;
    setTouchEndX(null);
    setTouchStartX(event.changedTouches[0]?.clientX ?? null);
  };

  const onTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    if (!showCarousel) return;
    setTouchEndX(event.changedTouches[0]?.clientX ?? null);
  };

  const onTouchEnd = () => {
    if (!showCarousel || touchStartX == null || touchEndX == null) return;
    const deltaX = touchStartX - touchEndX;
    const minSwipe = 45;
    if (deltaX > minSwipe) setCurrentSlide((prev) => (prev + 1) % totalPages);
    if (deltaX < -minSwipe) setCurrentSlide((prev) => (prev - 1 + totalPages) % totalPages);
    setTouchStartX(null);
    setTouchEndX(null);
  };

  const filteredPrestaciones = prestacionItems.filter((item) => {
    if (!selectedPrestCategory) return true;
    const selected = normalizeKey(selectedPrestCategory);
    const categoryLabel = normalizeKey(item.category);
    const subcategoryLabel = normalizeKey(item.subcategory);
    const fields = (item.fields ?? {}) as Record<string, unknown>;
    const selectedPrestaciones = Array.isArray(fields.prestaciones)
      ? fields.prestaciones.map((entry) => normalizeKey(entry)).filter(Boolean)
      : [];
    const selectedCategories = Array.isArray(fields.categorySelections)
      ? fields.categorySelections.map((entry) => normalizeKey(entry)).filter(Boolean)
      : [];
    const selectedSubcategories = Array.isArray(fields.subcategorySelections)
      ? fields.subcategorySelections.map((entry) => normalizeKey(entry)).filter(Boolean)
      : [];

    return (
      categoryLabel === selected
      || subcategoryLabel === selected
      || selectedPrestaciones.includes(selected)
      || selectedCategories.includes(selected)
      || selectedSubcategories.includes(selected)
    );
  });
  const rankedPrestaciones = [...(filteredPrestaciones.length ? filteredPrestaciones : prestacionItems)]
    .sort((a, b) => samePassportPrestacionScore(b, selectedCountry) - samePassportPrestacionScore(a, selectedCountry));
  const prestacionesToShow = rankedPrestaciones.slice(0, 5);
  const categoriesWithPublications = prestacionCategories.filter((category) => {
    const key = normalizeKey(category.description);
    return prestacionItems.some((item) => {
      const fields = (item.fields ?? {}) as Record<string, unknown>;
      const selectedPrestaciones = Array.isArray(fields.prestaciones)
        ? fields.prestaciones.map((entry) => normalizeKey(entry)).filter(Boolean)
        : [];
      const selectedCategories = Array.isArray(fields.categorySelections)
        ? fields.categorySelections.map((entry) => normalizeKey(entry)).filter(Boolean)
        : [];
      const selectedSubcategories = Array.isArray(fields.subcategorySelections)
        ? fields.subcategorySelections.map((entry) => normalizeKey(entry)).filter(Boolean)
        : [];
      return (
        normalizeKey(item.category) === key
        || normalizeKey(item.subcategory) === key
        || selectedPrestaciones.includes(key)
        || selectedCategories.includes(key)
        || selectedSubcategories.includes(key)
      );
    });
  });
  const showPrestacionesSection = categoriesWithPublications.length > 0;

  const prestCardsPerView = cardsPerView >= 4 ? 4 : cardsPerView >= 2 ? 2 : 1;
  const prestTotalPages = Math.max(1, Math.ceil(prestacionesToShow.length / prestCardsPerView));
  const safePrestSlide = Math.min(prestacionesSlide, prestTotalPages - 1);
  const prestStart = safePrestSlide * prestCardsPerView;
  const prestPageItems = prestacionesToShow.slice(prestStart, prestStart + prestCardsPerView);
  const showPrestCarousel = prestacionesToShow.length > prestCardsPerView;

  useEffect(() => {
    setPrestacionesSlide(0);
  }, [selectedPrestCategory, cardsPerView, prestacionesToShow.length]);

  useEffect(() => {
    if (prestacionesSlide > prestTotalPages - 1) setPrestacionesSlide(0);
  }, [prestacionesSlide, prestTotalPages]);

  const onPrestTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (!showPrestCarousel) return;
    setPrestTouchEndX(null);
    setPrestTouchStartX(event.changedTouches[0]?.clientX ?? null);
  };

  const onPrestTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    if (!showPrestCarousel) return;
    setPrestTouchEndX(event.changedTouches[0]?.clientX ?? null);
  };

  const onPrestTouchEnd = () => {
    if (!showPrestCarousel || prestTouchStartX == null || prestTouchEndX == null) return;
    const deltaX = prestTouchStartX - prestTouchEndX;
    if (deltaX > 45) setPrestacionesSlide((prev) => (prev + 1) % prestTotalPages);
    if (deltaX < -45) setPrestacionesSlide((prev) => (prev - 1 + prestTotalPages) % prestTotalPages);
    setPrestTouchStartX(null);
    setPrestTouchEndX(null);
  };

  useEffect(() => {
    if (!categoriesWithPublications.length) return;
    if (!categoriesWithPublications.some((category) => category.description === selectedPrestCategory)) {
      setSelectedPrestCategory(categoriesWithPublications[0].description);
    }
  }, [categoriesWithPublications, selectedPrestCategory]);

  if (isLoading || !isInView) {
    return (
      <section ref={sectionRef} className="mt-6 px-4 sm:px-5 md:mt-8 md:px-6 lg:px-0">
        <div className="mb-4 h-8 w-96 max-w-full animate-pulse rounded-full bg-slate-200/80" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: cardsPerView }).map((_, idx) => (
            <div key={`featured-skeleton-${idx}`} className="h-[22rem] animate-pulse rounded-3xl bg-slate-200/70" />
          ))}
        </div>
      </section>
    );
  }
  if (!list.length) return null;

  return (
    <section ref={sectionRef} className="mt-6 px-4 sm:px-5 md:mt-8 md:px-6 lg:px-0">
      <div className="mb-10 overflow-hidden rounded-[28px] bg-[url(/fondo-frase-el-cliente.webp)] bg-cover bg-center px-6 py-8 text-center text-white shadow md:px-8 md:py-10">
        <p className="text-2xl font-bold leading-tight md:text-3xl">
          <span className="text-[#273166]">{t("formacion_banner_emphasis")}</span> {t("formacion_banner_rest")}
        </p>
      </div>

      <div className="mb-8 flex items-center justify-center gap-3 text-center md:mb-10">
        <h2 className="text-[22px] font-bold leading-tight text-[#273166] md:text-[25.76px]">
          {t("oportunidades_destacadas_soluciones_activas")}
        </h2>
      </div>

      <div className="relative" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {pageItems.map((item) => {
            if (item.id === "__more__") {
              return (
                <Link
                  key={item.id}
                  href={selectedCountry ? `/buscar?country=${encodeURIComponent(selectedCountry)}` : "/buscar"}
                  className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="relative h-full min-h-[22rem] w-full bg-slate-100">
                    <Image
                      src="https://i.ibb.co/VmrmGrx/sin-foto.jpg"
                      alt="Travelgrin"
                      fill
                      className="object-cover"
                      sizes="(max-width: 1280px) 50vw, 25vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-slate-900/20 via-slate-900/40 to-slate-900/60" />
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
                    <span className="rounded-full bg-white/90 px-7 py-3 text-xl md:text-2xl font-extrabold leading-tight text-[#273166] shadow-lg transition group-hover:scale-105">
                      {t("ver_mas")}
                    </span>
                  </div>
                </Link>
              );
            }
            const title = pickI18nText(item.titleI18n ?? null, locale, item.title);
            const fields = (item.fields ?? {}) as Record<string, unknown>;
            const categorySelections = Array.isArray(fields?.categorySelections)
              ? (fields.categorySelections as unknown[]).map((value) => String(value ?? "").trim()).filter(Boolean)
              : [];
            const categoryLabel = categorySelections[0]
              || (item.category ? pickI18nText(item.categoryI18n ?? null, locale, item.category) : "");
            const subcategoryLabel = item.subcategory ? pickI18nText(item.subcategoryI18n ?? null, locale, item.subcategory) : "";
            const location = [String(item.city ?? "").trim(), String(item.country ?? "").trim()].filter(Boolean).join(", ");
            const isPartner = Boolean(fields.partner);
            const providerType = String(fields?.providerType ?? "").trim();
            const destination = Array.isArray(fields?.destinationCountries)
              ? String((fields.destinationCountries as unknown[])[0] ?? "").trim()
              : "";
            const isPrestacion = item.primaryGroupKey === "prestacion";
            const detailPath = isPrestacion ? `/prestaciones/${item.id}` : `/publicacion/${item.id}`;
            return (
              <Link
                key={item.id}
                href={detailPath}
                className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="relative h-44 w-full bg-slate-100">
                  <Image src={firstImage(item)} alt={title} fill className="object-cover" sizes="(max-width: 1280px) 50vw, 25vw" />
                </div>
                <div className="space-y-2 p-4">
                  <div className="flex flex-wrap gap-1">
                    {item.featured ? <span className="rounded-full bg-[#00A9C6] px-2 py-0.5 text-[11px] font-semibold text-white">★ Destacado</span> : null}
                    {isPartner ? <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[11px] font-semibold text-cyan-700">🤝 Partner</span> : null}
                  </div>
                  <p className="text-xs text-slate-500">{item.publisherName || t("oferente_nombre_placeholder")}</p>
                  <h3 className="line-clamp-2 text-lg md:text-xl font-semibold leading-tight text-[#273166]">{title}</h3>
                  <p className="text-sm text-slate-600">{categoryLabel || subcategoryLabel || "-"}</p>
                  <p className="flex items-center gap-1 text-sm text-slate-600">
                    <MapPin className="h-4 w-4 text-[#0B8FA3]" />
                    {location || destination || "-"}
                  </p>
                  {providerType ? <p className="text-xs font-medium text-slate-500">Tipo: {providerType}</p> : null}
                  <p className="flex items-center gap-1 text-sm text-slate-600">
                    <span>🏳️</span>{location || destination || "-"}
                  </p>
                  <p className="text-sm font-semibold text-[#0B8FA3]">{item.price ? `${item.currency ? `${item.currency} ` : ""}${item.price}` : t("precio_convenir")}</p>
                  <div className="pt-1">
                    <span className="inline-flex w-full items-center justify-center rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                      {isPrestacion ? t("ver_prestacion") : t("ver_mas")}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {showCarousel ? (
          <>
            <button
              type="button"
              aria-label="Anterior"
              onClick={() => setCurrentSlide((prev) => (prev - 1 + totalPages) % totalPages)}
              className="absolute -left-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-white p-2 shadow lg:flex md:-left-4"
            >
              <ChevronLeft className="h-5 w-5 text-slate-600" />
            </button>
            <button
              type="button"
              aria-label="Siguiente"
              onClick={() => setCurrentSlide((prev) => (prev + 1) % totalPages)}
              className="absolute -right-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-white p-2 shadow lg:flex md:-right-4"
            >
              <ChevronRight className="h-5 w-5 text-slate-600" />
            </button>
            <div className="mt-4 flex justify-center gap-2">
              {Array.from({ length: totalPages }).map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  aria-label={`Ir a página ${idx + 1}`}
                  onClick={() => setCurrentSlide(idx)}
                  className={`h-2.5 w-2.5 rounded-full ${safeSlide === idx ? "bg-[#0B8FA3]" : "bg-slate-300"}`}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>

      <div className="mt-12 overflow-hidden rounded-[28px] bg-[url(/fondo-frase-el-cliente.webp)] bg-cover bg-center px-6 py-8 text-center text-white shadow md:px-8 md:py-10">
        <p className="text-2xl font-bold leading-tight md:text-3xl"><span className="text-[#273166]">{t("ciudadano_banner_line1")}</span><br/>{t("ciudadano_banner_line2")}</p>
      </div>

      {showPrestacionesSection ? (
      <section className="mt-12 rounded-[28px] border border-[#DDEAF5] bg-gradient-to-b from-[#F5F8FD] to-[#F8FAFC] p-4 shadow-[0_10px_30px_rgba(39,49,102,0.06)] md:p-8">
        <div className="text-center">
          <h3 className="text-2xl font-bold text-[#273166]">{t("suma_prestaciones_plan_viaje")}</h3>
          <p className="mt-1 text-sm text-slate-500">{t("explorar_prestaciones_subtitulo")}</p>
          <p className="mt-2 text-sm text-slate-600">{t("explorar_prestaciones_que_son")}</p>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <button type="button" aria-label="Categorías anteriores" onClick={() => document.getElementById("prest-cats")?.scrollBy({ left: -180, behavior: "smooth" })} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div id="prest-cats" className="flex flex-1 gap-2 overflow-x-auto pb-1">
          {categoriesWithPublications.map((category) => {
            const active = selectedPrestCategory === category.description;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => setSelectedPrestCategory(category.description)}
                className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${
                  active
                    ? "bg-[#0B8FA3] text-white shadow-[0_8px_18px_rgba(11,143,163,0.25)]"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                <Compass className="h-4 w-4" />
                {category.description}
              </button>
            );
          })}
          </div>
          <button type="button" aria-label="Más categorías" onClick={() => document.getElementById("prest-cats")?.scrollBy({ left: 180, behavior: "smooth" })} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-5" onTouchStart={onPrestTouchStart} onTouchMove={onPrestTouchMove} onTouchEnd={onPrestTouchEnd}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {prestPageItems.map((item) => {
            const title = pickI18nText(item.titleI18n ?? null, locale, item.title);
            const desc = item.subcategory
              ? pickI18nText(item.subcategoryI18n ?? null, locale, item.subcategory)
              : pickI18nText(item.descriptionI18n ?? null, locale, item.category ?? "");
            return (
              <Link
                key={`prest-${item.id}`}
                href={`/prestaciones/${item.id}`}
                className="group overflow-hidden rounded-2xl border border-[#BFEAF3] bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="relative h-32 w-full bg-slate-100">
                  <Image src={firstPrestacionImage(item, locale)} alt={title} fill className="object-cover" />
                </div>
                <div className="space-y-2 p-4">
                  <h4 className="line-clamp-2 text-base font-bold text-[#273166]">{title}</h4>
                  <p className="line-clamp-1 text-sm text-slate-500">{desc || t("prestacion_disponible")}</p>
                  <span className="inline-flex w-full items-center justify-center rounded-lg bg-[#EAF9FB] px-3 py-2 text-sm font-semibold text-[#0B6B7A]">
                    {t("ver_mas")}
                  </span>
                </div>
              </Link>
            );
          })}
          </div>
          {showPrestCarousel ? (
            <div className="mt-4 flex justify-center gap-2">
              {Array.from({ length: prestTotalPages }).map((_, idx) => (
                <button key={`prest-dot-${idx}`} type="button" aria-label={`Prestaciones página ${idx + 1}`} onClick={() => setPrestacionesSlide(idx)} className={`h-2.5 w-2.5 rounded-full ${safePrestSlide === idx ? "bg-[#0B8FA3]" : "bg-slate-300"}`} />
              ))}
            </div>
          ) : null}
        </div>
        <div className="mt-4 flex justify-end">
          <Link href={selectedPrestCategory ? `/buscar?primaryGroupKey=prestacion&prestacion=${encodeURIComponent(selectedPrestCategory)}` : "/buscar?primaryGroupKey=prestacion"} className="text-sm font-semibold text-[#0B8FA3] hover:underline">
            {t("ver_todas_las_prestaciones")} →
          </Link>
        </div>
      </section>
      ) : null}
    </section>
  );
}
