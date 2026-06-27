"use client";

import { useTranslation } from "@/app/hooks/useTranslation";

const LOCALE_MAP: Record<string, string> = {
  es: "es-AR",
  en: "en-US",
  pt: "pt-BR",
  it: "it-IT",
};

function formatAmount(value: string, locale: string) {
  const digits = String(value).replace(/[^\d]/g, "");
  const amount = digits ? Number(digits) : NaN;
  if (!Number.isFinite(amount)) return value;
  return new Intl.NumberFormat(locale).format(amount);
}

export default function PriceLabel({ price, currency }: { price: string; currency: string }) {
  const { t, locale } = useTranslation();
  if (!price) return <>{t("precio_a_convenir")}</>;
  const label = (currency || "$").toUpperCase();
  const localeTag = LOCALE_MAP[locale] ?? "es-AR";
  return <>{`${label} ${formatAmount(price, localeTag)}`}</>;
}
