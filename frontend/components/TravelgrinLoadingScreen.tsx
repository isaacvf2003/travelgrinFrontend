"use client";

import Image from "next/image";
import { useTranslation } from "@/app/hooks/useTranslation";

const DOTS = [
  "bg-[#10C2B7]",
  "bg-[#2FC7BF]",
  "bg-[#5ECFCB]",
  "bg-[#8DDCD9]",
  "bg-[#C2ECEB]",
  "bg-[#E7F8F8]",
] as const;

export default function TravelgrinLoadingScreen() {
  const { t } = useTranslation();

  return (
    <div className="pointer-events-none fixed inset-0 z-[120] flex items-center justify-center overflow-hidden bg-gradient-to-b from-[#ECEEF3]/85 via-[#EFF1F5]/82 to-[#EBEDF2]/90 px-4 py-10 backdrop-blur-[2px] animate-tg-loader-in">
      <div className="relative z-10 flex w-full max-w-[640px] flex-col items-center text-center">
        <Image
          src="/logo-green.png"
          alt="Travelgrin"
          width={760}
          height={280}
          priority
          className="h-auto w-[260px] object-contain sm:w-[360px] md:w-[430px]"
        />

        <p className="mt-6 text-center text-xl font-medium leading-tight text-[#171B49] sm:text-2xl">
          {t("preparando_proxima_aventura")}
        </p>

        <div className="mt-9 flex items-center justify-center gap-4 sm:gap-5" aria-hidden="true">
          {DOTS.map((dotClassName, index) => (
            <span
              key={dotClassName}
              className={`h-4 w-4 rounded-full shadow-[0_8px_18px_rgba(16,194,183,0.18)] sm:h-5 sm:w-5 ${dotClassName} animate-tg-dot`}
              style={{ animationDelay: `${index * 0.14}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
