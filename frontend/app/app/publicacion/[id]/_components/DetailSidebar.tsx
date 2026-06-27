"use client";

import { Heart, Share2 } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { pickI18nText, type I18nRecord } from "@/app/lib/i18nContent";
import PriceDisplay from "./PriceDisplay";
import { trackPublicationMetric } from "./PublicationMetricsTracker";

type DetailSidebarProps = {
  featured: boolean;
  price?: string | null;
  currency?: string | null;
  pricePeriod?: string | null;
  publisherName?: string | null;
  providerLogoUrl?: string | null;
  languages: string[];
  locationLine?: string | null;
  locationAddress?: string | null;
  category?: string | null;
  categoryI18n?: I18nRecord | null;
  subcategory?: string | null;
  subcategoryI18n?: I18nRecord | null;
  website?: string | null;
  socialLinks?: Record<string, string> | null;
  publicationId: string;
};

export default function DetailSidebar({
  featured,
  price,
  currency,
  pricePeriod,
  publisherName,
  providerLogoUrl,
  languages,
  locationLine,
  locationAddress,
  category,
  categoryI18n,
  subcategory,
  subcategoryI18n,
  website,
  socialLinks,
  publicationId,
}: DetailSidebarProps) {
  const { t, locale } = useTranslation();
  const labelCategory = category ? pickI18nText(categoryI18n ?? null, locale, category) : "";
  const labelSubcategory = subcategory ? pickI18nText(subcategoryI18n ?? null, locale, subcategory) : "";
  const socialEntries = Object.entries(socialLinks ?? {}).filter(([, value]) => Boolean(value));

  return (
    <aside className="space-y-4">
      <div className="rounded-3xl border border-gray-200 bg-white p-5">
        <div className="flex items-center gap-3">
          {providerLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={providerLogoUrl}
              alt={publisherName ?? t("nombre_oferente")}
              className="h-10 w-10 rounded-full border border-gray-200 object-cover"
            />
          ) : null}
          <div>
            <div className="text-sm text-gray-500">{t("nombre_oferente")}</div>
            <div className="text-sm font-semibold text-gray-900">{publisherName || "-"}</div>
          </div>
        </div>

        {languages.length ? (
          <div className="mt-3 text-sm text-gray-500">
            {t("se_comunica_en")}:{" "}
            <span className="font-semibold text-gray-700">{languages.join(", ")}</span>
          </div>
        ) : null}

        {(locationLine || locationAddress) ? (
          <div className="mt-2 text-sm text-gray-500">
            {locationLine ? locationLine : ""}
            {locationAddress ? ` · ${locationAddress}` : ""}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {labelCategory ? (
            <span className="rounded-full bg-[#E6F5F7] px-3 py-1 text-xs font-semibold text-[#0B8FA3]">
              {labelCategory}
            </span>
          ) : null}
          {labelSubcategory ? (
            <span className="rounded-full bg-[#EEF1FF] px-3 py-1 text-xs font-semibold text-[#3D4B7D]">
              {labelSubcategory}
            </span>
          ) : null}
        </div>

        <div className="mt-4 flex items-start justify-between gap-3">
          {featured ? (
            <span className="inline-flex items-center rounded-md bg-teal-600 px-3 py-1 text-xs font-semibold text-white">
              ★ {t("destacado_label")}
            </span>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2 text-gray-400">
            <button className="rounded-full p-2 hover:bg-gray-50" aria-label="Favorito" onClick={() => trackPublicationMetric(publicationId, "favorite")}>
              <Heart className="h-5 w-5" />
            </button>
            <button className="rounded-full p-2 hover:bg-gray-50" aria-label="Compartir" onClick={async () => {
              trackPublicationMetric(publicationId, "share");
              const shareUrl = typeof window !== "undefined" ? window.location.href : "";
              try {
                if (navigator?.share) await navigator.share({ title: publisherName || t("nombre_oferente"), url: shareUrl });
                else if (shareUrl && navigator?.clipboard) await navigator.clipboard.writeText(shareUrl);
                else if (shareUrl) window.prompt("Copiá el link:", shareUrl);
              } catch {
                // no-op
              }
            }}>
              <Share2 className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="mt-4 text-sm text-gray-500">{t("precio_label")}</div>
        <div className="mt-1 text-2xl font-semibold text-gray-900">
          <PriceDisplay price={price} currency={currency} period={pricePeriod} />
        </div>

        <button className="mt-5 w-full rounded-xl border border-teal-600 bg-white px-4 py-3 text-center text-lg font-semibold text-teal-700 hover:bg-teal-50">
          {t("conectar")}
        </button>
      </div>

      {(website || socialEntries.length || languages.length) ? (
        <div className="rounded-3xl border border-gray-200 bg-white p-5">
          <div className="text-sm font-semibold text-gray-900">{t("datos_contacto")}</div>
          <div className="mt-3 space-y-2 text-sm text-gray-700">
            {website ? (
              <div>
                <span className="text-gray-500">{t("datos_contacto_web")}:</span>{" "}
                <a className="underline" href={website} target="_blank" rel="noreferrer" onClick={() => trackPublicationMetric(publicationId, "lead")}>
                  {website}
                </a>
              </div>
            ) : null}

            {languages.length ? (
              <div>
                <span className="text-gray-500">{t("datos_contacto_idiomas")}:</span>{" "}
                {languages.join(", ")}
              </div>
            ) : null}

            {socialEntries.map(([key, value]) => (
              <div key={key}>
                <span className="text-gray-500">{key}:</span>{" "}
                <a className="underline" href={value} target="_blank" rel="noreferrer" onClick={() => trackPublicationMetric(publicationId, "lead")}>
                  {value}
                </a>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </aside>
  );
}
