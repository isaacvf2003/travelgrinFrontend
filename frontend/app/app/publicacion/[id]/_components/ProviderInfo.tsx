"use client";

import { useTranslation } from "@/app/hooks/useTranslation";
import { pickI18nText, type I18nRecord } from "@/app/lib/i18nContent";
import RichText from "@/components/RichText";

type ProviderInfoProps = {
  value?: I18nRecord | null;
  rating?: number | null;
  reviewCount?: number | null;
  commentsUrl?: string | null;
  startYear?: string | null;
  activity?: string | null;
  providerType?: string | null;
  activityList?: string[];
  providerTypeList?: string[];
  origin?: string | null;
  logo?: string | null;
  headquartersInfo?: string | null;
  headquarterLocations?: Array<{ country: string; city: string; mapUrl: string }>;
};

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
  bo: "🇧🇴",
  bolivia: "🇧🇴",
  co: "🇨🇴",
  colombia: "🇨🇴",
  mx: "🇲🇽",
  mexico: "🇲🇽",
  es: "🇪🇸",
  espana: "🇪🇸",
  it: "🇮🇹",
  italia: "🇮🇹",
  fr: "🇫🇷",
  francia: "🇫🇷",
  de: "🇩🇪",
  alemania: "🇩🇪",
  us: "🇺🇸",
  ca: "🇨🇦",
  canada: "🇨🇦",
};

function flagFromAlpha2Code(alpha2Code: string) {
  const code = alpha2Code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return "";
  return String.fromCodePoint(...[...code].map((char) => 127397 + char.charCodeAt(0)));
}

function getCountryFlag(country: string) {
  const raw = String(country ?? "").trim();
  const normalized = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
  const tokenized = raw.split(/\s+/).map((token) =>
    token
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .trim()
  );
  const candidates = [normalized, ...tokenized].filter(Boolean);
  for (const key of candidates) {
    const fromCode = flagFromAlpha2Code(key);
    if (fromCode) return fromCode;
    if (COUNTRY_FLAG_MAP[key]) return COUNTRY_FLAG_MAP[key];
  }
  return "";
}

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
  ca: "CA",
  canada: "CA",
};

function getCountryCode(country: string) {
  const raw = String(country ?? "").trim();
  const normalized = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
  const tokenized = raw.split(/\s+/).map((token) =>
    token
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .trim()
  );
  const candidates = [normalized, ...tokenized].filter(Boolean);
  for (const key of candidates) {
    const code = key.toUpperCase();
    if (/^[A-Z]{2}$/.test(code)) return code;
    if (COUNTRY_CODE_MAP[key]) return COUNTRY_CODE_MAP[key];
  }
  return "";
}

export default function ProviderInfo({
  value,
  rating,
  reviewCount,
  commentsUrl,
  startYear,
  activity,
  providerType,
  activityList = [],
  providerTypeList = [],
  origin,
  logo,
  headquartersInfo,
  headquarterLocations = [],
}: ProviderInfoProps) {
  const { t, locale } = useTranslation();
  const description = pickI18nText(value ?? null, locale, t("oferente_info_descripcion"));
  const safeRating = Number.isFinite(Number(rating)) && Number(rating) > 0 ? Number(rating) : null;
  const roundedRating = safeRating != null ? Math.round(safeRating * 2) / 2 : null;
  const ratingLabel = safeRating != null ? Number(safeRating.toFixed(1)).toLocaleString(locale) : "0";
  const commentCount = Number.isFinite(Number(reviewCount)) ? Number(reviewCount) : 0;
  const stars = Array.from({ length: 5 }, (_, idx) => {
    if (roundedRating == null) return "empty";
    if (roundedRating >= idx + 1) return "full";
    if (roundedRating >= idx + 0.5) return "half";
    return "empty";
  });

  const normalizedActivityList = (activityList ?? []).map((entry) => String(entry ?? "").trim()).filter(Boolean);
  const normalizedTypeList = (providerTypeList ?? []).map((entry) => String(entry ?? "").trim()).filter(Boolean);
  const activityDisplay = normalizedActivityList.length ? normalizedActivityList.join(", ") : (activity ?? "");
  const providerTypeDisplay = normalizedTypeList.length ? normalizedTypeList.join(", ") : (providerType ?? "");

  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-5">
      <div className="flex items-center gap-3">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt={t("oferente_info_titulo")} className="h-11 w-11 rounded-full object-cover" />
        ) : null}
        <h3 className="text-xl font-semibold text-gray-900">{t("oferente_info_titulo")}</h3>
      </div>
      <RichText value={description} className="mt-1.5 text-base leading-7 text-gray-700" />

      {(roundedRating != null || reviewCount != null || commentsUrl) ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-[#2C3E50]">
          <span className="font-semibold">{t("oferente_valoracion")}</span>
          <div className="flex items-center gap-1">
            {stars.map((s, idx) => (
              <span key={`${s}-${idx}`} className={s === "full" ? "text-[#F4C542]" : s === "half" ? "text-[#F4C542]" : "text-gray-300"}>
                ★
              </span>
            ))}
          </div>
          <span className="font-semibold text-slate-700">{ratingLabel}</span>
          {commentsUrl ? (
            <a className="text-[#2B7CAB] underline" href={commentsUrl} target="_blank" rel="noreferrer">
              {t("oferente_comentarios")}: {commentCount}
            </a>
          ) : reviewCount != null ? (
            <span>{t("oferente_comentarios")}: {commentCount}</span>
          ) : null}
        </div>
      ) : null}

      {(startYear || activityDisplay || providerTypeDisplay || origin) ? (
        <div className="mt-3 space-y-1.5 text-sm text-[#2C3E50]">
          {startYear ? (
            <div>
              <span className="font-semibold">{t("oferente_inicio_actividad")}:</span> {startYear}
            </div>
          ) : null}
          {activityDisplay ? (
            <div>
              <span className="font-semibold">{t("oferente_actividad")}:</span> {activityDisplay}
            </div>
          ) : null}
          {providerTypeDisplay ? (
            <div>
              <span className="font-semibold">{t("oferente_tipo")}:</span> {providerTypeDisplay}
            </div>
          ) : null}
          {origin ? (
            <div>
              <span className="font-semibold">{t("oferente_origen")}:</span> {origin}
            </div>
          ) : null}
        </div>
      ) : null}

      {(headquarterLocations.length || headquartersInfo) ? (
        <div className="mt-3 space-y-2 text-sm text-[#2C3E50]">
          <div className="font-semibold">{t("sede_oficinas")}</div>
          {headquarterLocations.length ? (
            <div className="space-y-2">
              {headquarterLocations.map((loc, idx) => {
                const label = [loc.city, loc.country].filter(Boolean).join(" · ");
                return (
                  <div key={`hq-${idx}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2">
                    <span className="inline-flex items-center gap-2">
                      {getCountryCode(loc.country) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`https://flagcdn.com/20x15/${getCountryCode(loc.country).toLowerCase()}.png`}
                          alt={loc.country}
                          className="h-[12px] w-[16px] rounded-[2px] object-cover"
                        />
                      ) : null}
                      <span>{label || loc.country}</span>
                    </span>
                    {loc.mapUrl ? (
                      <a className="text-[#2B7CAB] underline" href={loc.mapUrl} target="_blank" rel="noreferrer">
                        {t("ver_mapa")}
                      </a>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
          {headquartersInfo ? <div className="text-xs text-gray-600">{headquartersInfo}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
