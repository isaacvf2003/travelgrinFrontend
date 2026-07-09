"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type MouseEventHandler, type TouchEvent } from "react";
import { ChevronLeft, ChevronRight, Compass, Handshake, MapPin, Star } from "lucide-react";
import { useCountry } from "@/app/context/CountryProvider";
import { useTranslation } from "@/app/hooks/useTranslation";
import {
  buildBuscarHrefWithDestination,
  DESTINATION_CHANGE_EVENT,
  readStoredDestination,
} from "@/app/lib/destinationStore";
import { pickI18nText, type I18nRecord } from "@/app/lib/i18nContent";
import ChangingText from "@/components/ChangingText";
import PharseWithBackground from "@/components/PharseWithBackground";

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
  languages?: string[] | string | null;
  featured?: boolean;
  images?: unknown;
  fields?: Record<string, unknown> | null;
};
type MoreCardLite = {
  id: "__more__";
};

type PrestCategoryLite = { id: string; description: string };
type CategoryApiLite = {
  id?: string | number;
  description?: string;
  taxonomyType?: string | null;
};
type CountryFlagItem = {
  cca2?: string;
  name?: { common?: string; official?: string };
  translations?: { spa?: { common?: string; official?: string } };
};

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

const COUNTRY_CODE_MAP: Record<string, string> = {
  alandia: "AX",
  albania: "AL",
  alemania: "DE",
  andorra: "AD",
  argentina: "AR",
  brasil: "BR",
  brazil: "BR",
  canada: "CA",
  chile: "CL",
  colombia: "CO",
  espana: "ES",
  francia: "FR",
  france: "FR",
  germany: "DE",
  italia: "IT",
  mexico: "MX",
  paraguay: "PY",
  peru: "PE",
  uruguay: "UY",
};

function getCountryCode(country: unknown, catalog: Record<string, string> = {}) {
  const raw = String(country ?? "").trim();
  const normalized = normalizeKey(raw);
  const tokenized = raw.split(/\s+/).map((token) => normalizeKey(token));
  const candidates = [normalized, ...tokenized].filter(Boolean);

  for (const key of candidates) {
    if (/^[a-z]{2}$/i.test(key)) return key.toUpperCase();
    if (catalog[key]) return catalog[key];
    if (COUNTRY_CODE_MAP[key]) return COUNTRY_CODE_MAP[key];
  }
  return "";
}

function shortLanguageCode(value: unknown) {
  const normalized = normalizeKey(value);
  if (!normalized) return "";
  if (["es", "esp", "espanol", "spanish"].includes(normalized)) return "ES";
  if (["en", "eng", "ingles", "english"].includes(normalized)) return "EN";
  if (["pt", "por", "portugues", "portuguese"].includes(normalized)) return "PT";
  if (["it", "ita", "italiano", "italian"].includes(normalized)) return "IT";
  return String(value ?? "").trim().slice(0, 2).toUpperCase();
}

function resolveLanguageCodes(item: PublicationLite) {
  const fields = (item.fields ?? {}) as Record<string, unknown>;
  const raw = Array.isArray(item.languages)
    ? item.languages
    : item.languages
      ? [item.languages]
      : Array.isArray(fields.languages)
        ? fields.languages
        : fields.languages
          ? [fields.languages]
          : [];
  return Array.from(new Set(raw.map(shortLanguageCode).filter(Boolean)));
}

function firstPrestacionImage(
  item: PublicationLite,
  locale: "es" | "en" | "pt" | "it",
) {
  const fields = (item.fields ?? {}) as Record<string, unknown>;
  const hero = pickI18nText(
    (fields.prestationHeroImageI18n as I18nRecord | null) ?? null,
    locale,
    String(fields.prestationHeroImage ?? "").trim(),
  );
  if (hero) return hero;
  const resources = Array.isArray(fields.prestationResources)
    ? fields.prestationResources
    : [];
  const firstWithImage = resources.find((entry) => {
    const e = (entry ?? {}) as Record<string, unknown>;
    return String(e.image ?? "").trim();
  }) as Record<string, unknown> | undefined;
  if (firstWithImage) {
    const localized = pickI18nText(
      (firstWithImage.imageI18n as I18nRecord | null) ?? null,
      locale,
      String(firstWithImage.image ?? "").trim(),
    );
    if (localized) return localized;
  }
  return firstImage(item);
}

function useCardsPerView() {
  const [cardsPerView, setCardsPerView] = useState(3);

  useEffect(() => {
    const update = () => {
      if (window.innerWidth >= 1024) setCardsPerView(3);
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

function samePassportPrestacionScore(
  item: PublicationLite,
  selectedCountry: string,
) {
  const base = publicationScore(item);
  const match =
    normalizeKey(item.country) === normalizeKey(selectedCountry) ? 500 : 0;
  return base + match;
}

function positiveModulo(value: number, length: number) {
  if (length <= 0) return 0;
  return ((value % length) + length) % length;
}

function carouselWindow<T>(
  entries: T[],
  activeIndex: number,
  requestedSize: number,
) {
  if (!entries.length) return [];
  const windowSize = Math.min(entries.length, Math.max(1, requestedSize));
  const centerOffset = windowSize >= 4 ? 1 : Math.floor(windowSize / 2);
  return Array.from({ length: windowSize }, (_, position) => {
    const sourceIndex = positiveModulo(
      activeIndex + position - centerOffset,
      entries.length,
    );
    return { entry: entries[sourceIndex], sourceIndex, position, centerOffset };
  });
}

function carouselWindowSize(cardsPerView: number) {
  if (cardsPerView >= 3) return 4;
  if (cardsPerView >= 2) return 3;
  return 1;
}

function carouselDepthClass(
  isSideCard: boolean,
  position: number,
  centerOffset: number,
  focusedPosition = centerOffset,
) {
  if (isSideCard) {
    return position < centerOffset
      ? "relative z-0 -translate-x-3"
      : "relative z-0 translate-x-3";
  }
  return position === focusedPosition ? "relative z-20" : "relative z-10";
}

export default function FeaturedPublicationsSection() {
  const { selectedCountry } = useCountry();
  const { locale, t } = useTranslation();
  const [storedDestination, setStoredDestination] = useState("");
  const cardsPerView = useCardsPerView();
  const [items, setItems] = useState<PublicationLite[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [featuredFocusOffset, setFeaturedFocusOffset] = useState<0 | 1>(0);
  const [prestacionesSlide, setPrestacionesSlide] = useState(0);
  const [prestacionesFocusOffset, setPrestacionesFocusOffset] = useState<0 | 1>(0);
  const [prestTouchStartX, setPrestTouchStartX] = useState<number | null>(null);
  const [prestTouchEndX, setPrestTouchEndX] = useState<number | null>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchEndX, setTouchEndX] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInView, setIsInView] = useState(false);
  const [isPrestacionesPaused, setIsPrestacionesPaused] = useState(false);
  const prestCategoryTrackRef = useRef<HTMLDivElement | null>(null);
  const [prestacionCategories, setPrestacionCategories] = useState<
    PrestCategoryLite[]
  >([]);
  const [prestacionItems, setPrestacionItems] = useState<PublicationLite[]>([]);
  const [selectedPrestCategory, setSelectedPrestCategory] =
    useState<string>("");
  const [countryCodeCatalog, setCountryCodeCatalog] = useState<Record<string, string>>({});
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const syncStoredDestination = (event?: Event) => {
      const eventDestination =
        event instanceof CustomEvent ? String(event.detail ?? "").trim() : "";
      setStoredDestination(eventDestination || readStoredDestination());
    };

    syncStoredDestination();
    window.addEventListener(DESTINATION_CHANGE_EVENT, syncStoredDestination);
    window.addEventListener("storage", syncStoredDestination);

    return () => {
      window.removeEventListener(DESTINATION_CHANGE_EVENT, syncStoredDestination);
      window.removeEventListener("storage", syncStoredDestination);
    };
  }, []);

  const buildSearchHref = (params: Record<string, string | undefined> = {}) =>
    buildBuscarHrefWithDestination(params, storedDestination, selectedCountry);

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
      { rootMargin: "200px 0px" },
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

      const byPassport = await fetch(`/api/publications?${params.toString()}`, {
        cache: "no-store",
      })
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .catch(() => ({ items: [] }));
      const list = Array.isArray(byPassport?.items) ? byPassport.items : [];

      const nonPrestaciones = list.filter(
        (pub: PublicationLite) => pub?.primaryGroupKey !== "prestacion",
      );
      const featured = nonPrestaciones.filter((pub: PublicationLite) =>
        Boolean(pub.featured),
      );
      const partners = nonPrestaciones.filter(
        (pub: PublicationLite) => !pub.featured && isPartnerPublication(pub),
      );
      const rest = nonPrestaciones
        .filter(
          (pub: PublicationLite) => !pub.featured && !isPartnerPublication(pub),
        )
        .sort(
          (a: PublicationLite, b: PublicationLite) =>
            publicationScore(b) - publicationScore(a),
        );
      const ordered = [...featured, ...partners, ...rest].slice(0, MAX_ITEMS);

      if (mounted) setItems(ordered);
      const [catsPayload, prestacionesPayload] = await Promise.all([
        fetch("/api/categories", { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : { items: [] }))
          .catch(() => ({ items: [] })),
        fetch(`/api/publications?status=active&page=1&perPage=48`, {
          cache: "no-store",
        })
          .then((r) => (r.ok ? r.json() : { items: [] }))
          .catch(() => ({ items: [] })),
      ]);
      const categoryItems = (
        Array.isArray(catsPayload?.items) ? catsPayload.items : []
      ) as CategoryApiLite[];
      const categories = categoryItems
        .filter((c) =>
          String(c?.taxonomyType ?? "")
            .toLowerCase()
            .includes("prestacion"),
        )
        .map((c) => ({
          id: String(c.id),
          description: String(c.description ?? "").trim(),
        }))
        .filter((c: PrestCategoryLite) => c.description);
      const prestationsList = (
        Array.isArray(prestacionesPayload?.items)
          ? prestacionesPayload.items
          : []
      ).filter((pub: PublicationLite) => pub?.primaryGroupKey === "prestacion");
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
    if (!isInView || Object.keys(countryCodeCatalog).length) return;
    let mounted = true;
    fetch("/api/countries", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : { items: [] }))
      .then((payload) => {
        const items = Array.isArray(payload?.items) ? payload.items : [];
        if (!mounted || !items.length) return;
        const next: Record<string, string> = {};
        (items as CountryFlagItem[]).forEach((country) => {
          const code = String(country.cca2 ?? "").trim().toUpperCase();
          if (!/^[A-Z]{2}$/.test(code)) return;
          [
            country.name?.common,
            country.name?.official,
            country.translations?.spa?.common,
            country.translations?.spa?.official,
          ].forEach((label) => {
            const key = normalizeKey(label);
            if (key) next[key] = code;
          });
        });
        setCountryCodeCatalog(next);
      })
      .catch(() => null);
    return () => {
      mounted = false;
    };
  }, [countryCodeCatalog, isInView]);

  useEffect(() => {
    if (!selectedPrestCategory && prestacionCategories.length) {
      setSelectedPrestCategory(prestacionCategories[0].description);
    }
  }, [prestacionCategories, selectedPrestCategory]);

  const featuredItems = useMemo(() => items.slice(0, MAX_ITEMS), [items]);
  const showFixedMoreCardDesktop = cardsPerView >= 3;
  const featuredCarouselItems = useMemo<(PublicationLite | MoreCardLite)[]>(
    () => (showFixedMoreCardDesktop ? featuredItems : [...featuredItems, { id: "__more__" }]),
    [featuredItems, showFixedMoreCardDesktop],
  );
  const featuredVisibleCount = carouselWindowSize(cardsPerView);
  const featuredActiveIndex = positiveModulo(currentSlide, featuredCarouselItems.length);
  const featuredWindowItems = carouselWindow(
    featuredCarouselItems,
    featuredActiveIndex,
    featuredVisibleCount,
  );
  const showCarousel = featuredCarouselItems.length > 1;
  const featuredPairMode = featuredWindowItems.length >= 4;
  const featuredFocusedIndex = positiveModulo(
    featuredActiveIndex + (featuredPairMode ? featuredFocusOffset : 0),
    featuredCarouselItems.length,
  );

  const moveFeaturedCarousel = (direction: 1 | -1) => {
    if (!showCarousel || !featuredCarouselItems.length) return;

    if (!featuredPairMode) {
      setCurrentSlide((prev) => positiveModulo(prev + direction, featuredCarouselItems.length));
      setFeaturedFocusOffset(0);
      return;
    }

    if (direction > 0) {
      if (featuredFocusOffset === 0) {
        setFeaturedFocusOffset(1);
        return;
      }
      setFeaturedFocusOffset(0);
      setCurrentSlide((prev) => positiveModulo(prev + 2, featuredCarouselItems.length));
      return;
    }

    if (featuredFocusOffset === 1) {
      setFeaturedFocusOffset(0);
      return;
    }
    setFeaturedFocusOffset(1);
    setCurrentSlide((prev) => positiveModulo(prev - 2, featuredCarouselItems.length));
  };

  const focusFeaturedSource = (sourceIndex: number) => {
    if (featuredPairMode && sourceIndex === positiveModulo(featuredActiveIndex + 1, featuredCarouselItems.length)) {
      setFeaturedFocusOffset(1);
      return;
    }
    setFeaturedFocusOffset(0);
    setCurrentSlide(sourceIndex);
  };

  useEffect(() => {
    setCurrentSlide(0);
    setFeaturedFocusOffset(0);
  }, [cardsPerView, featuredCarouselItems.length]);

  useEffect(() => {
    if (featuredCarouselItems.length)
      setCurrentSlide((prev) => positiveModulo(prev, featuredCarouselItems.length));
  }, [featuredCarouselItems.length]);

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
    if (!showCarousel || touchStartX == null || touchEndX == null) {
      return;
    }
    const deltaX = touchStartX - touchEndX;
    const minSwipe = 45;
    if (deltaX > minSwipe) moveFeaturedCarousel(1);
    if (deltaX < -minSwipe) moveFeaturedCarousel(-1);
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
      ? fields.categorySelections
          .map((entry) => normalizeKey(entry))
          .filter(Boolean)
      : [];
    const selectedSubcategories = Array.isArray(fields.subcategorySelections)
      ? fields.subcategorySelections
          .map((entry) => normalizeKey(entry))
          .filter(Boolean)
      : [];

    return (
      categoryLabel === selected ||
      subcategoryLabel === selected ||
      selectedPrestaciones.includes(selected) ||
      selectedCategories.includes(selected) ||
      selectedSubcategories.includes(selected)
    );
  });
  const rankedPrestaciones = [
    ...(filteredPrestaciones.length ? filteredPrestaciones : prestacionItems),
  ].sort(
    (a, b) =>
      samePassportPrestacionScore(b, selectedCountry) -
      samePassportPrestacionScore(a, selectedCountry),
  );
  const prestacionesToShow = rankedPrestaciones.slice(0, 5);
  const categoriesWithPublications = prestacionCategories.filter((category) => {
    const key = normalizeKey(category.description);
    return prestacionItems.some((item) => {
      const fields = (item.fields ?? {}) as Record<string, unknown>;
      const selectedPrestaciones = Array.isArray(fields.prestaciones)
        ? fields.prestaciones
            .map((entry) => normalizeKey(entry))
            .filter(Boolean)
        : [];
      const selectedCategories = Array.isArray(fields.categorySelections)
        ? fields.categorySelections
            .map((entry) => normalizeKey(entry))
            .filter(Boolean)
        : [];
      const selectedSubcategories = Array.isArray(fields.subcategorySelections)
        ? fields.subcategorySelections
            .map((entry) => normalizeKey(entry))
            .filter(Boolean)
        : [];
      return (
        normalizeKey(item.category) === key ||
        normalizeKey(item.subcategory) === key ||
        selectedPrestaciones.includes(key) ||
        selectedCategories.includes(key) ||
        selectedSubcategories.includes(key)
      );
    });
  });
  const showPrestacionesSection = categoriesWithPublications.length > 0;
  const showPrestCategoryScrollButtons = categoriesWithPublications.length > 1;
  const showPrestCategoryDesktopScrollButtons = categoriesWithPublications.length > 5 && cardsPerView >= 2;
  const scrollPrestCategoryTrack = (direction: -1 | 1) => {
    const track = prestCategoryTrackRef.current;
    if (!track) return;
    track.scrollBy({ left: direction * track.clientWidth, behavior: "smooth" });
  };

  const prestVisibleCount = carouselWindowSize(cardsPerView);
  const safePrestSlide = positiveModulo(
    prestacionesSlide,
    prestacionesToShow.length,
  );
  const prestWindowItems = carouselWindow(
    prestacionesToShow,
    safePrestSlide,
    prestVisibleCount,
  );
  const showPrestCarousel = prestacionesToShow.length > 1;
  const prestPairMode = prestWindowItems.length >= 4;
  const prestFocusedIndex = prestacionesToShow.length
    ? positiveModulo(
        safePrestSlide + (prestPairMode ? prestacionesFocusOffset : 0),
        prestacionesToShow.length,
      )
    : 0;

  const movePrestacionesCarousel = (direction: 1 | -1) => {
    if (!showPrestCarousel || !prestacionesToShow.length) return;

    if (!prestPairMode) {
      setPrestacionesSlide((prev) =>
        positiveModulo(prev + direction, prestacionesToShow.length),
      );
      setPrestacionesFocusOffset(0);
      return;
    }

    if (direction > 0) {
      if (prestacionesFocusOffset === 0) {
        setPrestacionesFocusOffset(1);
        return;
      }
      setPrestacionesFocusOffset(0);
      setPrestacionesSlide((prev) =>
        positiveModulo(prev + 2, prestacionesToShow.length),
      );
      return;
    }

    if (prestacionesFocusOffset === 1) {
      setPrestacionesFocusOffset(0);
      return;
    }
    setPrestacionesFocusOffset(1);
    setPrestacionesSlide((prev) =>
      positiveModulo(prev - 2, prestacionesToShow.length),
    );
  };

  const focusPrestSource = (sourceIndex: number) => {
    if (
      prestPairMode &&
      sourceIndex === positiveModulo(safePrestSlide + 1, prestacionesToShow.length)
    ) {
      setPrestacionesFocusOffset(1);
      return;
    }
    setPrestacionesFocusOffset(0);
    setPrestacionesSlide(sourceIndex);
  };

  useEffect(() => {
    setPrestacionesSlide(0);
    setPrestacionesFocusOffset(0);
  }, [selectedPrestCategory, cardsPerView, prestacionesToShow.length]);

  useEffect(() => {
    if (prestacionesToShow.length)
      setPrestacionesSlide((prev) =>
        positiveModulo(prev, prestacionesToShow.length),
      );
  }, [prestacionesToShow.length]);

  useEffect(() => {
    if (isPrestacionesPaused || !isInView || !showPrestCarousel || prestacionesToShow.length < 2) return;
    const timer = window.setInterval(() => {
      if (prestPairMode && prestacionesFocusOffset === 0) {
        setPrestacionesFocusOffset(1);
      } else if (prestPairMode) {
        setPrestacionesFocusOffset(0);
        setPrestacionesSlide((prev) => positiveModulo(prev + 2, prestacionesToShow.length));
      } else {
        setPrestacionesSlide((prev) => positiveModulo(prev + 1, prestacionesToShow.length));
      }
    }, 5200);
    return () => window.clearInterval(timer);
  }, [
    isInView,
    isPrestacionesPaused,
    prestPairMode,
    prestacionesFocusOffset,
    prestacionesToShow.length,
    showPrestCarousel,
  ]);

  const onPrestTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (!showPrestCarousel) return;
    setIsPrestacionesPaused(true);
    setPrestTouchEndX(null);
    setPrestTouchStartX(event.changedTouches[0]?.clientX ?? null);
  };

  const onPrestTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    if (!showPrestCarousel) return;
    setPrestTouchEndX(event.changedTouches[0]?.clientX ?? null);
  };

  const onPrestTouchEnd = () => {
    if (
      !showPrestCarousel ||
      prestTouchStartX == null ||
      prestTouchEndX == null
    ) {
      setIsPrestacionesPaused(false);
      return;
    }
    const deltaX = prestTouchStartX - prestTouchEndX;
    if (deltaX > 45) movePrestacionesCarousel(1);
    if (deltaX < -45) movePrestacionesCarousel(-1);
    setPrestTouchStartX(null);
    setPrestTouchEndX(null);
    setIsPrestacionesPaused(false);
  };

  useEffect(() => {
    if (!categoriesWithPublications.length) return;
    if (
      !categoriesWithPublications.some(
        (category) => category.description === selectedPrestCategory,
      )
    ) {
      setSelectedPrestCategory(categoriesWithPublications[0].description);
    }
  }, [categoriesWithPublications, selectedPrestCategory]);

  if (isLoading || !isInView) {
    return (
      <section
        ref={sectionRef}
        className="mt-6 px-4 sm:px-5 md:mt-8 md:px-6 lg:px-0"
      >
        <div className="mb-4 h-8 w-96 max-w-full animate-pulse rounded-full bg-slate-200/80" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
          {Array.from({ length: cardsPerView }).map((_, idx) => (
            <div
              key={`featured-skeleton-${idx}`}
              className="h-[22rem] animate-pulse rounded-3xl bg-slate-200/70"
            />
          ))}
        </div>
      </section>
    );
  }
  if (!featuredItems.length) return null;

  const phrasesThePractice = [
    t("el_asesor"),
    t("la_cura"),
    t("la_formacion"),
    t("el_documento"),
    t("el_socio"),
    t("el_cliente"),
    t("el_proveedor"),
    t("la_experiencia"),
    t("el_colaborador"),
  ];

  return (
    <section
      ref={sectionRef}
      className="mt-6 px-4 sm:px-5 md:mt-8 md:px-6 lg:px-0"
    >
      <div className="mx-auto mb-10 w-full max-w-6xl overflow-hidden rounded-[28px] bg-[url(/fondo-frase-el-cliente.webp)] bg-cover bg-center px-6 py-8 text-center text-white shadow md:px-8 md:py-10">
        <ChangingText phrases={phrasesThePractice} isNotAlone isBlackText />
      </div>

      <div className="mb-8 flex items-center justify-center gap-3 text-center md:mb-10">
        <h2 className="text-[22px] font-bold leading-tight text-[#273166] md:text-[25.76px]">
          {t("oportunidades_destacadas_soluciones_activas")}
        </h2>
      </div>

      <div className="mx-auto flex max-w-6xl flex-col gap-4 lg:flex-row lg:items-stretch">
        <div
          className="relative min-w-0 flex-1"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="flex items-stretch justify-center gap-3 overflow-hidden px-8 py-3 md:gap-4 md:px-12">
          {featuredWindowItems.map(
            ({ entry: item, sourceIndex, position, centerOffset }) => {
              const isFocused =
                position ===
                (featuredPairMode ? centerOffset + featuredFocusOffset : centerOffset);
              const distanceFromCenter = Math.abs(position - centerOffset);
              const isSideCard =
                featuredWindowItems.length >= 4
                  ? position === 0 || position === featuredWindowItems.length - 1
                  : distanceFromCenter > 1;
              const sideClass =
                isSideCard
                  ? "hidden xl:block"
                  : featuredVisibleCount > 1
                    ? "hidden md:block"
                    : "";
              if ("id" in item && item.id === "__more__") {
                return (
                  <FixedMoreCard
                    key={`${item.id}-${sourceIndex}`}
                    href={buildSearchHref()}
                    title={t("ver_mas")}
                    matchPublicationCard={!showFixedMoreCardDesktop}
                    sideImage={isSideCard}
                    tabletLayout={cardsPerView === 2}
                    className={`${sideClass} ${carouselDepthClass(
                      isSideCard,
                      position,
                      centerOffset,
                      featuredPairMode ? centerOffset + featuredFocusOffset : centerOffset,
                    )} ${isFocused ? "max-w-[23rem] scale-100 opacity-100" : isSideCard ? "max-w-[11rem] scale-90 opacity-35 blur-[2px] grayscale hover:opacity-55 hover:blur-[1px]" : "max-w-[23rem] scale-100 opacity-95"}`}
                    onClick={(event) => {
                      if (!isFocused) {
                        event.preventDefault();
                        focusFeaturedSource(sourceIndex);
                      }
                    }}
                  />
                );
              }
              const pub = item as PublicationLite;
              const title = pickI18nText(
                pub.titleI18n ?? null,
                locale,
                pub.title,
              );
              const fields = (pub.fields ?? {}) as Record<string, unknown>;
              const categorySelections = Array.isArray(
                fields?.categorySelections,
              )
                ? (fields.categorySelections as unknown[])
                    .map((value) => String(value ?? "").trim())
                    .filter(Boolean)
                : [];
              const categoryLabel =
                categorySelections[0] ||
                (pub.category
                  ? pickI18nText(pub.categoryI18n ?? null, locale, pub.category)
                  : "");
              const subcategoryLabel = pub.subcategory
                ? pickI18nText(
                    pub.subcategoryI18n ?? null,
                    locale,
                    pub.subcategory,
                  )
                : "";
              const isPartner = Boolean(fields.partner);
              const destination = Array.isArray(fields?.destinationCountries)
                ? String(
                    (fields.destinationCountries as unknown[])[0] ?? "",
                  ).trim()
                : "";
              const flagCountryCode = getCountryCode(destination || pub.country, countryCodeCatalog);
              const languageCodes = resolveLanguageCodes(pub);
              const isPrestacion = pub.primaryGroupKey === "prestacion";
              const detailReturnTo = buildSearchHref(
                isPrestacion
                  ? {
                      primaryGroupKey: "prestacion",
                      prestacion: selectedPrestCategory || undefined,
                    }
                  : {},
              );
              const detailPath = isPrestacion
                ? `/prestaciones/${pub.id}?returnTo=${encodeURIComponent(detailReturnTo)}`
                : `/publicacion/${pub.id}?returnTo=${encodeURIComponent(detailReturnTo)}`;
              const cardDepthClass = carouselDepthClass(
                isSideCard,
                position,
                centerOffset,
                featuredPairMode ? centerOffset + featuredFocusOffset : centerOffset,
              );
              const featuredCardClass = `group w-full shrink-0 transform-gpu overflow-hidden rounded-3xl border bg-white text-left transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform hover:-translate-y-0.5 ${sideClass} ${cardDepthClass} ${
                isFocused
                  ? "max-w-[23rem] scale-100 border-[#0B8FA3]/70 opacity-100 shadow-[0_0_0_2px_rgba(11,143,163,0.30),0_24px_60px_rgba(11,143,163,0.24)]"
                  : isSideCard
                    ? "max-w-[11rem] scale-90 border-slate-200 bg-slate-50 opacity-35 blur-[2px] grayscale shadow-sm hover:opacity-55 hover:blur-[1px]"
                    : "max-w-[23rem] scale-100 border-[#0B8FA3]/25 opacity-95 shadow-[0_14px_36px_rgba(15,23,42,0.10)] hover:shadow-[0_18px_42px_rgba(11,143,163,0.16)]"
              }`;
              const featuredCardContent = (
                <>
                  <div
                    className={`relative w-full bg-slate-100 ${isSideCard ? "h-40" : "h-48"}`}
                  >
                    <Image
                      src={firstImage(pub)}
                      alt={title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 1280px) 50vw, 25vw"
                    />
                  </div>
                  <div className="space-y-2 p-4">
                    <div className="flex flex-wrap gap-1">
                      {item.featured ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#00A9C6] px-2 py-0.5 text-[11px] font-semibold text-white">
                          <Star className="h-3 w-3 fill-current" /> Destacado
                        </span>
                      ) : null}
                      {isPartner ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-cyan-100 px-2 py-0.5 text-[11px] font-semibold text-cyan-700">
                          <Handshake className="h-3 w-3" /> Partner
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-slate-500">
                      {pub.publisherName || t("oferente_nombre_placeholder")}
                    </p>
                    <h3 className="line-clamp-2 text-lg md:text-xl font-semibold leading-tight text-[#273166]">
                      {title}
                    </h3>
                    <p className="text-sm text-slate-600">
                      {categoryLabel || subcategoryLabel || "-"}
                    </p>
                    <p className="flex items-center gap-1 text-sm text-slate-600">
                      {flagCountryCode ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`https://flagcdn.com/20x15/${flagCountryCode.toLowerCase()}.png`}
                          alt={destination || pub.country || "flag"}
                          className="h-[12px] w-[16px] rounded-[2px] object-cover"
                        />
                      ) : (
                        <MapPin className="h-4 w-4 text-[#2563EB]" />
                      )}
                      {destination || pub.country || "-"}
                    </p>
                    {languageCodes.length ? (
                      <p className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
                        <span className="font-semibold text-[#273166]">{t("idiomas_atencion")}:</span>
                        {languageCodes.map((code) => (
                          <span key={code} className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">
                            {code}
                          </span>
                        ))}
                      </p>
                    ) : null}
                    <p className={`text-sm font-semibold ${isFocused ? "text-[#0B8FA3]" : "text-[#273166]"}`}>
                      {pub.price
                        ? `${pub.currency ? `${pub.currency} ` : ""}${pub.price}`
                        : t("precio_convenir")}
                    </p>
                    <div className="pt-1">
                      <span
                        className={`inline-flex w-full items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold ${isFocused ? "bg-[#EAF9FB] text-[#0B6B7A]" : "bg-slate-200 text-slate-600"}`}
                      >
                        {isPrestacion ? t("ver_prestacion") : t("ver_mas")}
                      </span>
                    </div>
                  </div>
                </>
              );
              return (
                <Link
                  key={`${pub.id}-${sourceIndex}`}
                  href={detailPath}
                  onClick={(event) => {
                    if (!isFocused) {
                      event.preventDefault();
                      focusFeaturedSource(sourceIndex);
                    }
                  }}
                  className={featuredCardClass}
                >
                  {featuredCardContent}
                </Link>
              );
            },
          )}
        </div>

        {showCarousel ? (
          <>
            <button
              type="button"
              aria-label="Anterior"
              onClick={() => moveFeaturedCarousel(-1)}
              className="absolute left-1 top-1/2 z-10 flex -translate-y-1/2 rounded-full bg-white p-2 shadow transition hover:scale-105 md:-left-4"
            >
              <ChevronLeft className="h-5 w-5 text-slate-600" />
            </button>
            <button
              type="button"
              aria-label="Siguiente"
              onClick={() => moveFeaturedCarousel(1)}
              className="absolute right-3 top-1/2 z-10 flex -translate-y-1/2 rounded-full bg-white p-2 shadow transition hover:scale-105 md:right-2"
            >
              <ChevronRight className="h-5 w-5 text-slate-600" />
            </button>
            <div className="mt-4 flex justify-center gap-2">
              {Array.from({ length: featuredCarouselItems.length }).map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  aria-label={`Ir a página ${idx + 1}`}
                  onClick={() => {
                    setCurrentSlide(idx);
                    setFeaturedFocusOffset(0);
                  }}
                  className={`h-2.5 w-2.5 rounded-full ${featuredFocusedIndex === idx ? "bg-[#0B8FA3]" : "bg-slate-300"}`}
                />
              ))}
            </div>
          </>
        ) : null}
        </div>

        <div className="hidden w-full max-w-[15rem] shrink-0 lg:flex lg:pt-2 lg:pb-0">
          <FixedMoreCard href={buildSearchHref()} title={t("ver_mas")} />
        </div>
      </div>

      {showPrestacionesSection ? (
        <>
        <div className="mx-auto mb-6 mt-10 w-full max-w-6xl">
          <PharseWithBackground onlyOne />
        </div>
        <section className="mt-8 rounded-[28px] border border-[#BFD6FF] bg-gradient-to-b from-[#EEF5FF] via-[#F5F9FF] to-[#F8FBFF] p-4 shadow-[0_14px_36px_rgba(37,99,235,0.12)] md:p-8">
          <div className="text-center">
            <h3 className="inline-flex items-center justify-center gap-3 text-[22px] font-bold text-[#273166] md:text-[25.76px]">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#DBEAFE] text-[#2563EB] shadow-[0_10px_24px_rgba(37,99,235,0.18)]">
                <Compass className="h-5 w-5" />
              </span>
              {t("suma_prestaciones_plan_viaje")}
            </h3>
            <p className="mt-2 text-[14px] font-medium text-slate-500 md:text-[16px]">
              {t("explorar_prestaciones_subtitulo")}
            </p>
            <p className="mt-2 text-[14px] text-slate-600 md:text-[16px]">
              {t("explorar_prestaciones_que_son")}
            </p>
          </div>
          <div className={`mt-4 flex items-center md:justify-center ${showPrestCategoryScrollButtons ? "gap-2" : "justify-center"}`}>
            {showPrestCategoryScrollButtons ? (
              <button
              type="button"
              aria-label="Categorías anteriores"
              onClick={() => scrollPrestCategoryTrack(-1)}
              className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 ${showPrestCategoryDesktopScrollButtons ? "md:inline-flex" : "md:hidden"}`}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            ) : null}
            <div
              id="prest-cats"
              ref={prestCategoryTrackRef}
              className={`tg-hide-scrollbar flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth pb-1 md:snap-none md:justify-center md:overflow-visible md:pb-0 ${showPrestCategoryScrollButtons ? "flex-1 justify-start" : "mx-auto justify-center"} ${showPrestCategoryDesktopScrollButtons ? "md:flex-1 md:justify-start md:overflow-x-auto" : "md:flex-none"}`}
            >
              {categoriesWithPublications.map((category) => {
                const active = selectedPrestCategory === category.description;
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() =>
                      setSelectedPrestCategory(category.description)
                    }
                    className={`inline-flex min-w-full snap-center items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition md:min-w-0 ${
                      active
                        ? "bg-[#2563EB] text-white shadow-[0_10px_22px_rgba(37,99,235,0.28)]"
                        : "border border-[#BFDBFE] bg-white text-[#1D4ED8]"
                    }`}
                  >
                    <Compass className="h-4 w-4" />
                    {category.description}
                  </button>
                );
              })}
            </div>
            {showPrestCategoryScrollButtons ? (
              <button
              type="button"
              aria-label="Más categorías"
              onClick={() => scrollPrestCategoryTrack(1)}
              className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 ${showPrestCategoryDesktopScrollButtons ? "md:inline-flex" : "md:hidden"}`}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            ) : null}
          </div>
          <div
            className="relative mt-5"
            onMouseEnter={() => setIsPrestacionesPaused(true)}
            onMouseLeave={() => setIsPrestacionesPaused(false)}
            onTouchStart={onPrestTouchStart}
            onTouchMove={onPrestTouchMove}
            onTouchEnd={onPrestTouchEnd}
          >
            <div className="relative flex items-stretch justify-center gap-3 overflow-hidden px-8 py-3 md:gap-4 md:px-12">
              {prestWindowItems.map(
                ({ entry: item, sourceIndex, position, centerOffset }) => {
                  const isFocused =
                    position ===
                    (prestPairMode
                      ? centerOffset + prestacionesFocusOffset
                      : centerOffset);
                  const distanceFromCenter = Math.abs(position - centerOffset);
                  const isSideCard =
                    prestWindowItems.length >= 4
                      ? position === 0 || position === prestWindowItems.length - 1
                      : distanceFromCenter > 1;
                  const sideClass =
                    isSideCard
                      ? "hidden xl:block"
                      : prestVisibleCount > 1
                        ? "hidden md:block"
                        : "";
                  const title = pickI18nText(
                    item.titleI18n ?? null,
                    locale,
                    item.title,
                  );
                  const desc = item.subcategory
                    ? pickI18nText(
                        item.subcategoryI18n ?? null,
                        locale,
                        item.subcategory,
                      )
                    : pickI18nText(
                        item.descriptionI18n ?? null,
                        locale,
                        item.category ?? "",
                      );
                  const prestFields = (item.fields ?? {}) as Record<string, unknown>;
                  const prestDestination = Array.isArray(prestFields.destinationCountries)
                    ? String((prestFields.destinationCountries as unknown[])[0] ?? "").trim()
                    : "";
                  const prestFlagCountryCode = getCountryCode(prestDestination || item.country, countryCodeCatalog);
                  const cardDepthClass = carouselDepthClass(
                    isSideCard,
                    position,
                    centerOffset,
                    prestPairMode
                      ? centerOffset + prestacionesFocusOffset
                      : centerOffset,
                  );
                  const prestacionCardClass = `group w-full shrink-0 transform-gpu overflow-hidden rounded-2xl border bg-white text-left transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform hover:-translate-y-0.5 ${sideClass} ${cardDepthClass} ${
                    isFocused
                      ? "max-w-[22rem] scale-100 border-[#2563EB]/75 opacity-100 shadow-[0_0_0_2px_rgba(37,99,235,0.22),0_20px_52px_rgba(37,99,235,0.18)]"
                      : isSideCard
                        ? "max-w-[10rem] scale-90 border-slate-200 bg-slate-50 opacity-35 blur-[2px] grayscale shadow-sm hover:opacity-55 hover:blur-[1px]"
                        : "max-w-[22rem] scale-100 border-[#93C5FD] opacity-95 shadow-[0_16px_34px_rgba(37,99,235,0.14)]"
                  }`;
                  const prestacionCardContent = (
                    <>
                      <div
                        className={`relative w-full bg-slate-100 ${isSideCard ? "h-28" : "h-36"}`}
                      >
                        <Image
                          src={firstPrestacionImage(item, locale)}
                          alt={title}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="space-y-2 p-4">
                        <h4 className="line-clamp-2 text-base font-bold text-[#273166]">
                          {title}
                        </h4>
                        <p className="line-clamp-1 text-sm text-slate-500">
                          {desc || t("prestacion_disponible")}
                        </p>
                        <p className="flex items-center gap-1 text-sm text-slate-600">
                          {prestFlagCountryCode ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={`https://flagcdn.com/20x15/${prestFlagCountryCode.toLowerCase()}.png`}
                              alt={prestDestination || item.country || "flag"}
                              className="h-[12px] w-[16px] rounded-[2px] object-cover"
                            />
                          ) : null}
                          {prestDestination || item.country || "-"}
                        </p>
                        <span
                          className={`inline-flex w-full items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold ${isFocused ? "bg-[#2563EB] text-white" : "bg-[#DBEAFE] text-[#1D4ED8]"}`}
                        >
                          {t("ver_mas")}
                        </span>
                      </div>
                    </>
                  );
                  return (
                    <Link
                      key={`prest-${item.id}-${sourceIndex}`}
                      href={`/prestaciones/${item.id}?returnTo=${encodeURIComponent(
                        buildSearchHref({
                          primaryGroupKey: "prestacion",
                          prestacion: selectedPrestCategory || undefined,
                        }),
                      )}`}
                      onClick={(event) => {
                        if (!isFocused) {
                          event.preventDefault();
                          focusPrestSource(sourceIndex);
                        }
                      }}
                      className={prestacionCardClass}
                    >
                      {prestacionCardContent}
                    </Link>
                  );
                },
              )}
            </div>
            {showPrestCarousel ? (
              <>
                <button
                  type="button"
                  aria-label="Prestación anterior"
                  onClick={() => movePrestacionesCarousel(-1)}
                  className="absolute left-1 top-1/2 z-10 flex -translate-y-1/2 rounded-full bg-white p-2 shadow transition hover:scale-105 md:left-4"
                >
                  <ChevronLeft className="h-5 w-5 text-slate-600" />
                </button>
                <button
                  type="button"
                  aria-label="Prestación siguiente"
                  onClick={() => movePrestacionesCarousel(1)}
                  className="absolute right-1 top-1/2 z-10 flex -translate-y-1/2 rounded-full bg-white p-2 shadow transition hover:scale-105 md:right-4"
                >
                  <ChevronRight className="h-5 w-5 text-slate-600" />
                </button>
                <div className="mt-4 flex justify-center gap-2">
                  {prestacionesToShow.map((_, idx) => (
                    <button
                      key={`prest-dot-${idx}`}
                      type="button"
                      aria-label={`Prestaciones página ${idx + 1}`}
                      onClick={() => {
                        setPrestacionesSlide(idx);
                        setPrestacionesFocusOffset(0);
                      }}
                      className={`h-2.5 w-2.5 rounded-full ${prestFocusedIndex === idx ? "bg-[#2563EB]" : "bg-slate-300"}`}
                    />
                  ))}
                </div>
              </>
            ) : null}
          </div>
          <div className="mt-4 flex justify-end">
            <Link
              href={buildSearchHref({
                primaryGroupKey: "prestacion",
                prestacion: selectedPrestCategory || undefined,
              })}
              className="text-sm font-semibold text-[#2563EB] hover:underline"
            >
              {t("ver_todas_las_prestaciones")} →
            </Link>
          </div>
        </section>
        </>
      ) : null}
    </section>
  );
}

function FixedMoreCard({
  href,
  title,
  compact = false,
  matchPublicationCard = false,
  sideImage = false,
  tabletLayout = false,
  className = "",
  onClick,
}: {
  href: string;
  title: string;
  compact?: boolean;
  matchPublicationCard?: boolean;
  sideImage?: boolean;
  tabletLayout?: boolean;
  className?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
}) {
  const { t } = useTranslation();

  if (matchPublicationCard) {
    return (
      <Link
        href={href}
        onClick={onClick}
        className={`group relative flex h-full min-h-[27.5rem] w-full shrink-0 overflow-hidden rounded-3xl border border-white/15 bg-[url('/fondo-frase-el-cliente.webp')] bg-cover bg-center shadow-[0_14px_36px_rgba(15,23,42,0.10)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(11,143,163,0.16)] md:min-h-[28.5rem] ${className}`}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-[#0A8FA5]/18 via-[#0B5D72]/48 to-[#0F172A]/70" />
        <div
          className={`relative z-10 flex w-full flex-col items-center justify-center text-center ${tabletLayout ? "gap-5 px-5 py-11" : sideImage ? "gap-3 p-5 py-7" : "gap-4 p-6 py-10"}`}
        >
          <Image
            src="/logo-navbar.png"
            alt="Travelgrin"
            width={132}
            height={36}
            className={`mx-auto block h-auto ${tabletLayout ? "w-[6.75rem]" : "w-[7.5rem]"}`}
          />
          <div className={`${tabletLayout ? "max-w-[8.75rem] space-y-1.5 text-[0]" : sideImage ? "max-w-[8rem]" : "max-w-[9rem]"} text-white/80`}>
            <p className={`${tabletLayout ? "text-[14px] leading-5" : sideImage ? "text-[13px] leading-5" : "text-sm leading-6"} font-semibold`}>
              {t("featured_more_copy_line_1")}
            </p>
            <p className={`${tabletLayout ? "text-[11px] leading-5" : sideImage ? "text-[13px] leading-5" : "text-sm leading-6"} font-medium`}>
              {t("featured_more_copy_line_2")}
            </p>
          </div>
          <span className={`${tabletLayout ? "mt-1" : ""} rounded-full bg-white px-6 py-3 text-[18px] font-extrabold leading-tight text-[#273166] shadow-[0_10px_24px_rgba(255,255,255,0.18)] transition group-hover:scale-105`}>
            {title}
          </span>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`group relative flex w-full overflow-hidden rounded-[28px] border border-white/15 bg-[url('/fondo-frase-el-cliente.webp')] bg-cover bg-center shadow-[0_16px_40px_rgba(15,23,42,0.14)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_48px_rgba(11,143,163,0.20)] ${compact ? "min-h-[8.5rem]" : "h-full min-h-0 items-stretch"} ${className}`}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-[#0A8FA5]/18 via-[#0B5D72]/48 to-[#0F172A]/70" />
      <div className={`relative z-10 flex w-full flex-col items-center justify-center gap-4 text-center ${compact ? "p-5 py-6" : "p-6 py-10"}`}>
        <Image
          src="/logo-navbar.png"
          alt="Travelgrin"
          width={132}
          height={36}
          className="h-auto w-[7.5rem]"
        />
                {!compact ? (
          <div className="max-w-[9rem] space-y-1 text-white/80">
            <p className="text-sm font-semibold leading-6">{t("featured_more_copy_line_1")}</p>
            <p className="text-sm font-medium leading-6">{t("featured_more_copy_line_2")}</p>
          </div>
        ) : null}
        <span className="rounded-full bg-white px-6 py-3 text-[18px] font-extrabold leading-tight text-[#273166] shadow-[0_10px_24px_rgba(255,255,255,0.18)] transition group-hover:scale-105">
          {title}
        </span>
      </div>
    </Link>
  );
}


