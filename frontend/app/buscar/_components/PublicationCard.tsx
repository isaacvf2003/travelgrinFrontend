"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { publicationPath } from "@/app/lib/publicationSlug";
import { Compass, Share2 } from "lucide-react";
import SharePublicationDialog from "@/components/SharePublicationDialog";

import type { Publication } from "@/app/lib/types";
import { usePlan } from "./PlanStore";
import { useTranslation } from "@/app/hooks/useTranslation";
import { pickI18nText, type I18nRecord } from "@/app/lib/i18nContent";
import { getDisplayPrice, type PriceOverride } from "@/app/lib/currency";

function pickImage(p: Publication) {
  const imgs = (p.images as any) ?? [];
  if (Array.isArray(imgs) && imgs.length > 0) return String(imgs[0]);
  return "https://i.ibb.co/VmrmGrx/sin-foto.jpg";
}



function normalizeTagKey(value: string) {
  return finalizeVisibleCountryText(String(value ?? ""))
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[,\-/_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveLinkedPrestaciones(item: Publication, locale: "es" | "en" | "pt" | "it") {
  if (item.primaryGroupKey === "prestacion") return [];
  const fields = ((item as any)?.fields ?? {}) as Record<string, unknown>;
  const fromFields = Array.isArray(fields.prestaciones)
    ? fields.prestaciones.map((value) => String(value ?? "").trim()).filter(Boolean)
    : [];
  const fromFilters = (item.filterOptions ?? [])
    .filter((entry) => {
      const taxonomyType = normalizeTaxonomyType((entry as any)?.filterOption?.group?.taxonomyType);
      return taxonomyType === "prestacion" || taxonomyType === "prestaciones";
    })
    .map((entry) => pickI18nText((entry as any)?.filterOption?.labelI18n ?? null, locale, String((entry as any)?.filterOption?.label ?? "").trim()))
    .filter(Boolean);

  const seen = new Set<string>();
  return [...fromFields, ...fromFilters].filter((value) => {
    const key = normalizeTagKey(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeTaxonomyType(value: unknown) {
  const fallback = String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
  return finalizeVisibleCountryText(fallback);
}

function resolveLanguages(item: Publication) {
  const fromField = Array.isArray(item.languages)
    ? item.languages
    : item.languages
    ? [item.languages]
    : [];

  const fromIdiomaTaxonomyType = (item.filterOptions ?? [])
    .filter((entry) => {
      const taxonomyType = normalizeTaxonomyType((entry as any)?.filterOption?.group?.taxonomyType);
      return taxonomyType === "idioma" || taxonomyType === "idiomas";
    })
    .map((entry) => String((entry as any)?.filterOption?.label ?? "").trim())
    .filter(Boolean);

  const preferred = fromIdiomaTaxonomyType.length ? fromIdiomaTaxonomyType : fromField;

  return Array.from(new Set(preferred.map((lang) => String(lang).trim()).filter(Boolean)));
}

function stripHtml(value: string) {
  if (typeof window !== "undefined") {
    const tmp = document.createElement("div");
    tmp.innerHTML = value;
    return tmp.textContent || tmp.innerText || "";
  }
  return value.replace(/<[^>]*>/g, "");
}

function pickPrestacionResourceData(p: Publication, locale: "es" | "en" | "pt" | "it") {
  if (p.primaryGroupKey !== "prestacion") return null;
  const fields = (p.fields ?? {}) as Record<string, unknown>;
  const heroImage = pickI18nText((fields.prestationHeroImageI18n as I18nRecord | null) ?? null, locale, String(fields.prestationHeroImage ?? "").trim());
  const heroTitle = pickI18nText((fields.prestationHeroTitleI18n as I18nRecord | null) ?? null, locale, String(fields.prestationHeroTitle ?? "").trim());
  const rawHeroSubtitle = pickI18nText((fields.prestationHeroSubtitleI18n as I18nRecord | null) ?? null, locale, String(fields.prestationHeroSubtitle ?? "").trim());
  const heroSubtitle = stripHtml(rawHeroSubtitle);
  const resources = Array.isArray(fields.prestationResources) ? fields.prestationResources : [];
  const first = resources.find((entry) => {
    const r = (entry ?? {}) as Record<string, unknown>;
    return String(r.title ?? "").trim() || String(r.image ?? "").trim();
  }) as Record<string, unknown> | undefined;
  if (!first) return null;

  return {
    image: heroImage || String(first.image ?? "").trim(),
    title: heroTitle || pickI18nText((first.titleI18n as I18nRecord | null) ?? null, locale, String(first.title ?? "").trim()),
    subtitle: heroSubtitle,
  };
}

const COUNTRY_FLAG_MAP: Record<string, string> = {
  ar: "🇦🇷",
  argentina: "🇦🇷",
  cl: "🇨🇱",
  chile: "🇨🇱",
  uy: "🇺🇾",
  uruguay: "🇺🇾",
  py: "🇵🇾",
  paraguay: "🇵🇾",
  br: "🇧🇷",
  brasil: "🇧🇷",
  brazil: "🇧🇷",
  pe: "🇵🇪",
  peru: "🇵🇪",
  perú: "🇵🇪",
  bo: "🇧🇴",
  bolivia: "🇧🇴",
  co: "🇨🇴",
  colombia: "🇨🇴",
  mx: "🇲🇽",
  mexico: "🇲🇽",
  méxico: "🇲🇽",
  es: "🇪🇸",
  espana: "🇪🇸",
  españa: "🇪🇸",
  it: "🇮🇹",
  italia: "🇮🇹",
  fr: "🇫🇷",
  france: "🇫🇷",
  francia: "🇫🇷",
  de: "🇩🇪",
  germany: "🇩🇪",
  alemania: "🇩🇪",
  us: "🇺🇸",
  usa: "🇺🇸",
  "estados unidos": "🇺🇸",
  ca: "🇨🇦",
  canada: "🇨🇦",
  canadà: "🇨🇦",
  canadá: "🇨🇦",
};

const COUNTRY_LABEL_MAP: Record<string, string> = {
  ar: "Argentina",
  cl: "Chile",
  uy: "Uruguay",
  py: "Paraguay",
  br: "Brasil",
  pe: "Perú",
  bo: "Bolivia",
  co: "Colombia",
  mx: "México",
  es: "España",
  it: "Italia",
  fr: "Francia",
  de: "Alemania",
  us: "Estados Unidos",
  ca: "Canadá",
};
const COUNTRY_CODE_MAP: Record<string, string> = {
  ar: "AR",
  argentina: "AR",
  cl: "CL",
  chile: "CL",
  uy: "UY",
  uruguay: "UY",
  py: "PY",
  paraguay: "PY",
  br: "BR",
  brasil: "BR",
  brazil: "BR",
  pe: "PE",
  peru: "PE",
  bo: "BO",
  bolivia: "BO",
  co: "CO",
  colombia: "CO",
  mx: "MX",
  mexico: "MX",
  es: "ES",
  espana: "ES",
  it: "IT",
  italia: "IT",
  fr: "FR",
  francia: "FR",
  de: "DE",
  alemania: "DE",
  us: "US",
  usa: "US",
  canada: "CA",
  ca: "CA",
};

function normalizeCountryKey(country: string) {
  return String(country ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function finalizeVisibleCountryText(value: string) {
  return String(value ?? "")
    .replace(/PerÃº/g, "Perú")
    .replace(/MÃ©xico/g, "México")
    .replace(/EspaÃ±a/g, "España")
    .replace(/CanadÃ¡/g, "Canadá")
    .replace(/canadÃ /gi, "canadá")
    .replace(/Ã¡/g, "á")
    .replace(/Ã©/g, "é")
    .replace(/Ã­/g, "í")
    .replace(/Ã³/g, "ó")
    .replace(/Ãº/g, "ú")
    .replace(/Ã±/g, "ñ")
    .replace(/ðŸ‡¦ðŸ‡·/g, "🇦🇷")
    .replace(/ðŸ‡¨ðŸ‡±/g, "🇨🇱")
    .replace(/ðŸ‡ºðŸ‡¾/g, "🇺🇾")
    .replace(/ðŸ‡µðŸ‡¾/g, "🇵🇾")
    .replace(/ðŸ‡§ðŸ‡·/g, "🇧🇷")
    .replace(/ðŸ‡µðŸ‡ª/g, "🇵🇪")
    .replace(/ðŸ‡§ðŸ‡´/g, "🇧🇴")
    .replace(/ðŸ‡¨ðŸ‡´/g, "🇨🇴")
    .replace(/ðŸ‡²ðŸ‡½/g, "🇲🇽")
    .replace(/ðŸ‡ªðŸ‡¸/g, "🇪🇸")
    .replace(/ðŸ‡®ðŸ‡¹/g, "🇮🇹")
    .replace(/ðŸ‡«ðŸ‡·/g, "🇫🇷")
    .replace(/ðŸ‡©ðŸ‡ª/g, "🇩🇪")
    .replace(/ðŸ‡ºðŸ‡¸/g, "🇺🇸")
    .replace(/ðŸ‡¨ðŸ‡¦/g, "🇨🇦")
    .replace(/ðŸŒŽ/g, "🌎")
    .replace(/ðŸ“/g, "📍");
}

function normalizeVisibleCountryText(value: string) {
  const normalized = String(value ?? "")
    .replace(/PerÃ/g, "Perú")
    .replace(/MÃ/g, "México")
    .replace(/EspaÃ/g, "España")
    .replace(/CanadÃ/g, "Canadá")
    .replace(/Ã¡/g, "á")
    .replace(/Ã©/g, "é")
    .replace(/Ã­/g, "í")
    .replace(/Ã³/g, "ó")
    .replace(/Ãº/g, "ú")
    .replace(/Ã±/g, "ñ")
    .replace(/ðŸ‡¦ðŸ‡·/g, "🇦🇷")
    .replace(/ðŸ‡¨ðŸ‡±/g, "🇨🇱")
    .replace(/ðŸ‡ºðŸ‡¾/g, "🇺🇾")
    .replace(/ðŸ‡µðŸ‡¾/g, "🇵🇾")
    .replace(/ðŸ‡§ðŸ‡·/g, "🇧🇷")
    .replace(/ðŸ‡µðŸ‡ª/g, "🇵🇪")
    .replace(/ðŸ‡§ðŸ‡´/g, "🇧🇴")
    .replace(/ðŸ‡¨ðŸ‡´/g, "🇨🇴")
    .replace(/ðŸ‡²ðŸ‡½/g, "🇲🇽")
    .replace(/ðŸ‡ªðŸ‡¸/g, "🇪🇸")
    .replace(/ðŸ‡®ðŸ‡¹/g, "🇮🇹")
    .replace(/ðŸ‡«ðŸ‡·/g, "🇫🇷")
    .replace(/ðŸ‡©ðŸ‡ª/g, "🇩🇪")
    .replace(/ðŸ‡ºðŸ‡¸/g, "🇺🇸")
    .replace(/ðŸ‡¨ðŸ‡¦/g, "🇨🇦")
    .replace(/ðŸŒŽ/g, "🌎")
    .replace(/ðŸ“/g, "📍");
  if (normalized !== String(value ?? "")) return finalizeVisibleCountryText(normalized);
  return String(value ?? "")
    .replace(/PerÃº/g, "Perú")
    .replace(/MÃ©xico/g, "México")
    .replace(/EspaÃ±a/g, "España")
    .replace(/CanadÃ¡/g, "Canadá")
    .replace(/canadÃ /gi, "canadá")
    .replace(/ðŸ‡¦ðŸ‡·/g, "🇦🇷")
    .replace(/ðŸ‡¨ðŸ‡±/g, "🇨🇱")
    .replace(/ðŸ‡ºðŸ‡¾/g, "🇺🇾")
    .replace(/ðŸ‡µðŸ‡¾/g, "🇵🇾")
    .replace(/ðŸ‡§ðŸ‡·/g, "🇧🇷")
    .replace(/ðŸ‡µðŸ‡ª/g, "🇵🇪")
    .replace(/ðŸ‡§ðŸ‡´/g, "🇧🇴")
    .replace(/ðŸ‡¨ðŸ‡´/g, "🇨🇴")
    .replace(/ðŸ‡²ðŸ‡½/g, "🇲🇽")
    .replace(/ðŸ‡ªðŸ‡¸/g, "🇪🇸")
    .replace(/ðŸ‡®ðŸ‡¹/g, "🇮🇹")
    .replace(/ðŸ‡«ðŸ‡·/g, "🇫🇷")
    .replace(/ðŸ‡©ðŸ‡ª/g, "🇩🇪")
    .replace(/ðŸ‡ºðŸ‡¸/g, "🇺🇸")
    .replace(/ðŸ‡¨ðŸ‡¦/g, "🇨🇦")
    .replace(/ðŸŒŽ/g, "🌎")
    .replace(/ðŸ“/g, "📍");
}

function booleanLike(value: unknown) {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "si", "sí", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off", ""].includes(normalized)) return false;
  }
  return Boolean(value);
}

function flagFromAlpha2Code(alpha2Code: string) {
  const code = alpha2Code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return "";
  return String.fromCodePoint(...[...code].map((char) => 127397 + char.charCodeAt(0)));
}

function getCountryFlag(country: string) {
  const raw = String(country ?? "").trim();
  const normalized = normalizeCountryKey(raw);
  const tokenized = raw.split(/\s+/).map((token) => normalizeCountryKey(token));
  const candidates = [normalized, ...tokenized].filter(Boolean);

  for (const key of candidates) {
    const fromCode = flagFromAlpha2Code(key);
    if (fromCode) return fromCode;
    if (COUNTRY_FLAG_MAP[key]) return normalizeVisibleCountryText(COUNTRY_FLAG_MAP[key]);
  }
  return "🏳️";
}

function getCountryCode(country: string) {
  const raw = String(country ?? "").trim();
  const normalized = normalizeCountryKey(raw);
  const tokenized = raw.split(/\s+/).map((token) => normalizeCountryKey(token));
  const candidates = [normalized, ...tokenized].filter(Boolean);
  for (const key of candidates) {
    if (/^[a-z]{2}$/i.test(key)) return key.toUpperCase();
    if (COUNTRY_CODE_MAP[key]) return COUNTRY_CODE_MAP[key];
  }
  return "";
}

export function PublicationCard({ item }: { item: Publication }) {
  const { toggle, has } = usePlan();
  const isSaved = has(item.id);
  const { locale, t } = useTranslation();
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const targetCurrency = searchParams.get("priceCurrency");

  const onShare = async () => {
    try {
      await fetch("/api/publications/metrics", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ publicationId: item.id, metricType: "share" }),
        keepalive: true,
      }).catch(() => null);

      setShareMenuOpen(true);
    } catch {
      // silencioso
    }
  };

  const prestationResource = useMemo(() => pickPrestacionResourceData(item, locale), [item, locale]);
  const img = useMemo(() => prestationResource?.image || pickImage(item), [item, prestationResource]);
  const displayTitle = useMemo(() => prestationResource?.title || pickI18nText(item.titleI18n ?? null, locale, item.title), [item.titleI18n, item.title, locale, prestationResource]);
  const prestationSubtitle = useMemo(() => prestationResource?.subtitle?.trim() || "", [prestationResource]);

  const languages = useMemo(() => resolveLanguages(item), [item]);
  const publisherLabel = useMemo(() => {
    if (item.publisherName) return item.publisherName;
    if (item.primaryGroupKey === "prestacion") return t("taxonomyType_prestacion");
    return t("oferente_nombre_placeholder") || "Nombre completo del oferente";
  }, [item.publisherName, item.primaryGroupKey, t]);
  const isPrestacion = item.primaryGroupKey === "prestacion";
  const isPartner = Boolean((item as any)?.partner ?? (item as any)?.fields?.partner);
  const destinationCity = String(item.city ?? "").trim();
  const prestacionDestinations = Array.isArray((item as any)?.fields?.travelDestinations) ? (item as any).fields.travelDestinations : [];
  const prestacionDestinationCountry = String(prestacionDestinations[0]?.country ?? "").trim();
  const destinationCountryRaw = (isPrestacion ? prestacionDestinationCountry : "") || item.country?.trim() || item.headquarterCountry?.trim() || "";
  const destinationCountryKey = normalizeCountryKey(destinationCountryRaw);
  const destinationCountry =
    normalizeVisibleCountryText(COUNTRY_LABEL_MAP[destinationCountryKey] || "") ||
    normalizeVisibleCountryText(destinationCountryRaw.replace(/^[A-Za-z]{2}\s+/, "").trim()) ||
    normalizeVisibleCountryText(destinationCountryRaw);
  const destinationFlag = destinationCountry ? getCountryFlag(destinationCountryRaw) : "📍";
  const destinationCode = getCountryCode(destinationCountryRaw);
  const destinationLabel = isPrestacion ? destinationCountry : [destinationCountry, destinationCity].filter(Boolean).join(", ");
  const destinationPrefix = t("taxonomyType_destino") || "Destino";
  const destinationFallbackByLocale: Record<"es" | "en" | "pt" | "it", string> = {
    es: "A confirmar",
    en: "To be confirmed",
    pt: "A confirmar",
    it: "Da confermare",
  };
  const destinationFallback = destinationFallbackByLocale[locale] ?? "A confirmar";
  const cardHighlights = useMemo<string[]>(() => {
    const blocks = Array.isArray((item as any)?.fields?.extraDescriptions) ? (item as any).fields.extraDescriptions : [];
    return blocks
      .filter((block: any) => booleanLike(block?.visibleInCard))
      .map((block: any) => {
        const title = pickI18nText(block?.titleI18n ?? null, locale, String(block?.title ?? "").trim());
        return normalizeTagKey(title) === "lo que incluye" ? t("observaciones_label") : title;
      })
      .filter(Boolean)
      .slice(0, 2);
  }, [item, locale, t]);

  const tags = useMemo(() => {
    const fieldCategoryTags = Array.isArray((item as any)?.fields?.categorySelections)
      ? (item as any).fields.categorySelections.map((value: any) => String(value ?? "").trim()).filter(Boolean)
      : [];
    const fieldSubcategoryTags = Array.isArray((item as any)?.fields?.subcategorySelections)
      ? (item as any).fields.subcategorySelections.map((value: any) => String(value ?? "").trim()).filter(Boolean)
      : [];
    const prestacionFilterTags = (item.filterOptions ?? [])
      .filter((entry) => {
        const taxonomyType = normalizeTaxonomyType((entry as any)?.filterOption?.group?.taxonomyType);
        return taxonomyType === "prestacion" || taxonomyType === "prestaciones";
      })
      .map((entry) => pickI18nText((entry as any)?.filterOption?.labelI18n ?? null, locale, String((entry as any)?.filterOption?.label ?? "").trim()))
      .filter(Boolean);

    const raw = (item.primaryGroupKey === "prestacion"
      ? [
          ...(Array.isArray((item as any)?.fields?.prestaciones)
            ? (item as any).fields.prestaciones.map((value: any) => String(value ?? "").trim()).filter(Boolean)
            : []),
          ...fieldSubcategoryTags,
          ...fieldCategoryTags,
          ...prestacionFilterTags,
        ]
      : [
          item.category
            ? pickI18nText(item.categoryI18n ?? null, locale, item.category)
            : null,
          ...fieldCategoryTags,
          item.subcategory
            ? pickI18nText(item.subcategoryI18n ?? null, locale, item.subcategory)
            : null,
          ...fieldSubcategoryTags,
          ...(item.filterOptions ?? []).map((f) =>
            pickI18nText(f.filterOption.labelI18n ?? null, locale, f.filterOption.label)
          ),
        ]).filter(Boolean) as string[];

    const seen = new Set<string>();
    const out: string[] = [];

    for (const tag of raw) {
      const key = tag.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(tag);
    }
    return out.slice(0, 4);
  }, [item.category, item.subcategory, item.filterOptions, item.fields, locale]);

  const friendlyPrice = useMemo(() => {
    if (!item.price) return t("precio_convenir");
    const overrides = (item as any).fields?.priceByCurrency as PriceOverride[] | undefined;
    const display = getDisplayPrice(item.price, item.currency ?? null, targetCurrency, "es-AR", overrides ?? []);
    if (!display) return t("precio_convenir");
    return display.formatted;
  }, [item.price, item.currency, item.fields, targetCurrency, t]);

  const detailUrl = useMemo(() => {
    const basePath = item.primaryGroupKey === "prestacion" ? "prestaciones" : "publicacion"
    const qs = new URLSearchParams();
    if (targetCurrency) qs.set("priceCurrency", targetCurrency);
    const currentQuery = searchParams.toString();
    const returnTo = `${pathname}${currentQuery ? `?${currentQuery}` : ""}`;
    if (returnTo) qs.set("returnTo", returnTo);
    if (!qs.toString()) return `/${basePath}/${item.id}`;
    return `/${basePath}/${item.id}?${qs.toString()}`;
  }, [item.id, item.primaryGroupKey, pathname, searchParams, targetCurrency]);

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}${detailUrl}`;
  }, [detailUrl]);

  return (
    <>
    <Link
      href={detailUrl}
      className={`group relative block overflow-hidden rounded-[14px] border bg-white shadow-[0_14px_38px_rgba(15,23,42,0.12)] transition hover:shadow-[0_18px_46px_rgba(15,23,42,0.16)] md:shadow-[0_8px_30px_rgba(0,0,0,0.06)] md:hover:shadow-[0_14px_40px_rgba(0,0,0,0.08)] ${
        isPrestacion
          ? "border-[#2C7BE5]/25 bg-gradient-to-r from-[#EEF5FF] via-white to-white ring-1 ring-[#2C7BE5]/20"
          : "border-black/10"
      }`}
      aria-label={`Abrir detalle de ${displayTitle}`}
    >
      {isPrestacion ? (
        <div className="absolute inset-y-0 left-0 z-10 w-1.5 bg-gradient-to-b from-[#2C7BE5] to-[#1A4B8C]" />
      ) : null}
      <div className="flex flex-col md:flex-row md:items-stretch">
        <div className="relative h-[220px] w-full bg-gray-100 md:h-auto md:w-[280px] md:min-h-[220px]">
          <Image
            src={img}
            alt={item.title}
            fill
            className="object-cover object-center"
            sizes="(max-width: 768px) 100vw, 400px"
          />

          <div className="absolute left-3 top-3 flex flex-wrap items-center gap-2">
            {item.featured ? (
              <span className="rounded-md bg-[#0B8FA3] px-2 py-1 text-xs font-semibold text-white shadow">
                ⭐ {t("destacado_label")}
              </span>
            ) : null}
            {isPartner ? (
              <span className="rounded-md bg-[#0B8FA3] px-2 py-1 text-xs font-semibold text-white shadow">
                🤝 Partner
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex-1 p-4 md:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              {isPrestacion ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-[#2C7BE5]/20 bg-[#EEF5FF] px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[#1A4B8C] shadow-sm">
                  <Compass className="h-3.5 w-3.5 text-[#2563EB]" />
                  {publisherLabel || t("taxonomyType_prestacion")}
                </span>
              ) : (
                <p className="text-sm text-black/60">
                  {publisherLabel || "Oferente"}
                </p>
              )}

              <h3 className={`mt-1 line-clamp-2 font-semibold ${isPrestacion ? "text-[19px] text-[#273166]" : "text-[18px] text-black"}`}>
                {displayTitle}
              </h3>

              {isPrestacion && prestationSubtitle ? (
                <p className="mt-1 line-clamp-2 text-sm text-[#355D8C]">
                  {prestationSubtitle}
                </p>
              ) : null}

              <div className={`mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${isPrestacion ? "bg-[#E3F0FF] text-[#1A4B8C]" : "bg-black/5 text-[#0B2B30]"}`}>
                {destinationCode ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`https://flagcdn.com/20x15/${destinationCode.toLowerCase()}.png`}
                    alt={destinationCode}
                    className="h-[12px] w-[16px] rounded-[2px] object-cover"
                  />
                ) : (
                  <span>{destinationFlag}</span>
                )}
                <span>{isPrestacion ? (destinationLabel || destinationFallback) : `${destinationPrefix}: ${(destinationLabel || destinationFallback)}`}</span>
              </div>

              {languages.length ? (
                <div className="mt-2 flex flex-wrap gap-1 text-[10px] text-black/50">
              <span>{t("oferente_comunica")}</span>
                  {languages.map((lang) => (
                    <span
                      key={String(lang)}
                      className="rounded-full border border-black/10 px-2 py-0.5"
                    >
                      {String(lang)}
                    </span>
                  ))}
                </div>
              ) : null}

              {cardHighlights.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {cardHighlights.map((highlight: string) => (
                    <span key={highlight} className={`rounded-full border px-2 py-0.5 text-xs ${isPrestacion ? "border-[#2C7BE5]/25 text-[#1A4B8C]" : "border-black/10 text-black/70"}`}>
                      {highlight}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="mt-1 flex items-center gap-2">
              {/* ✅ Compartir con ícono (NO debe navegar) */}
              <button
                type="button"
                aria-label="Compartir"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onShare();
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white transition hover:bg-black/5"
              >
                <Share2 className="h-4 w-4 text-black/50" />
              </button>

              {/* ✅ Favorito / Mi plan (NO debe navegar) */}
              <button
                type="button"
                aria-label={isSaved ? "Quitar de Mi plan" : "Sumar a Mi plan"}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggle({
                    publicationId: item.id,
                    title: displayTitle,
                    imageUrl: img,
                    price: item.price,
                    currency: item.currency,
                    pricePeriod: (item as any).fields?.pricePeriod ?? null,
                  });
                }}
                className={
                  "inline-flex h-9 w-9 items-center justify-center rounded-full border transition " +
                  (isSaved ? "border-[#0B8FA3] bg-[#0B8FA3]/10" : "border-black/10 bg-white")
                }
              >
                <span className={isSaved ? "text-[#0B8FA3]" : "text-black/50"}>♥</span>
              </button>
            </div>
          </div>

          <div className={`mt-3 flex flex-wrap gap-2 ${isPrestacion ? "text-[12px]" : "text-[11px]"}`}>
            {item.country || item.city ? (
              <span className="rounded-full bg-black/5 px-2 py-1">
                {item.city ? `${item.city}, ` : ""}
                {item.country ?? ""}
              </span>
            ) : null}

            {tags.map((tag) => (
              <span key={tag} className="rounded-full bg-black/5 px-2 py-1">
                {tag}
              </span>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-black/50">{item.price ? "" : ""}</p>
              <p className="text-[15px] font-semibold text-[#0B8FA3]">{friendlyPrice}</p>
            </div>

            {/* Botón visual (no necesario para navegar, pero lo dejamos) */}
            <span className={`inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold text-white shadow hover:opacity-95 ${isPrestacion ? "bg-[#2C7BE5]" : "bg-[#0B8FA3]"}`}>
              {item.primaryGroupKey === "prestacion" ? t("ver_prestacion") : t("ver_detalle")}
            </span>
          </div>
        </div>
      </div>
    </Link>
    <SharePublicationDialog
      open={shareMenuOpen}
      onClose={() => setShareMenuOpen(false)}
      shareTitle={displayTitle}
      shareUrl={shareUrl}
    />
    </>
  );
}

