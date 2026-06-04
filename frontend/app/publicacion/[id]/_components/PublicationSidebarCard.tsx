"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { pickI18nText, type I18nRecord } from "@/app/lib/i18nContent";
import { getDisplayPrice, type PriceOverride } from "@/app/lib/currency";
import { usePlan } from "@/app/buscar/_components/PlanStore";
import { trackPublicationMetric } from "./PublicationMetricsTracker";
import SharePublicationDialog from "@/components/SharePublicationDialog";

type PublicationSidebarCardProps = {
  className?: string;
  publicationId?: string;
  title?: string | null;
  titleI18n?: I18nRecord | null;
  layout?: "stack" | "split";
  featured?: boolean;
  partner?: boolean;
  publisherName?: string | null;
  providerLogo?: string | null;
  languages?: string[];
  locationCity?: string | null;
  locationCountry?: string | null;
  mapUrl?: string | null;
  primaryGroupTags?: string[];
  category?: string | null;
  categoryI18n?: I18nRecord | null;
  categoryLabels?: string[];
  subcategory?: string | null;
  subcategoryI18n?: I18nRecord | null;
  subcategoryLabels?: string[];
  price?: string | null;
  currency?: string | null;
  pricePeriod?: string | null;
  displayCurrency?: string | null;
  priceOverrides?: PriceOverride[];
  imageUrl?: string | null;
};

export default function PublicationSidebarCard({
  className = "",
  publicationId,
  title,
  titleI18n,
  layout = "stack",
  featured,
  partner,
  publisherName,
  providerLogo,
  languages = [],
  locationCity,
  locationCountry,
  mapUrl,
  primaryGroupTags = [],
  category,
  categoryI18n,
  categoryLabels = [],
  subcategory,
  subcategoryI18n,
  subcategoryLabels = [],
  price,
  currency,
  pricePeriod,
  displayCurrency,
  priceOverrides = [],
  imageUrl,
}: PublicationSidebarCardProps) {
  const { t, locale } = useTranslation();
  const { toggle, has } = usePlan();
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const isSaved = publicationId ? has(publicationId) : false;
  const titleLabel = title ? pickI18nText(titleI18n ?? null, locale, title) : "";
  const rawCategoryLabels = categoryLabels.length
    ? categoryLabels
    : category
      ? [pickI18nText(categoryI18n ?? null, locale, category)]
      : [];
  const rawSubcategoryLabels = subcategoryLabels.length
    ? subcategoryLabels
    : subcategory
      ? [pickI18nText(subcategoryI18n ?? null, locale, subcategory)]
      : [];
  const normalizeTag = (value: string) =>
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .trim();
  const secondaryTags = (() => {
    const seen = new Set<string>();
    const tags: string[] = [];
    rawCategoryLabels.forEach((tag) => {
      const normalized = normalizeTag(tag);
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      tags.push(tag);
    });
    [...rawSubcategoryLabels, ...primaryGroupTags].forEach((tag) => {
      const normalized = normalizeTag(tag);
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      tags.push(tag);
    });
    return tags;
  })();
  const formattedPrice = (() => {
    if (!price) return t("precio_convenir");
    const display = getDisplayPrice(price, currency, displayCurrency, "es-AR", priceOverrides);
    if (!display) return t("precio_convenir");
    const formatted = display.formatted;
    const periodLabel =
      pricePeriod === "day"
        ? t("precio_periodo_dia")
        : pricePeriod === "week"
          ? t("precio_periodo_semana")
          : pricePeriod === "year"
            ? t("precio_periodo_ano")
            : pricePeriod === "once"
              ? ""
              : t("precio_periodo_mes");
    return `${formatted}${periodLabel ? ` ${periodLabel}` : ""}`;
  })();
  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const shareTitle = titleLabel || "Travelgrin";

  const isSplit = layout === "split";

  return (
    <div
      className={`rounded-3xl border border-gray-200 bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.06)] ${className}`}
    >
      <div className={isSplit ? "md:grid md:grid-cols-[1.2fr_1fr] md:gap-4" : ""}>
        <div>
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {featured ? (
                <span className="inline-flex items-center rounded-md bg-teal-600 px-3 py-1 text-xs font-semibold text-white">
                  ★ {t("destacado_label")}
                </span>
              ) : null}
              {partner ? (
                <span className="inline-flex items-center rounded-md bg-teal-600 px-3 py-1 text-xs font-semibold text-white">
                  🤝 Partner
                </span>
              ) : null}
            </div>

            <div className="flex items-center gap-2 text-gray-400">
              <button
                type="button"
                className={`rounded-full p-2 transition hover:bg-gray-50 ${
                  isSaved ? "text-[#0B8FA3]" : "text-gray-400"
                }`}
                aria-label={isSaved ? "Quitar de Mi plan" : "Sumar a Mi plan"}
                aria-pressed={isSaved}
                onClick={() => {
                  if (!publicationId) return;
                  trackPublicationMetric(publicationId, "favorite");
                  toggle({
                    publicationId,
                    title: titleLabel,
                    imageUrl,
                    price,
                    currency,
                    pricePeriod,
                  });
                }}
              >
                ❤
              </button>
              <button
                type="button"
                className="rounded-full p-2 hover:bg-gray-50"
                aria-label="Compartir"
                onClick={() => {
                  if (!publicationId) return;
                  trackPublicationMetric(publicationId, "share");
                  setShareMenuOpen(true);
                }}
              >
                <Share2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
            {providerLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={providerLogo} alt={publisherName ?? "Logo"} className="h-8 w-8 rounded-full object-cover" />
            ) : null}
            <span className="font-semibold text-gray-900">
              {publisherName ? publisherName : t("oferente_nombre_placeholder")}
            </span>
          </div>

          {titleLabel ? (
            <div className="mt-3 text-xl font-semibold text-[#0B8FA3] md:text-2xl">{titleLabel}</div>
          ) : null}

          {languages.length ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
              <span>Idiomas de atención</span>
              <div className="flex flex-wrap gap-2">
                {languages.map((lang) => (
                  <span
                    key={lang}
                    className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700"
                  >
                    {lang}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {locationCity || locationCountry ? (
            <div className="mt-3 inline-flex items-center gap-2 text-xs text-gray-600">
              <span className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-teal-700">
                {locationCity ? `${locationCity}, ${t("te_espera")}` : locationCountry}
              </span>
              {mapUrl ? (
                <a className="text-teal-700 underline" href={mapUrl} target="_blank" rel="noreferrer">
                  {t("ver_mapa")}
                </a>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className={isSplit ? "md:border-l md:border-gray-200 md:pl-4" : ""}>
          <div className="mt-4 md:mt-3">
            <div className="flex flex-wrap gap-2">
              {secondaryTags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex rounded-full bg-[#E8F1FF] px-3 py-1 text-xs text-[#2B4A8C]"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-4 text-sm text-gray-500">{t("precio_label")}</div>
          <div className="mt-1 text-2xl font-semibold text-[#0B8FA3]">{formattedPrice}</div>
        </div>
      </div>
      <SharePublicationDialog
        open={shareMenuOpen}
        onClose={() => setShareMenuOpen(false)}
        shareTitle={shareTitle}
        shareUrl={shareUrl}
      />
    </div>
  );
}

