"use client"
import Image from "next/image";
import React from "react";
import ButtonSolid from "../ButtonSolid";
import Steps from "../Steps";
import SumateEcosystem from "../SumateEcosystem";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function HowDoesItWork() {
  const {t} = useTranslation()
  return (
    <>
      <div
        style={{ backgroundColor: "#273166" }}
        className="h-auto rounded-t-[20px] lg:rounded-t-[200px] lg:pt-[7rem] pt-[2rem]"
      >
        <div
          className=" md:max-w-[980px]  w-[20rem]  green-background md:w-[43rem] lg:w-[50rem] xl:w-[60rem] mx-auto rounded-[20px] md:h-[472px] h-[55rem] lg:h-[27rem] xl:h-[28rem] men-320-container"
          style={{
            background:
              "linear-gradient(90deg, #08D9BD 0%, #04B5BD 50%, #009ABC 100%)",
          }}
        >
          <div className="flex mx-auto  lg:max-w-[55rem] lg:items-start flex-col md:flex-row ">
            <div className="relative justify-center  lg:w-2/4">
              <div className="relative justify-center items-center flex">
                <div
                  className="absolute bg-white lg:h-64 lg:w-64 md:w-[13rem] md:h-[14.2rem] h-[21.6rem] men-320 w-[20rem] men-320-height rounded-2xl shadow-lg top-[5rem]"
                  style={{ zIndex: 0 }}
                ></div>

                <Image
                  src={"/men-hdiw.png"}
                  width={800}
                  height={800}
                  alt="hombre como funciona"
                  className="relative lg:w-3/4 md:h-[308px] h-[400px] object-contain lg:mt-7"
                  style={{ zIndex: 1 }}
                />
              </div>
            </div>

            <div className="text-center lg:text-left lg:w-3/4 mt-16 px-6">
              <h1 className="text-white text-[25.76px] leading-tight mb-4 text-start ">
                {t("llega_a_quienes")}
              </h1>
                <h1 className="text-white text-[16px] mb-6 text-start">
                  {t("en_travelgrin_tu")}
                </h1>
                <div className=" flex flex-row items-center  mb-6">
                  <Image
                    src="/persons-2.webp"
                    alt="User Placeholder"
                    width={200}
                    height={200}
                    className="w-[8rem] h-[4rem] rounded-full  object-cover"
                  />
                  <p className="text-[14px] font-bold ml-1">
                    {t("cien_propuestas")}
                  </p>
              </div>
              <div className="text-start ">
                <ButtonSolid
                  hexButton="#273166"
                  title={t("publica_gratis_ahora")}
                  classStyle="w-[15rem] md:w-auto text-sm lg:text-lg bg-teal-500 hover:bg-teal-600 text-white lg:px-12 py-3 rounded-lg font-medium text-lg transition-colors"
                />
              </div>
            </div>
          </div>
        </div>
        <Steps />
      </div>
      <SumateEcosystem />
    </>
  );
}
