"use client";

import { useTranslation } from "@/app/hooks/useTranslation";

type PriceDisplayProps = {
  price?: string | null;
  currency?: string | null;
  period?: string | null;
};

export default function PriceDisplay({ price, currency, period }: PriceDisplayProps) {
  const { t, locale } = useTranslation();

  if (!price) return <>{t("precio_a_convenir")}</>;

  const raw = String(price);
  const digits = raw.replace(/[^\d]/g, "");
  const amount = digits ? Number(digits) : NaN;
  const formatted = Number.isFinite(amount)
    ? new Intl.NumberFormat(locale === "en" ? "en-US" : "es-AR").format(amount)
    : raw;
  const label = String(currency ?? "").toUpperCase() || "$";
  const suffix =
    period === "month"
      ? t("price_period_month")
      : period === "week"
        ? t("price_period_week")
        : period === "day"
          ? t("price_period_day")
          : period === "year"
            ? t("price_period_year")
            : "";

  return (
    <span>
      {label} {formatted}
      {suffix ? <span className="text-sm font-medium text-gray-500"> {suffix}</span> : null}
    </span>
  );
}
