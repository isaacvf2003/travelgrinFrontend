"use client";

import { Compass } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function PrestacionesSectionHeader() {
  const { t } = useTranslation();

  return (
    <div className="mb-5 overflow-hidden rounded-3xl border border-[#2C7BE5]/15 bg-gradient-to-br from-[#F3F8FF] via-white to-[#EAF7FA] p-5 shadow-[0_18px_45px_rgba(11,143,163,0.10)]">
      <div className="flex flex-col items-center gap-3">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#2C7BE5]/20 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-[#1A4B8C] shadow-sm">
            <Compass className="h-3.5 w-3.5 text-[#2563EB]" />
            {t("prestaciones_section_kicker")}
          </span>
          <h2 className="mt-3 text-[22px] font-bold tracking-tight text-[#273166] md:text-[25.76px]">
            {t("prestaciones_section_title")}
          </h2>
          <p className="mt-2 max-w-2xl text-[14px] leading-6 text-[#5B6F75] md:text-[16px]">
            {t("prestaciones_section_description")}
          </p>
        </div>
      </div>
    </div>
  );
}
