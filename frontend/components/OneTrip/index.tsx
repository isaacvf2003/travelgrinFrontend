"use client"
import React from "react";
import Image from "next/image";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function OneTrip() {
  const {t} = useTranslation()
  return (
    <div className="flex lg:flex-row flex-col-reverse w-full justify-between items-center my-16">
      <div className="h-[220px] w-[335px] lg:w-[19rem] lg:h-[12rem] flex sm:hidden lg:flex mt-6 sm:mt-0">
        <Image src={"/onetravel.png"} alt="un viaje" width={400} height={300} />
      </div>
      <div className="w-[82%] h-[100%] hidden md:flex lg:hidden mt-4">
        <Image
          src={"/onetravel-one-line.png"}
          alt="un viaje"
          width={1400}
          height={1300}
        />
      </div>
      <div className="flex flex-col lg:w-[70%] lg:flex hidden">
        <h1 className="text-[25.76px] text-[#273166] font-bold text-end leading-snug whitespace-pre-line">
          {t("un_viaje_con")}
        </h1>
        <p className="text-[16px] text-[#323232] text-end leading-relaxed">
          {t("en_travelgrin_colaboramos")}
        </p>
      </div>
      <div className="flex flex-col lg:w-[70%] lg:hidden hidden md:flex">
        <h1 className="text-[25.76px] text-[#273166] font-bold text-end leading-snug whitespace-pre-line">
        {t("un_viaje_con")}
        </h1>
        <p className="text-[16px] text-[#323232] text-end mt-8 leading-relaxed">
        {t("en_travelgrin_colaboramos2")}
        </p>
      </div>

      <div className="flex flex-col lg:w-[70%] lg:hidden flex md:hidden">
        <h1 className="text-[25.76px] text-[#273166] font-bold text-end leading-snug whitespace-pre-line">
        {t("un_viaje_con")}
        </h1>
        <p className="text-[16px] text-[#323232] text-end mt-8 leading-relaxed">
        {t("en_travelgrin_colaboramos3")}
        </p>
      </div>
    </div>
  );
}