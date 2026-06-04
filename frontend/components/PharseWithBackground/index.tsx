"use client";
import React from "react";
import ChangingText from "../ChangingText";
import Image from "next/image";
import { useTranslation } from "@/app/hooks/useTranslation";

type Props = {
  onlyOne?: boolean;
};

export default function PharseWithBackground({ onlyOne = false }: Props) {
  const { t } = useTranslation();
  const phrasesThePractice = [
    t("el_asesor"), // "Il consulente"
    t("la_cura"), // "la cura"
    t("la_formacion"), // "la formazione"
    t("el_documento"), // "i documenti"
    t("el_socio"), // "il partner"
    t("el_cliente"), // "il cliente"
    t("el_proveedor"), // "il fornitore"
    t("la_experiencia"), // "l'esperienza"
    t("el_colaborador"), // "il collaboratore"
  ];
  return (
    <>
      <div className="relative w-full ">
        {/* 1. Fondo SVG del mapa */}
        <div className="w-full rounded-[60px]">
          <Image
            src={
              !onlyOne
                ? "/fondo-frase-el-cliente.webp"
                : "/fondo-frase-libre.webp"
            }
            alt="Mapa mundial"
            className={`w-full  object-cover rounded-[60px] ${
              !onlyOne ? "md:h-[11rem]" : " md:h-[11rem] "
            }`}
            width={1024}
            height={768}
          />
        </div>

        {/* 3. Banda verde para el texto */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full">
          <div
            className={`rounded-[6px] md:rounded-[60px]     flex items-center justify-center  ${
              onlyOne ? "h-[7rem] md:h-[8rem] pt-[2rem]" : ""
            }`}
          >
            <div className="w-full flex items-center justify-center">
              {!onlyOne ? (
                <ChangingText
                  phrases={phrasesThePractice}
                  isNotAlone={!onlyOne}
                  isBlackText={true}
                  isBiggerText={onlyOne}
                />
              ) : (
                <h1
                  style={{
                    fontFamily: "var(--font-montserrat-alternates) !important",
                  }}
                  className="text-[25.76px] mb-8 leading-tight"
                >
                  <span className="font-bold" style={{ color: "#273166" }}>
                    {t("se_libre_parte1")}
                  </span>
                  <br />
                  <span className="text-white font-bold">
                    {t("se_libre_parte2")}
                    <br />
                    {t("se_libre_parte3")}
                  </span>
                </h1>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
