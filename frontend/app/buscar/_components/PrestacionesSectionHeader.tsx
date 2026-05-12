"use client";

import { Sparkles } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function PrestacionesSectionHeader() {
  const { t } = useTranslation();

  return (
    <div className="mb-5 overflow-hidden rounded-3xl border border-[#2C7BE5]/15 bg-gradient-to-br from-[#F3F8FF] via-white to-[#EAF7FA] p-5 shadow-[0_18px_45px_rgba(11,143,163,0.10)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#2C7BE5]/20 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-[#1A4B8C] shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-[#00A9C6]" />
            {t("prestaciones_section_kicker")}
          </span>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-[#0B2B30]">
            {t("prestaciones_section_title")}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5B6F75]">
            {t("prestaciones_section_description")}
          </p>
        </div>
      </div>
    </div>
  );
}
