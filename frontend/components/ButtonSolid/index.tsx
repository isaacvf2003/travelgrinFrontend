"use client";
import React from "react";
import { useRouter } from "next/navigation";
import ModalDemandante from "../ModalDemandante";
import { useCountry } from "@/app/context/CountryProvider";

type Props = {
  title: string;
  classStyle?: string;
  hexButton?: string;
  categorySelected?: string;

  // ✅ antes era string, ahora puede ser string u objeto país (restcountries)
  destinationCountry?: any;

  disabled?: boolean;
  onSubmit?: () => void;
  hasSubmit?: boolean;
  isHeaderButton?: boolean;
  setHideCountryOnOpenModal?: (hide: boolean) => void;
  hasIcon?: boolean;
  isDesktopHeader?: boolean;
  redirectTo?: string;
};

export default function ButtonSolid({
  title,
  classStyle,
  hexButton,
  categorySelected,
  destinationCountry,
  disabled = false,
  onSubmit,
  hasSubmit = false,
  isHeaderButton = false,
  setHideCountryOnOpenModal,
  hasIcon = false,
  isDesktopHeader = false,
  redirectTo,
}: Props) {
  const router = useRouter();
  const [isOpenDemandante, setIsOpenDemandante] = React.useState(false);
  const {
    selectedCountry,
    setSelectedCountry,
    setIsOpenModalOferente,
    setIsOpenModalDemandante,
    setIsOpenModal,
  } = useCountry();

  return (
    <>
      <button
        disabled={disabled}
        onClick={() => {
          // ✅ si se usa para búsqueda, NO abre modales
          if (hasSubmit) {
            onSubmit?.();
            return;
          }
          if (redirectTo) {
            router.push(redirectTo);
            return;
          }

          if (hexButton !== "#273166") {
            setIsOpenDemandante(true);
            setIsOpenModalDemandante?.(true);
            setIsOpenModalOferente?.(false);
          } else {
            setIsOpenDemandante(false);
            setIsOpenModalDemandante?.(false);
            setIsOpenModalOferente?.(true);
          }

          if (!isHeaderButton) {
            setIsOpenModal?.(true);
          } else {
            setHideCountryOnOpenModal?.(true);
          }
        }}
        className={` cursor-pointer ${isDesktopHeader ? "px-4" : "px-6 py-2"} text-white font-medium rounded-lg transition-all duration-200 relative overflow-hidden group ${classStyle}`}
      >
        {/* Star Border Effect - siempre visible */}
        <div className="absolute inset-0 rounded-lg">
          <div
            className="absolute inset-0 rounded-lg"
            style={{
              background: `conic-gradient(from 0deg, 
                transparent 0%, 
                #ffffff60 15%, 
                #00d4ff 25%, 
                #ffffff80 35%, 
                transparent 45%, 
                transparent 55%, 
                #ffffff60 65%, 
                #00d4ff 75%, 
                #ffffff80 85%, 
                transparent 100%)`,
              animation: "spin 4s linear infinite",
              padding: "2px",
            }}
          />
          <div
            className="absolute inset-[2px] rounded-lg shadow-[0_0_20px_rgba(0,212,255,0.3)]"
            style={{
              backgroundColor: hexButton,
              boxShadow: `inset 0 0 20px rgba(0,212,255,0.1), 0 0 20px rgba(0,212,255,0.2)`,
            }}
          />
        </div>

        <div className="absolute inset-0 -top-4 -bottom-4 opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-10">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-800 ease-out"></div>
        </div>

        {hasIcon && (
          <div className="flex flex-row justify-between">
            <span className="w-6 md:w-22"></span>
            <span className="relative z-20">{title}</span>
            <div className="mt-3 md:mt-0 bg-white z-10 h-7 w-7 rounded-full flex flex-col justify-center items-center">
              <span className="text-white z-20 text-end">🤖</span>
            </div>
          </div>
        )}

        {!hasIcon && <span className="relative z-20">{title}</span>}
      </button>

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes glow-pulse {
          0%, 100% {
            box-shadow: 0 0 20px rgba(0, 212, 255, 0.2),
              inset 0 0 20px rgba(0, 212, 255, 0.1);
          }
          50% {
            box-shadow: 0 0 30px rgba(0, 212, 255, 0.4),
              inset 0 0 30px rgba(0, 212, 255, 0.2);
          }
        }
      `}</style>

            {isOpenDemandante && (
        <ModalDemandante
          categorySelected={categorySelected}
          destinationCountrySelected={destinationCountry}
          onClose={() => {
            setHideCountryOnOpenModal?.(false);
            setIsOpenDemandante(false);
          }}
          selectedCountry={selectedCountry ?? ""}
          setSelectedCountry={(country) => setSelectedCountry?.(country)}
        />
      )}
    </>
  );
}
