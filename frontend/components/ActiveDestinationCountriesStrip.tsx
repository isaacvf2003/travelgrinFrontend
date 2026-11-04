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
 * Builds desktop slides of 3 countries each.
 * If fewer than 3 items remain for the last slide, it joins with the previous items
 * so that exactly 3 cards are ALWAYS displayed simultaneously without blanks.
 */
function buildDesktopSlides(items: CountryEntry[]): CountryEntry[][] {
  if (items.length <= 3) return [items];
  const slides: CountryEntry[][] = [];
  for (let i = 0; i < items.length; i += 3) {
    if (i + 3 <= items.length) {
      slides.push(items.slice(i, i + 3));
    } else {
      slides.push(items.slice(-3));
    }
  }
  return slides;
}

export default function ActiveDestinationCountriesStrip() {
  const { t } = useTranslation();
  const [countries, setCountries] = useState<CountryEntry[]>([]);

  // Carousel states
  const [mobileIndex, setMobileIndex] = useState(0);
  const [desktopSlideIndex, setDesktopSlideIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

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

  const desktopSlides = useMemo(
    () => buildDesktopSlides(visibleCountries),
    [visibleCountries]
  );

  // Keep indices safe if count changes
  useEffect(() => {
    if (visibleCountries.length > 0 && mobileIndex >= visibleCountries.length) {
      setMobileIndex(0);
    }
  }, [visibleCountries.length, mobileIndex]);

  useEffect(() => {
    if (desktopSlides.length > 0 && desktopSlideIndex >= desktopSlides.length) {
      setDesktopSlideIndex(0);
    }
  }, [desktopSlides.length, desktopSlideIndex]);

  // Automatic stepping interval (stays static for ~4.5 seconds between transitions)
  useEffect(() => {
    if (isPaused) return;
    if (visibleCountries.length <= 1 && desktopSlides.length <= 1) return;

    const timer = setInterval(() => {
      setMobileIndex((prev) => (prev + 1) % visibleCountries.length);
      setDesktopSlideIndex((prev) => (prev + 1) % desktopSlides.length);
    }, 4500);

    return () => clearInterval(timer);
  }, [isPaused, visibleCountries.length, desktopSlides.length]);

  if (!visibleCountries.length) return null;

  const currentDesktopCards = desktopSlides[desktopSlideIndex] || visibleCountries.slice(0, 3);
  const currentMobileCard = visibleCountries[mobileIndex] || visibleCountries[0];

  const handlePrevDesktop = () => {
    setIsPaused(true);
    setDesktopSlideIndex((prev) => (prev === 0 ? desktopSlides.length - 1 : prev - 1));
  };

  const handleNextDesktop = () => {
    setIsPaused(true);
    setDesktopSlideIndex((prev) => (prev + 1) % desktopSlides.length);
  };

  const handlePrevMobile = () => {
    setIsPaused(true);
    setMobileIndex((prev) => (prev === 0 ? visibleCountries.length - 1 : prev - 1));
  };

  const handleNextMobile = () => {
    setIsPaused(true);
    setMobileIndex((prev) => (prev + 1) % visibleCountries.length);
  };

  return (
    <section className="px-4 pt-2 md:px-0 md:pt-3">
      <div
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        className="mx-auto w-full max-w-[1152px] rounded-[22px] bg-gradient-to-r from-[#1bc8c0] via-[#149fba] to-[#116d8a] px-4 py-3.5 text-white shadow-[0_10px_18px_rgba(17,109,138,0.10)] sm:px-6 md:px-7 md:py-4 transition-all"
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
        {/* DESKTOP VIEW (Visible on md and larger screens)                */}
        {/* Shows 3 countries at a time with navigation arrows & dots      */}
        {/* ============================================================== */}
        <div className="mt-5 hidden md:block">
          <div className="flex items-center justify-center gap-3">
            {desktopSlides.length > 1 && (
              <button
                type="button"
                onClick={handlePrevDesktop}
                aria-label="Ver países anteriores"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/15 text-white backdrop-blur-sm transition hover:bg-white/30 hover:scale-105 active:scale-95 cursor-pointer shadow-xs"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}

            <div className="grid grid-cols-3 gap-3 w-full max-w-4xl transition-all duration-500 ease-in-out">
              {currentDesktopCards.map((entry) => (
                <div
                  key={`${entry.country}-${entry.code}`}
                  className="flex min-w-0 items-center gap-3 rounded-full border border-white/20 bg-white/12 px-4 py-2.5 backdrop-blur-md shadow-sm transition hover:bg-white/20"
                >
                  <span
                    aria-hidden="true"
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/18 shadow-xs overflow-hidden"
                  >
                    <CountryFlag code={entry.code} country={entry.country} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-bold leading-tight text-white">
                      {entry.country}
                    </div>
                    <div className="mt-0.5 text-[11px] text-white/85 font-medium">
                      {entry.count} {entry.count === 1 ? t("oportunidad_singular") : t("oportunidad_plural")}
                    </div>
                  </div>

                  <Link
                    href={`/buscar?destinationCountry=${encodeURIComponent(entry.country)}`}
                    onClick={() => writeStoredDestination(entry.country)}
                    className="inline-flex shrink-0 items-center justify-center rounded-full bg-white px-3 py-1 text-[10px] font-bold text-[#0b8fa3] transition hover:bg-white/95 hover:shadow-xs active:scale-95 cursor-pointer"
                  >
                    {t("ver_mas")}
                  </Link>
                </div>
              ))}
            </div>

            {desktopSlides.length > 1 && (
              <button
                type="button"
                onClick={handleNextDesktop}
                aria-label="Ver siguientes países"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/15 text-white backdrop-blur-sm transition hover:bg-white/30 hover:scale-105 active:scale-95 cursor-pointer shadow-xs"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Desktop Indicator Dots */}
          {desktopSlides.length > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              {desktopSlides.map((_, idx) => (
                <button
                  key={`desktop-dot-${idx}`}
                  type="button"
                  onClick={() => {
                    setIsPaused(true);
                    setDesktopSlideIndex(idx);
                  }}
                  aria-label={`Ir al grupo ${idx + 1}`}
                  className={`h-2 transition-all duration-300 rounded-full cursor-pointer ${
                    desktopSlideIndex === idx
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
        {/* Shows 1 country at a time in a carousel with arrows & dots     */}
        {/* ============================================================== */}
        <div className="mt-4 block md:hidden">
          <div className="flex items-center justify-between gap-2">
            {visibleCountries.length > 1 && (
              <button
                type="button"
                onClick={handlePrevMobile}
                aria-label="País anterior"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/15 text-white backdrop-blur-sm transition active:scale-90 cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}

            <div className="min-w-0 flex-1 max-w-[280px] mx-auto transition-all duration-300">
              <div className="flex items-center gap-3 rounded-full border border-white/20 bg-white/15 px-4 py-2.5 backdrop-blur-md shadow-sm">
                <span
                  aria-hidden="true"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20 shadow-xs overflow-hidden"
                >
                  <CountryFlag code={currentMobileCard.code} country={currentMobileCard.country} />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-bold leading-tight text-white">
                    {currentMobileCard.country}
                  </div>
                  <div className="mt-0.5 text-[11px] text-white/85 font-medium">
                    {currentMobileCard.count} {currentMobileCard.count === 1 ? t("oportunidad_singular") : t("oportunidad_plural")}
                  </div>
                </div>

                <Link
                  href={`/buscar?destinationCountry=${encodeURIComponent(currentMobileCard.country)}`}
                  onClick={() => writeStoredDestination(currentMobileCard.country)}
                  className="inline-flex shrink-0 items-center justify-center rounded-full bg-white px-3 py-1 text-[10px] font-bold text-[#0b8fa3] transition active:scale-95 cursor-pointer"
                >
                  {t("ver_mas")}
                </Link>
              </div>
            </div>

            {visibleCountries.length > 1 && (
              <button
                type="button"
                onClick={handleNextMobile}
                aria-label="Siguiente país"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/15 text-white backdrop-blur-sm transition active:scale-90 cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
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
