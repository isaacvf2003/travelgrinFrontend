"use client";

import { useTranslation } from "@/app/hooks/useTranslation";
import I18nText from "@/components/I18nText";
import type { I18nRecord } from "@/app/lib/i18nContent";

type ProviderInfoSectionProps = {
  infoI18n?: I18nRecord | null;
};

export default function ProviderInfoSection({ infoI18n }: ProviderInfoSectionProps) {
  const { t } = useTranslation();
  if (!infoI18n) return null;

  return (
    <div className="mt-8 rounded-3xl border border-gray-200 bg-white p-6">
      <h3 className="text-lg font-semibold text-gray-900">{t("info_oferente_titulo")}</h3>
      <div className="mt-3 whitespace-pre-wrap text-sm text-gray-700">
        <I18nText value={infoI18n} fallback="" rich />
      </div>
    </div>
  );
}
