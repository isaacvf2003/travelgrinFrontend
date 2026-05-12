"use client";
import Image from "next/image";
import React from "react";
import ButtonSolid from "../ButtonSolid";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function SumateEcosystem() {
  const { t } = useTranslation();
  const images = [
    { name: t("profesional_independiente"), icon: "/eco-1-only-white.png" },
    { name: t("empresa_privada"), icon: "/eco-2-only-white.png" },
    { name: t("organismo_publico"), icon: "/eco-3-only-white.png" },
    { name: t("ongs"), icon: "/eco-4-only-white.png" },
  ];
  return (
    <div
      className=" py-8  rounded-b-[100px] lg:rounded-b-[200px] "
      style={{
        background:
          "linear-gradient(90deg, #08D9BD 0%, #04B5BD 50%, #009ABC 100%)",
      }}
    >
      <div className="text-center text-white max-w-[25rem] mx-auto">
        <h1 className="text-[25.76px] font-bold">{t("sumate_sin_importar")}</h1>
        <p className="text-center text-[16px]">{t("actuas_de_manera")}</p>
      </div>
      <div className="max-w-2xl mx-auto mt-[3rem]">
        <div className="flex flex-row w-full  justify-center items-center ">
          {images.map((image, index) => (
            <div
              key={index}
              className={`justify-center  items-center flex flex-col md:space-x-12 space-x-0 md:mr-[25px] ${index === 3 ? "relative bottom-3 md:bottom-0" : ""}`}
            >
              <Image
                className="md:w-[6rem] md:h-[6rem] w-[3rem] h-[3rem] object-contain md:m-0"
                width={168}
                height={154}
                src={image.icon}
                alt="cards ecosistema"
              />
              <p className="text-white text-center mt-2 md:text-[14px] text-[14px] max-w-[6rem] md:max-w-[16rem]">
                {image.name}
              </p>
            </div>
          ))}
        </div>
      </div>
      <div className="w-full mx-auto space-y-6 flex justify-center items-center flex-col mt-[5rem]">
        <div className="flex-row flex items-center justify-center">
          <div>
            <Image
              className="w-[122px] h-[122px] object-contain"
              width={200}
              height={200}
              src={"/regalo.png"}
              alt="regalo icono"
            />
          </div>
          <h1 className="md:flex hidden  text-[16px] text-white whitespace-pre-line">
            {t("se_uno_de_los_100")}
          </h1>
          <h1 className="flex md:hidden lg:hidden text-[16px] text-white whitespace-pre-line">
            {t("se_uno_de_los_100")}
          </h1>
        </div>
        <div>
          <ButtonSolid
            hexButton="#273166"
            title={t("quiero_ser_parte")}
            classStyle="w-[15rem] md:w-auto text-sm lg:text-lg bg-teal-500 hover:bg-teal-600 text-white lg:px-12 py-3 rounded-lg font-medium text-lg transition-colors"
          />
        </div>
      </div>
    </div>
  );
}
