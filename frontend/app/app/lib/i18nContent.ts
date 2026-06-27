import type { Locale } from "@/app/lib/translations";

export type I18nRecord = Partial<Record<Locale, string>>;

export function pickI18nText(value: I18nRecord | null | undefined, locale: Locale, fallback = ""): string {
  if (!value) return fallback;
  if (typeof value === "string") return value;
  const preferred = value[locale];
  if (preferred && preferred.trim()) return preferred;
  const base = value.es;
  if (base && base.trim()) return base;
  return fallback;
}
