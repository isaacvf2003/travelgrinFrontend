"use client";

import { useState } from "react";
import TranslatedText from "@/components/TranslatedText";
import SafetyAdvisoryModal from "./SafetyAdvisoryModal";

export default function TravelRecommendationAction() {
  const [warningOpen, setWarningOpen] = useState(false);

  return (
    <>
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setWarningOpen(true)}
        className="w-full rounded-2xl border border-[#0B8FA3]/35 bg-gradient-to-r from-[#E9FBFF] to-[#D9F3FF] px-4 py-3 text-sm font-semibold text-[#0B5E6B] shadow-[0_8px_22px_rgba(11,143,163,0.16)] transition hover:from-[#DDF7FD] hover:to-[#CCEFFF]"
      >
        <TranslatedText id="recomendaciones_viaje" />
      </button>
    </div>
    <SafetyAdvisoryModal open={warningOpen} onAcknowledge={() => setWarningOpen(false)} />
    </>
  );
}
