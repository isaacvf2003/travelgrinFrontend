"use client";

import { Sparkles } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function PrestacionesSectionHeader() {
  const { t } = useTranslation();

  return (
    <div className="mb-5 overflow-hidden rounded-3xl border border-[#2C7BE5]/20 bg-gradient-to-r from-[#08D9BD] via-[#04B5BD] to-[#009ABC] p-6 text-center shadow-[0_14px_40px_rgba(0,154,188,0.18)]">
      <div className="flex flex-col items-center gap-3">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/90 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-[#0D6E86] shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-[#00A9C6]" />
            {t("prestaciones_section_kicker")}
          </span>
          <h2 className="mt-3 text-[34px] font-bold tracking-tight text-white">
            {t("prestaciones_section_title")}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/90">
            {t("prestaciones_section_description")}
          </p>
        </div>
      </div>
    </div>
  );
}
