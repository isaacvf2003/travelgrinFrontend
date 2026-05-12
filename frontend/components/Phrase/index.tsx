"use client"
import React from "react";
import Image from "next/image";
import ButtonSolid from "../ButtonSolid";
import { useTranslation } from "@/app/hooks/useTranslation";
export default function Phrase() {
  const {t} = useTranslation()//
  return (
    <div
      className="flex w-full max-w-[24rem] flex-col items-center justify-center rounded-[20px] text-white my-8 h-[520px] md:h-[506px] md:max-w-none md:w-full mx-auto"
      style={{
        background:
          "linear-gradient(90deg, #08D9BD 0%, #04B5BD 50%, #009ABC 100%)",
      }}
    >
      <h1 className="text-[22px] md:text-[25.76px] font-semibold my-8 text-center whitespace-pre-line">
        {t("creemos_en_un")}
      </h1>
      <Image
        // Mantener el logo contenido (en algunos browsers el intrinsic size + CSS podía agrandarlo)
        className="mb-8 h-auto w-full max-w-[260px] object-contain"
        src="/logo-phrase.png"
        alt="logo travel grin"
        width={260}
        height={110}
      />
      <ButtonSolid
        hexButton="#15A4AE"
        redirectTo="/buscar"
        classStyle="w-[15rem] my-8 md:w-auto text-[14px] sm:text-sm lg:text-lg bg-teal-500 hover:bg-teal-600 text-white lg:px-12 py-3 rounded-lg font-medium transition-colors"
        title={t("cambiar_mi_historia")}
      />
    </div>
  );
}
