"use client";

import I18nText from "@/components/I18nText";
import type { I18nRecord } from "@/app/lib/i18nContent";

type ExtraSection = {
  titleI18n?: I18nRecord | null;
  descriptionI18n?: I18nRecord | null;
};

type PublicationExtraSectionsProps = {
  sections: ExtraSection[];
};

export default function PublicationExtraSections({ sections }: PublicationExtraSectionsProps) {
  if (!sections.length) return null;

  return (
    <div className="mt-6 space-y-4">
      {sections.map((section, index) => (
        <div key={`extra-section-${index}`} className="rounded-2xl border border-gray-100 p-4">
          <h3 className="text-sm font-semibold text-gray-900">
            <I18nText value={section.titleI18n} fallback="" />
          </h3>
          <div className="mt-2 whitespace-pre-wrap text-sm text-gray-700">
            <I18nText value={section.descriptionI18n} fallback="" rich />
          </div>
        </div>
      ))}
    </div>
  );
}
