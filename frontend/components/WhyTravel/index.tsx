"use client"
import React from "react";
import Image from "next/image";
import { useTranslation } from "@/app/hooks/useTranslation";

const FeatureCard = ({ icon, title, description }) => {
  return (
    <div
      style={{
        background: "white",
      }}
      className="group pt-0 relative h-[20rem] lg:h-[18rem] w-full lg:w-[30rem]  backdrop-blur-md rounded-3xl p-8  shadow-2xl hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] border border-white/20 transition-all duration-300 hover:-translate-y-2 hover:scale-[1.01] overflow-hidden"
    >
      {/* Icon */}
      <div className="w-30 h-30 md:w-30 md:h-30 flex items-center justify-start mb-3 relative right-[30px]">
        <div className="w-30 h-30 md:w-30 md:h-30 relative">{icon}</div>
      </div>

      {/* Content */}
      <h3
        style={{
          fontFamily: "var(--font-montserrat-alternates) !important",
          color: "#273166",
        }}
        className="text-[20px] font-bold text-gray-800 mb-3 leading-tight text-white"
      >
        {title}
      </h3>
      <p
        style={{ color: "#323232" }}
        className=" leading-relaxed text-sm opacity-90 text-white"
      >
        {description}
      </p>
    </div>
  );
};

export default function FeaturesCards() {
  const {t} = useTranslation()
  const features = [
    {
      icon: (
        <Image
          src="/facil.svg"
          alt={t("facil_simple_y_sin_vueltas")}
          width={96}
          height={96}
          className="w-full h-full object-contain"
        />
      ),
      title: t("facil_simple_y_sin_vueltas"),
      description:
        t("buscas_o_publicas"),
    },
    {
      icon: (
        <Image
          src="/viajes.svg"
          alt={t("viajes_que_abren_nuevas_puertas")}
          width={96}
          height={96}
          className="w-full h-full object-contain"
        />
      ),
      title: t("viajes_que_abren_nuevas_puertas"),
      description: t("centralizamos_todo_en")
    },
    {
      icon: (
        <Image
          src="/inte.svg"
          alt={t("inteligencia_artificial_y_humana")}
          width={96}
          height={96}
          className="w-full h-full object-contain"
        />
      ),
      title: t("inteligencia_artificial_y_humana"),
      description:
        t("combinamos_ia_para")
    },
    {
      icon: (
        <Image
          src="/eco.svg"
          alt={t("un_ecosistema_que_genera_puentes")}
          width={96}
          height={96}
          className="w-full h-full object-contain"
        />
      ),
      title: t("un_ecosistema_que_genera_puentes"),
      description:
        t("fomentamos_conexiones_seguras")
    },
  ];

  return (
    <>
      <h1
        style={{
          color: "#273166",
        }}
        className="text-[25.76px] mb-[3rem] mt-[3rem] text-center font-bold"
      >
        {t("por_que_elegir_travelgrin")}
      </h1>
      <div className="px-4 pb-4 flex items-center justify-center">
        <div className="max-w-5xl w-full">
          {/* Grid centrado para acomodar el tamaño fijo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10  justify-items-center">
            {features.map((feature, index) => (
              <FeatureCard
                key={index}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
