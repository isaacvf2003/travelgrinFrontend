"use client";
import { useTranslation } from "@/app/hooks/useTranslation";
import { Locale } from "@/app/lib/translations";
import { ChevronDown } from "lucide-react";
import React, { useState } from "react";
import Image from "next/image";

// Importar las banderas SVG que necesitas
import ES from "country-flag-icons/react/3x2/ES";
import US from "country-flag-icons/react/3x2/US";
import PT from "country-flag-icons/react/3x2/PT";
import IT from "country-flag-icons/react/3x2/IT";

type Props = {
  isBorderBlack?: boolean;
  isMobile?: boolean;
  isWelcome?: boolean;
};

export default function SelectCountry({
  isBorderBlack,
  isMobile,
  isWelcome,
}: Props) {
  const { locale, setLocale } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  // Función para obtener el componente de bandera
  const getFlagComponent = (code: string) => {
    const flagComponents = {
      es: ES,
      en: US,
      pt: PT,
      it: IT,
    };

    const FlagComponent = flagComponents[code as keyof typeof flagComponents];

    if (FlagComponent) {
      return (
        <FlagComponent
          className="w-6 h-4 rounded-sm object-cover"
          title={`Bandera ${code}`}
        />
      );
    }

    return (
      <div className="w-6 h-4 bg-gray-300 rounded-sm flex items-center justify-center text-xs">
        🌍
      </div>
    );
  };

  const languages = [
    { code: "es" as Locale, name: "Español" },
    { code: "en" as Locale, name: "English" },
    { code: "pt" as Locale, name: "Português" },
    { code: "it" as Locale, name: "Italiano" },
  ];

  const currentLanguage =
    languages.find((lang) => lang.code === locale) || languages[0];

  const handleLanguageChange = (newLocale: Locale) => {
    setLocale(newLocale);
    setIsOpen(false);
  };

  return (
    <div className={`${isMobile ? "w-full flex justify-center items-center" : ""} relative z-[120]`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`${isMobile ? "w-[7rem]" : ""} ${
          isWelcome ? "w-[6.8rem] mb-2 h-[3rem]" : "h-[3.27rem]"
        } flex items-center gap-2 px-3 py-4 border-2 ${
          isBorderBlack ? "border-gray-200" : "border-white"
        } border-opacity-50 text-white hover:bg-white hover:bg-opacity-10 transition-all duration-200 border-2 ${isWelcome ? "" : "border-white/30"} rounded-xl bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-all duration-300`}
      >
        <Image
          width={60}
          height={60}
          className={isMobile ? "w-9 w-9" : "w-8 h-8"}
          alt="icono lenguage"
          src={isMobile ? "/icono-language-transparent.png" : "/icono-lenguaje.svg"}
        />

        {/* <div className="flex items-center justify-center">
          {!isWelcome && getFlagComponent(currentLanguage.code)}
        </div> */}

        <div className={`${isWelcome ? "text-black" : "text-white"}`}>
          {isMobile && currentLanguage.code.toUpperCase()}
          {isWelcome && (
            <span className="text-[14px] relative right-1">
              {currentLanguage.code.toUpperCase()}
            </span>
          )}
        </div>

        <ChevronDown
          className={`w-4 h-4 ${
            isBorderBlack ? "text-black" : "text-white"
          } transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[110]"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div
            className={`absolute top-full mt-2 md:right-0 right-1 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden z-[130] ${
              isWelcome ? "w-[11rem]" : ""
            } ${!isMobile ? "w-[11rem]" : "w-full"} md:min-w-[140px]`}
          >
            {languages.map((language) => (
              <button
                key={language.code}
                onClick={() => handleLanguageChange(language.code)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                  locale === language.code
                    ? "bg-blue-50 text-blue-600"
                    : "text-gray-700"
                }`}
              >
                {getFlagComponent(language.code)}
                <span className="text-sm font-medium">{language.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
