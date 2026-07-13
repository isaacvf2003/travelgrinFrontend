"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { pickI18nText, type I18nRecord } from "@/app/lib/i18nContent";
import {
  buildBuscarHrefWithDestination,
  DESTINATION_CHANGE_EVENT,
  readStoredDestination,
} from "@/app/lib/destinationStore";

type PublicationLite = {
  id: string;
  title?: string | null;
  titleI18n?: I18nRecord | null;
  description?: string | null;
  descriptionI18n?: I18nRecord | null;
  images?: unknown;
  category?: string | null;
  subcategory?: string | null;
  filterOptions?: Array<{ filterOption?: { label?: string | null } }>;
  fields?: Record<string, unknown> | null;
};

type PrestacionChip = {
  id: string;
  label: string;
  value: string;
};

type Props = {
  chips: PrestacionChip[];
  currentPublicationId: string;
};

export default function PrestacionesToAdd({ chips, currentPublicationId }: Props) {
  const { t, locale } = useTranslation();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [openValue, setOpenValue] = useState<string | null>(null);
  const [loadingValue, setLoadingValue] = useState<string | null>(null);
  const [itemsByValue, setItemsByValue] = useState<Record<string, PublicationLite[]>>({});
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const [mobilePage, setMobilePage] = useState(0);
  const [mobilePages, setMobilePages] = useState(1);
  const [storedDestination, setStoredDestination] = useState("");

  const [availableValues, setAvailableValues] = useState<Set<string>>(new Set());
  const copy = useMemo(() => ({
    noAvailable:
      locale === "en" ? "No services are available for this publication." :
      locale === "pt" ? "Nao ha prestacoes disponiveis para esta publicacao." :
      locale === "it" ? "Non ci sono prestazioni disponibili per questa pubblicazione." :
      "No hay prestaciones disponibles para esta publicacion.",
    servicesOf:
      locale === "en" ? "Services for" :
      locale === "pt" ? "Prestacoes de" :
      locale === "it" ? "Prestazioni di" :
      "Prestaciones de",
    loading:
      locale === "en" ? "Loading..." :
      locale === "pt" ? "Carregando..." :
      locale === "it" ? "Caricamento..." :
      "Cargando...",
    notFound:
      locale === "en" ? "We did not find services for this category." :
      locale === "pt" ? "Nao encontramos prestacoes para esta categoria." :
      locale === "it" ? "Non abbiamo trovato prestazioni per questa categoria." :
      "No encontramos prestaciones para esta categoria.",
    previous:
      locale === "en" ? "View previous services" :
      locale === "pt" ? "Ver prestacoes anteriores" :
      locale === "it" ? "Vedi prestazioni precedenti" :
      "Ver prestaciones anteriores",
    next:
      locale === "en" ? "View more services" :
      locale === "pt" ? "Ver mais prestacoes" :
      locale === "it" ? "Vedi altre prestazioni" :
      "Ver mas prestaciones",
    fallbackTitle:
      locale === "en" ? "Service" :
      locale === "pt" ? "Prestacao" :
      locale === "it" ? "Prestazione" :
      "Prestacion",
  }), [locale]);

  useEffect(() => {
    const syncStoredDestination = (event?: Event) => {
      const eventDestination =
        event instanceof CustomEvent ? String(event.detail ?? "").trim() : "";
      setStoredDestination(
        eventDestination ||
          readStoredDestination() ||
          String(searchParams.get("destinationCountry") ?? "").trim(),
      );
    };

    syncStoredDestination();
    window.addEventListener(DESTINATION_CHANGE_EVENT, syncStoredDestination);
    window.addEventListener("storage", syncStoredDestination);

    return () => {
      window.removeEventListener(DESTINATION_CHANGE_EVENT, syncStoredDestination);
      window.removeEventListener("storage", syncStoredDestination);
    };
  }, [searchParams]);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      const pairs = await Promise.all(chips.map(async (chip) => {
        try {
          const qs = new URLSearchParams({ prestacion: chip.value, perPage: "1", primaryGroupKey: "prestacion" });
          const res = await fetch(`/api/publications?${qs.toString()}`, { cache: "no-store" });
          if (!res.ok) return [chip.value, false] as const;
          const data = await res.json().catch(() => ({}));
          const list = Array.isArray(data?.items) ? data.items : [];
          const has = list.some((item: unknown) => String((item as { id?: unknown })?.id ?? "") !== currentPublicationId);
          return [chip.value, has] as const;
        } catch {
          return [chip.value, false] as const;
        }
      }));
      if (!mounted) return;
      setAvailableValues(new Set(pairs.filter(([, ok]) => ok).map(([value]) => value)));
    };
    check();
    return () => { mounted = false; };
  }, [chips, currentPublicationId]);

  const visibleChips = useMemo(() => chips.filter((chip) => availableValues.has(chip.value)), [chips, availableValues]);
  const returnTo = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;

  const openItems = useMemo(() => (openValue ? itemsByValue[openValue] ?? [] : []), [openValue, itemsByValue]);

  useEffect(() => {
    if (!openValue) return;

    const handleOutside = (event: MouseEvent | TouchEvent) => {
      if (!wrapRef.current) return;
      const target = event.target as Node | null;
      if (target && !wrapRef.current.contains(target)) setOpenValue(null);
    };

    const handleScroll = () => {
      if (!wrapRef.current) return;
      const rect = wrapRef.current.getBoundingClientRect();
      const notVisible = rect.bottom < 0 || rect.top > window.innerHeight;
      if (notVisible) setOpenValue(null);
    };

    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside);
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [openValue]);


  useEffect(() => {
    const el = carouselRef.current;
    if (!el || !openValue || !openItems.length) return;

    const recalculate = () => {
      const pages = Math.max(1, Math.ceil(el.scrollWidth / el.clientWidth));
      setMobilePages(pages);
      const page = Math.round(el.scrollLeft / el.clientWidth);
      setMobilePage(Math.max(0, Math.min(pages - 1, page)));
    };

    recalculate();
    el.addEventListener("scroll", recalculate, { passive: true });
    window.addEventListener("resize", recalculate);

    return () => {
      el.removeEventListener("scroll", recalculate);
      window.removeEventListener("resize", recalculate);
    };
  }, [openItems.length, openValue]);

  const scrollCarouselBy = (direction: "left" | "right") => {
    if (!carouselRef.current) return;
    const amount = Math.max(140, Math.floor(carouselRef.current.clientWidth * 0.65));
    carouselRef.current.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  const loadPrestaciones = async (value: string) => {
    if (itemsByValue[value]) return;
    setLoadingValue(value);

    try {
      const qs = new URLSearchParams({ prestacion: value, perPage: "8", primaryGroupKey: "prestacion" });
      const res = await fetch(`/api/publications?${qs.toString()}`, { cache: "no-store" });
      if (!res.ok) {
        setItemsByValue((prev) => ({ ...prev, [value]: [] }));
        return;
      }
      const data = await res.json().catch(() => ({}));
      const list = Array.isArray(data?.items) ? (data.items as PublicationLite[]) : [];
      const unique = new Map<string, PublicationLite>();

      list.forEach((item) => {
        const id = String(item?.id ?? "").trim();
        if (!id || id === currentPublicationId) return;
        if (!unique.has(id)) unique.set(id, item);
      });

      setItemsByValue((prev) => ({ ...prev, [value]: Array.from(unique.values()).slice(0, 12) }));
    } finally {
      setLoadingValue((prev) => (prev === value ? null : prev));
    }
  };

  return (
    <div ref={wrapRef} className="mt-6 w-full min-w-0 overflow-hidden rounded-3xl border border-gray-200 bg-white p-4 shadow-[0_12px_40px_rgba(15,23,42,0.06)] sm:p-6">
      <h2 className="text-lg font-semibold text-[#0B8FA3]">{t("prestaciones_sumar")}</h2>

      <div className="mt-3 flex flex-wrap gap-2">
        {visibleChips.map((chip) => {
          const isOpen = openValue === chip.value;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => {
                if (isOpen) return setOpenValue(null);
                setOpenValue(chip.value);
                void loadPrestaciones(chip.value);
              }}
              className="max-w-full whitespace-normal break-words rounded-full bg-teal-600 px-3 py-1 text-left text-xs font-medium text-white hover:bg-teal-700"
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {!visibleChips.length ? <div className="mt-3 text-sm text-slate-600">{copy.noAvailable}</div> : null}

      {openValue ? (
        <div className="mt-4 min-w-0 overflow-hidden rounded-2xl border border-teal-100 bg-teal-50/60 p-2 sm:p-3">
          <div className="mb-2 break-words text-sm font-semibold text-[#0B8FA3]">{copy.servicesOf} {openValue}</div>

          {loadingValue === openValue ? <div className="text-sm text-slate-600">{copy.loading}</div> : null}

          {loadingValue !== openValue && !openItems.length ? (
            <div className="text-sm text-slate-600">{copy.notFound}</div>
          ) : null}

          {loadingValue !== openValue && openItems.length ? (
            <div className="space-y-3">
              <div className="hidden items-center justify-between gap-2 md:flex">
                <button
                  type="button"
                  aria-label={copy.previous}
                  onClick={() => scrollCarouselBy("left")}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-teal-300 bg-white text-teal-700 hover:bg-teal-100"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  aria-label={copy.next}
                  onClick={() => scrollCarouselBy("right")}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-teal-300 bg-white text-teal-700 hover:bg-teal-100"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <div
                ref={carouselRef}
                className="no-scrollbar flex min-w-0 snap-x snap-mandatory gap-2 overflow-x-auto px-2 pb-1 [scroll-padding-inline:0.5rem] before:block before:w-0.5 before:shrink-0 before:content-[''] after:block after:w-0.5 after:shrink-0 after:content-[''] sm:px-3 sm:[scroll-padding-inline:0.75rem] md:px-0 md:before:hidden md:after:hidden"
              >
                {openItems.map((entry) => {
                  const fields = (entry.fields ?? {}) as Record<string, unknown>;
                  const image =
                    pickI18nText(
                      (fields.prestationHeroImageI18n as I18nRecord | null) ?? null,
                      locale,
                      String(fields.prestationHeroImage ?? "").trim()
                    ) ||
                    String((Array.isArray(entry.images) ? entry.images[0] : "") ?? "").trim() ||
                    "https://i.ibb.co/VmrmGrx/sin-foto.jpg";
                  const title =
                    pickI18nText(
                      (fields.prestationHeroTitleI18n as I18nRecord | null) ?? null,
                      locale,
                      String(fields.prestationHeroTitle ?? "").trim()
                    ) ||
                    pickI18nText(entry.titleI18n ?? null, locale, String(entry.title ?? "").trim()) ||
                    copy.fallbackTitle;
                  const rawDescription =
                    pickI18nText(
                      (fields.prestationHeroSubtitleI18n as I18nRecord | null) ?? null,
                      locale,
                      String(fields.prestationHeroSubtitle ?? "").trim()
                    ) ||
                    pickI18nText(entry.descriptionI18n ?? null, locale, String(entry.description ?? "").trim());
                  const description = rawDescription.replace(/<[^>]*>/g, "").trim();

                  const badges = Array.from(
                    new Set(
                      [
                        String(entry.category ?? "").trim(),
                        String(entry.subcategory ?? "").trim(),
                        ...(Array.isArray(entry.filterOptions)
                          ? entry.filterOptions
                              .map((f) => String(f?.filterOption?.label ?? "").trim())
                              .filter(Boolean)
                          : []),
                      ].filter(Boolean)
                    )
                  ).slice(0, 2);

                  return (
                    <Link
                      key={entry.id}
                      href={`/prestaciones/${entry.id}?returnTo=${encodeURIComponent(returnTo)}`}
                      className="w-[calc((100%-0.75rem)/1.35)] min-w-[118px] max-w-[150px] shrink-0 snap-start overflow-hidden rounded-xl border border-teal-200 bg-white shadow-sm hover:bg-slate-50 min-[390px]:w-[calc((100%-0.75rem)/1.6)] min-[430px]:w-[calc((100%-0.75rem)/1.9)] md:w-[34%] md:min-w-[132px] md:max-w-[190px]"
                    >
                      <div className="relative h-24 w-full bg-slate-100">
                        <Image src={image} alt={title} fill className="object-cover" sizes="(max-width: 640px) 70vw, (max-width: 1024px) 45vw, 260px" />
                      </div>

                      <div className="space-y-1 p-2">
                        <div className="line-clamp-1 break-words text-sm font-semibold text-slate-800">{title}</div>
                        {description ? <div className="line-clamp-2 break-words text-xs text-slate-600">{description}</div> : null}

                        {badges.length ? (
                          <div className="flex flex-wrap gap-1">
                            {badges.map((badge) => (
                              <span
                                key={`${entry.id}-${badge}`}
                                className="max-w-full truncate rounded-full border border-teal-200 bg-teal-50 px-1.5 py-0.5 text-[10px] text-teal-700"
                              >
                                {badge}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </Link>
                  );
                })}
              </div>

              <div className="mt-1 flex items-center justify-center gap-2 md:hidden">
                {Array.from({ length: mobilePages }).map((_, idx) => (
                  <span
                    key={`mobile-prestaciones-dot-${idx}`}
                    className={`h-2 w-2 rounded-full transition ${idx === mobilePage ? "bg-teal-600" : "bg-slate-300"}`}
                  />
                ))}
              </div>

              <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="break-words text-xs text-slate-500">{openItems.length} prestaciones encontradas</div>
                <Link
                  href={buildBuscarHrefWithDestination(
                    { primaryGroupKey: "prestacion", prestacion: openValue },
                    storedDestination,
                    String(searchParams.get("country") ?? "").trim(),
                  )}
                  className="inline-flex rounded-lg border border-teal-300 px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-100"
                >
                  Ver todas
                </Link>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
