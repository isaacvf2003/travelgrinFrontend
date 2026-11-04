"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { writeStoredDestination } from "@/app/lib/destinationStore";

type PublicationItem = {
  country?: string | null;
  headquarterCountry?: string | null;
  fields?: Record<string, unknown> | null;
};

type CountryEntry = {
  country: string;
  count: number;
  code: string;
};

const COUNTRY_CODE_MAP: Record<string, string> = {
  argentina: "AR",
  brasil: "BR",
  brazil: "BR",
  chile: "CL",
  uruguay: "UY",
  paraguay: "PY",
  bolivia: "BO",
  peru: "PE",
  colombia: "CO",
  mexico: "MX",
  espana: "ES",
  spain: "ES",
  italia: "IT",
  italy: "IT",
  portugal: "PT",
  francia: "FR",
  france: "FR",
  alemania: "DE",
  germany: "DE",
  canada: "CA",
  "estados unidos": "US",
  "united states": "US",
  usa: "US",
  "reino unido": "GB",
  "united kingdom": "GB",
  uk: "GB",
  australia: "AU",
  "nueva zelanda": "NZ",
  "new zealand": "NZ",
  ecuador: "EC",
  venezuela: "VE",
  "costa rica": "CR",
  panama: "PA",
  guatemala: "GT",
  cuba: "CU",
  "republica dominicana": "DO",
  "dominican republic": "DO",
  japon: "JP",
  japan: "JP",
  china: "CN",
  suiza: "CH",
  switzerland: "CH",
  "paises bajos": "NL",
  netherlands: "NL",
  holanda: "NL",
  belgica: "BE",
  belgium: "BE",
  irlanda: "IE",
  ireland: "IE",
  austria: "AT",
  suecia: "SE",
  sweden: "SE",
  noruega: "NO",
  norway: "NO",
  dinamarca: "DK",
  denmark: "DK",
  finlandia: "FI",
  finland: "FI",
  polonia: "PL",
  poland: "PL",
  grecia: "GR",
  greece: "GR",
  turquia: "TR",
  turkey: "TR",
  sudafrica: "ZA",
  "south africa": "ZA",
  egipto: "EG",
  egypt: "EG",
  marruecos: "MA",
  morocco: "MA",
  india: "IN",
  singapur: "SG",
  singapore: "SG",
  tailandia: "TH",
  thailand: "TH",
};

function normalizeCountry(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function getCountryCode(country: string) {
  const norm = normalizeCountry(country);
  if (COUNTRY_CODE_MAP[norm]) return COUNTRY_CODE_MAP[norm];
  if (/^[a-z]{2}$/i.test(norm)) return norm.toUpperCase();
  return "";
}

function CountryFlag({ code, country }: { code: string; country: string }) {
  const normalized = String(code ?? "").trim().toLowerCase();
  if (!normalized) {
    return (
      <span className="flex h-6 w-8 items-center justify-center rounded-[4px] bg-white/20 text-xs shadow-sm">
        🌍
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/w40/${normalized}.png`}
      alt={`Bandera de ${country}`}
      className="h-6 w-8 rounded-[4px] object-cover shadow-sm"
      loading="lazy"
    />
  );
}

/**
 * Builds slides of N items each (e.g. 2 for tablet, 3 for desktop).
 * If fewer than N items remain for the last slide, it joins with the previous items
 * so that exactly N cards are ALWAYS displayed simultaneously without empty blanks.
 */
function buildSlides(items: CountryEntry[], perPage: number): CountryEntry[][] {
  if (items.length <= perPage) return [items];
  const slides: CountryEntry[][] = [];
  for (let i = 0; i < items.length; i += perPage) {
    if (i + perPage <= items.length) {
      slides.push(items.slice(i, i + perPage));
    } else {
      slides.push(items.slice(-perPage));
    }
  }
  return slides;
}

function DestinationCard({
  entry,
  t,
}: {
  entry: CountryEntry;
  t: (key: string) => string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 sm:gap-3 rounded-full border border-white/20 bg-white/12 px-3.5 sm:px-4 py-2 sm:py-2.5 backdrop-blur-md shadow-sm transition hover:bg-white/20">
      <span
        aria-hidden="true"
        className="inline-flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full bg-white/18 shadow-xs overflow-hidden"
      >
        <CountryFlag code={entry.code} country={entry.country} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] sm:text-[14px] font-bold leading-tight text-white">
          {entry.country}
        </div>
        <div className="mt-0.5 truncate text-[10px] sm:text-[11px] text-white/85 font-medium">
          {entry.count} {entry.count === 1 ? t("oportunidad_singular") : t("oportunidad_plural")}
        </div>
      </div>

      <Link
        href={`/buscar?destinationCountry=${encodeURIComponent(entry.country)}`}
        onClick={() => writeStoredDestination(entry.country)}
        className="inline-flex shrink-0 items-center justify-center rounded-full bg-white px-2.5 sm:px-3 py-1 text-[9px] sm:text-[10px] font-bold text-[#0b8fa3] transition hover:bg-white/95 hover:shadow-xs active:scale-95 cursor-pointer"
      >
        {t("ver_mas")}
      </Link>
    </div>
  );
}

export default function ActiveDestinationCountriesStrip() {
  const { t } = useTranslation();
  const [countries, setCountries] = useState<CountryEntry[]>([]);

  // Viewport detection: mobile (<768px), tablet (768px-1023px), desktop (>=1024px)
  const [viewport, setViewport] = useState<"mobile" | "tablet" | "desktop">("desktop");

  // Carousel indices & auto-play state
  const [mobileIndex, setMobileIndex] = useState(0);
  const [slideIndex, setSlideIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Touch swipe support for mobile
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      if (w < 768) {
        setViewport("mobile");
      } else if (w < 1024) {
        setViewport("tablet");
      } else {
        setViewport("desktop");
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const firstRes = await fetch("/api/publications?status=active&page=1&perPage=120");
        if (!firstRes.ok) return;

        const firstData = await firstRes.json();
        let items: PublicationItem[] = Array.isArray(firstData?.items) ? [...firstData.items] : [];

        // If backend paginated the publications, fetch all remaining pages in parallel
        if (firstData?.totalPages && firstData.totalPages > 1) {
          const extraPromises: Promise<any>[] = [];
          for (let p = 2; p <= firstData.totalPages; p++) {
            extraPromises.push(
              fetch(`/api/publications?status=active&page=${p}&perPage=${firstData.perPage || 50}`)
                .then((r) => (r.ok ? r.json() : null))
                .catch(() => null)
            );
          }
          const extraResults = await Promise.all(extraPromises);
          for (const resData of extraResults) {
            if (Array.isArray(resData?.items)) {
              items = items.concat(resData.items);
            }
          }
        }

        const counts = new Map<string, CountryEntry>();

        for (const item of items) {
          const fields = item.fields && typeof item.fields === "object" ? item.fields : {};
          const candidates = new Set<string>();

          const directCountry = String(item.country ?? "").trim();
          if (directCountry) candidates.add(directCountry);

          const hqCountry = String(item.headquarterCountry ?? "").trim();
          if (hqCountry) candidates.add(hqCountry);

          const destinationCountries = Array.isArray((fields as Record<string, unknown>).destinationCountries)
            ? ((fields as Record<string, unknown>).destinationCountries as unknown[])
            : [];
          for (const entry of destinationCountries) {
            const country = String(entry ?? "").trim();
            if (country) candidates.add(country);
          }

          const receivingCountries = Array.isArray((fields as Record<string, unknown>).receivingCountries)
            ? ((fields as Record<string, unknown>).receivingCountries as unknown[])
            : [];
          for (const entry of receivingCountries) {
            const country = String(entry ?? "").trim();
            if (country) candidates.add(country);
          }

          const travelDestinations = Array.isArray((fields as Record<string, unknown>).travelDestinations)
            ? ((fields as Record<string, unknown>).travelDestinations as unknown[])
            : [];
          for (const entry of travelDestinations) {
            const country = String((entry as any)?.country ?? entry ?? "").trim();
            if (country) candidates.add(country);
          }

          for (const country of candidates) {
            const key = normalizeCountry(country);
            if (!key) continue;
            const code = getCountryCode(country);

            const current = counts.get(key);
            if (current) current.count += 1;
            else counts.set(key, { country, count: 1, code });
          }
        }

        const next = Array.from(counts.values())
          .sort((a, b) => b.count - a.count || a.country.localeCompare(b.country, "es"));

        if (!cancelled) setCountries(next);
      } catch {
        if (!cancelled) setCountries([]);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleCountries = useMemo(
    () => countries.filter((entry) => entry.country),
    [countries]
  );

  // 2 items per slide on tablet, 3 items per slide on desktop
  const perPage = viewport === "tablet" ? 2 : 3;
  const currentSlides = useMemo(
    () => buildSlides(visibleCountries, perPage),
    [visibleCountries, perPage]
  );

  // Keep indices safe if count changes
  useEffect(() => {
    if (visibleCountries.length > 0 && mobileIndex >= visibleCountries.length) {
      setMobileIndex(0);
    }
  }, [visibleCountries.length, mobileIndex]);

  useEffect(() => {
    if (currentSlides.length > 0 && slideIndex >= currentSlides.length) {
      setSlideIndex(0);
    }
  }, [currentSlides.length, slideIndex]);

  // Automatic stepping interval (stays static for ~4.5 seconds between transitions)
  useEffect(() => {
    if (isPaused) return;
    if (visibleCountries.length <= 1 && currentSlides.length <= 1) return;

    const timer = setInterval(() => {
      setMobileIndex((prev) => (prev + 1) % visibleCountries.length);
      setSlideIndex((prev) => (prev + 1) % currentSlides.length);
    }, 4500);

    return () => clearInterval(timer);
  }, [isPaused, visibleCountries.length, currentSlides.length]);

  if (!visibleCountries.length) return null;

  const currentCards = currentSlides[slideIndex] || visibleCountries.slice(0, perPage);
  const currentMobileCard = visibleCountries[mobileIndex] || visibleCountries[0];

  const handlePrevSlide = () => {
    setIsPaused(true);
    setSlideIndex((prev) => (prev === 0 ? currentSlides.length - 1 : prev - 1));
  };

  const handleNextSlide = () => {
    setIsPaused(true);
    setSlideIndex((prev) => (prev + 1) % currentSlides.length);
  };

  const handlePrevMobile = () => {
    setIsPaused(true);
    setMobileIndex((prev) => (prev === 0 ? visibleCountries.length - 1 : prev - 1));
  };

  const handleNextMobile = () => {
    setIsPaused(true);
    setMobileIndex((prev) => (prev + 1) % visibleCountries.length);
  };

  // Touch handlers for mobile swipe
  const minSwipeDistance = 40;
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      handleNextMobile();
    } else if (isRightSwipe) {
      handlePrevMobile();
    }
  };

  return (
    <section className="px-4 pt-2 md:px-0 md:pt-3">
      <div
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        className="group relative mx-auto w-full max-w-[1152px] rounded-[22px] bg-gradient-to-r from-[#1bc8c0] via-[#149fba] to-[#116d8a] px-4 py-3.5 text-white shadow-[0_10px_18px_rgba(17,109,138,0.10)] sm:px-6 md:px-7 md:py-4 transition-all"
      >
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/78">
            {t("destinos_activos")}
          </p>
          <h2 className="mt-1 text-[22px] font-bold text-white md:text-[25.76px]">
            {t("paises_que_te_esperan")}
          </h2>
          <p className="mx-auto mt-1.5 max-w-3xl text-[14px] font-medium text-white/92 md:text-[16px]">
            {t("explora_paises_oportunidades_activas")}
          </p>
        </div>

        {/* ============================================================== */}
        {/* DESKTOP & TABLET VIEW (Visible on md and larger screens)        */}
        {/* Shows 2 countries on tablet, 3 on desktop.                     */}
        {/* Arrows are invisible by default and appear on hover.           */}
        {/* ============================================================== */}
        <div className="mt-5 hidden md:block">
          <div className="relative flex items-center justify-center gap-2 sm:gap-3">
            {/* Left arrow (hidden by default, appears when hovering over container) */}
            {currentSlides.length > 1 && (
              <button
                type="button"
                onClick={handlePrevSlide}
                aria-label="Ver países anteriores"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/20 text-white backdrop-blur-sm transition-all duration-300 hover:bg-white/35 hover:scale-105 active:scale-95 cursor-pointer shadow-xs opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}

            {/* Grid: 2 columns on tablet, 3 columns on desktop */}
            <div
              className={`grid ${
                viewport === "tablet" ? "grid-cols-2 max-w-2xl" : "grid-cols-3 max-w-4xl"
              } gap-3 w-full transition-all duration-500 ease-in-out`}
            >
              {currentCards.map((entry) => (
                <DestinationCard
                  key={`${entry.country}-${entry.code}`}
                  entry={entry}
                  t={t}
                />
              ))}
            </div>

            {/* Right arrow (hidden by default, appears when hovering over container) */}
            {currentSlides.length > 1 && (
              <button
                type="button"
                onClick={handleNextSlide}
                aria-label="Ver siguientes países"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/20 text-white backdrop-blur-sm transition-all duration-300 hover:bg-white/35 hover:scale-105 active:scale-95 cursor-pointer shadow-xs opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Desktop/Tablet Indicator Dots */}
          {currentSlides.length > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              {currentSlides.map((_, idx) => (
                <button
                  key={`slide-dot-${idx}`}
                  type="button"
                  onClick={() => {
                    setIsPaused(true);
                    setSlideIndex(idx);
                  }}
                  aria-label={`Ir al grupo ${idx + 1}`}
                  className={`h-2 transition-all duration-300 rounded-full cursor-pointer ${
                    slideIndex === idx
                      ? "w-6 bg-white shadow-xs"
                      : "w-2 bg-white/40 hover:bg-white/70"
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* ============================================================== */}
        {/* MOBILE VIEW (Visible on mobile screens < md)                   */}
        {/* Shows 1 country at a time, NO arrows, finger swipe enabled.    */}
        {/* Indicator dots at the bottom.                                  */}
        {/* ============================================================== */}
        <div className="mt-4 block md:hidden select-none">
          <div
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            className="w-full max-w-[290px] mx-auto transition-all duration-300 touch-pan-y"
          >
            <DestinationCard
              key={`${currentMobileCard.country}-${currentMobileCard.code}`}
              entry={currentMobileCard}
              t={t}
            />
          </div>

          {/* Mobile Indicator Dots */}
          {visibleCountries.length > 1 && (
            <div className="mt-3.5 flex items-center justify-center gap-1.5 flex-wrap">
              {visibleCountries.map((_, idx) => (
                <button
                  key={`mobile-dot-${idx}`}
                  type="button"
                  onClick={() => {
                    setIsPaused(true);
                    setMobileIndex(idx);
                  }}
                  aria-label={`Ir al país ${idx + 1}`}
                  className={`h-2 transition-all duration-300 rounded-full cursor-pointer ${
                    mobileIndex === idx
                      ? "w-5 bg-white shadow-xs"
                      : "w-2 bg-white/40 hover:bg-white/70"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
