"use client"
import React from "react";
import Image from "next/image";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function WeAreTravelGrin() {
  const {t} = useTranslation()
  return (
    <div className="w-full bg-gray-50 py-8 lg:py-16">
      <div className="max-w-7xl mx-auto px-4 lg:px-6">
        {/* Layout Desktop */}
        <div className="hidden sm:hidden md:hidden xl:flex lg:flex items-end gap-8">
          {/* Texto lado izquierdo */}
          <div className="w-1/2 max-w-lg">
            <h1 className="text-[25.76px] font-bold text-[#273166] mb-6 leading-snug whitespace-pre-line">
             {t("somos_travelgrin_transformamos")}
            </h1>

            <div className="space-y-4 text-gray-700">
              <p className="text-[16px] leading-relaxed">
              {t("no_somos_una")}
              </p>
            </div>
          </div>

          {/* Grid de imágenes lado derecho */}
          <div className="w-1/2 space-y-2">
            {/* Fila superior - imágenes más anchas */}
            <div className="flex space-x-2">
              <div className="h-44 rounded-lg overflow-hidden w-[65%]">
                <Image
                  src="/weare-1.png"
                  alt=""
                  width={600}
                  height={300}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="h-44 rounded-lg overflow-hidden w-[35%]">
                <Image
                  src="/weare-2.png"
                  alt=""
                  width={600}
                  height={300}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* Fila inferior - imágenes más estrechas centradas */}
            <div className="flex justify-center space-x-2">
              <div className="w-[35%] h-44 rounded-lg overflow-hidden">
                <Image
                  src="/weare-3.png"
                  alt=""
                  width={600}
                  height={300}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="w-[65%] h-44 rounded-lg overflow-hidden">
                <Image
                  src="/weare-4.png"
                  alt=""
                  width={600}
                  height={300}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Layout Tablet */}
        <div className="hidden md:flex flex-col lg:hidden items-start gap-8">
          {/* Texto lado izquierdo */}
          <div className="w-2/2 max-w-lg">
            <h1 className="text-[25.76px] font-bold text-[#273166] mb-6 leading-snug">
            {t("somos_travelgrin_transformamos")}
            </h1>

            <div className="space-y-4 text-gray-700">
              <p className="text-[16px] leading-relaxed">
              {t("no_somos_una")}

              </p>
            </div>
          </div>

          {/* Grid de imágenes lado derecho */}
          <div className="w-2/2 space-y-2">
            {/* Fila superior - imágenes más anchas */}
            <div className="flex space-x-2">
              <div className="h-44 rounded-lg overflow-hidden w-[65%]">
                <Image
                  src="/weare-1.png"
                  alt=""
                  width={600}
                  height={300}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="h-44 rounded-lg overflow-hidden w-[35%]">
                <Image
                  src="/weare-2.png"
                  alt=""
                  width={600}
                  height={300}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* Fila inferior - imágenes más estrechas centradas */}
            <div className="flex justify-center space-x-2">
              <div className="w-[35%] h-44 rounded-lg overflow-hidden">
                <Image
                  src="/weare-3.png"
                  alt=""
                  width={600}
                  height={300}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="w-[65%] h-44 rounded-lg overflow-hidden">
                <Image
                  src="/weare-4.png"
                  alt=""
                  width={600}
                  height={300}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Layout Mobile */}
        <div className="flex md:hidden flex-col lg:hidden items-end gap-8">
          {/* Texto lado izquierdo */}
          <div className="w-2/2 max-w-lg">
            <h1 className="text-[25.76px] font-bold text-[#273166] mb-6 leading-snug">
            {t("somos_travelgrin_transformamos")}
            </h1>

            <div className="space-y-4 text-gray-700">
              <p className="text-[16px] leading-relaxed">
              {t("no_somos_una")}

              </p>
            </div>
          </div>

          {/* Grid de imágenes lado derecho */}
          <div className="w-2/2 space-y-2">
            {/* Fila superior - imágenes más anchas */}
            <div className="flex space-x-2">
              <div className="h-44 rounded-lg overflow-hidden w-[65%]">
                <Image
                  src="/weare-1.png"
                  alt=""
                  width={600}
                  height={300}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="h-44 rounded-lg overflow-hidden w-[35%]">
                <Image
                  src="/weare-2.png"
                  alt=""
                  width={600}
                  height={300}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* Fila inferior - imágenes más estrechas centradas */}
            <div className="flex justify-center space-x-2">
              <div className="w-[35%] h-44 rounded-lg overflow-hidden">
                <Image
                  src="/weare-3.png"
                  alt=""
                  width={600}
                  height={300}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="w-[65%] h-44 rounded-lg overflow-hidden">
                <Image
                  src="/weare-4.png"
                  alt=""
                  width={600}
                  height={300}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}