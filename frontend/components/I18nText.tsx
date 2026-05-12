"use client";

import { useTranslation } from "@/app/hooks/useTranslation";
import { pickI18nText, type I18nRecord } from "@/app/lib/i18nContent";
import RichText from "@/components/RichText";

type Props = {
  value?: I18nRecord | null;
  fallback?: string;
  rich?: boolean;
  className?: string;
};

export default function I18nText({ value, fallback = "", rich = false, className = "" }: Props) {
  const { locale } = useTranslation();
  const text = pickI18nText(value ?? null, locale, fallback);
  if (rich) return <RichText value={text} className={className} />;
  return <>{text}</>;
}
