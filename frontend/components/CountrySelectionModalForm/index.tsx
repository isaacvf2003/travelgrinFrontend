"use client";
import React, { useEffect, useState } from "react";
import Image from "next/image";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
type Props = {
  selectedCountry: string | null;
  setSelectedCountry: (country: string) => void;
  isEmpty?: boolean;
};

type CountryApi = {
  name: { common: string };
  cca2: string;
  translations?: { spa?: { common: string } };
  flags?: { svg?: string; png?: string };
};

type Country = CountryApi & { spanishName: string };

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();

// export const PassportIconDetailed = ({ className = "w-6 h-6" }) => (
//   <svg
//   className={`${className} text-black`}
//     fill="black"
//     viewBox="0 0 24 24"
//   >
//     <rect x="4" y="2" width="16" height="20" rx="1" ry="1" fill="currentColor" opacity="0.8"/>
//     <rect x="5" y="3" width="14" height="18" rx="0.5" ry="0.5" fill="white"/>
//     <rect x="8" y="6" width="8" height="6" rx="0.5" ry="0.5" fill="currentColor" opacity="0.3"/>
//     <circle cx="12" cy="9" r="1.5" fill="currentColor" opacity="0.6"/>
//     <rect x="7" y="14" width="10" height="0.5" fill="currentColor" opacity="0.4"/>
//     <rect x="7" y="15.5" width="8" height="0.5" fill="currentColor" opacity="0.4"/>
//     <rect x="7" y="17" width="6" height="0.5" fill="currentColor" opacity="0.4"/>
//     <circle cx="17" cy="5" r="1" fill="currentColor" opacity="0.5"/>
//   </svg>
// );

export default function CountrySelectionModalForm({
  selectedCountry,
  setSelectedCountry,
  isEmpty,
}: Props) {
  const { t } = useTranslation();
  const [countries, setCountries] = useState<Country[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [internalCountry, setInternalCountry] = useState<Country | null>(null);

  useEffect(() => {
    fetchCountries();
  }, []);

  // Sincronizar el país interno cuando cambia selectedCountry
  useEffect(() => {
    if (!selectedCountry) {
      setInternalCountry(null);
      return;
    }

    const target = normalize(selectedCountry);
    const match =
      countries.find((country) => normalize(country.spanishName) === target) ||
      countries.find((country) => normalize(country.name.common) === target) ||
      null;

    setInternalCountry(match);
  }, [selectedCountry, countries]);

  const fetchCountries = async () => {
    try {
      const response = await fetch("/api/countries");
      const payload = await response.json().catch(() => ({}));
      const data = (Array.isArray(payload?.items) ? payload.items : []) as CountryApi[];

      const countriesWithSpanish: Country[] = data.map((country) => ({
        ...country,
        spanishName: country.translations?.spa?.common || country.name.common,
      }));

      const sortedCountries = countriesWithSpanish.sort((a, b) =>
        a.spanishName.localeCompare(b.spanishName)
      );

      setCountries(sortedCountries);
    } catch (error) {
      console.error("Error fetching countries:", error);
    }
  };

  const filteredCountries = countries.filter((country) => {
    const term = normalize(searchTerm);
    return (
      normalize(country.spanishName).includes(term) ||
      normalize(country.name.common).includes(term)
    );
  });

  const selectCountry = (country: Country) => {
    setInternalCountry(country);
    setSelectedCountry(country.spanishName);
    setIsDropdownOpen(false);
    setSearchTerm("");
  };

  return (
    <div>
      <div className="mb-6 relative">
        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="w-full flex items-start h-[4rem] justify-between p-4 pb-0 pt-6 rounded-lg transition-all duration-300 bg-white group transform hover:scale-[1.02] focus:scale-[1.02]"
            style={{
              boxShadow: isEmpty
                ? "0 8px 25px -8px rgba(220, 38, 38, 0.4), 0 4px 12px -4px rgba(220, 38, 38, 0.2)"
                : "0 8px 32px -12px rgba(8, 217, 189, 0.3), 0 4px 16px -6px rgba(4, 181, 189, 0.25), 0 2px 8px -3px rgba(0, 154, 188, 0.2)",
              filter: isEmpty
                ? "drop-shadow(0 4px 8px rgba(220, 38, 38, 0.15))"
                : "drop-shadow(0 4px 12px rgba(8, 217, 189, 0.2))",
            }}
          >
            <div className="flex items-start justify-start">
              <Image
                src={"/pasaporte-icon.svg"}
                className="w-[3rem] h-[3rem] relative -top-3"
                width={100}
                height={100}
                alt="icon pasaporte"
              />
              {internalCountry && (
                <Image
                  src={internalCountry.flags?.svg || internalCountry.flags?.png}
                  className="top-1.5 relative mr-2"
                  width={20}
                  height={20}
                  alt="flag"
                />
              )}
              <span className={isEmpty ? "text-red-600" : "text-gray-700"}>
                {internalCountry ? internalCountry.spanishName : ""}
              </span>
            </div>
            <ChevronDown
              className={`w-5 h-5 transition-all duration-200 ${
                isEmpty
                  ? "text-red-500 group-hover:text-red-600"
                  : "text-gray-400 group-hover:text-teal-500"
              } ${
                isDropdownOpen
                  ? `rotate-180 ${isEmpty ? "text-red-500" : "text-teal-500"}`
                  : ""
              }`}
            />
          </button>

          <label
            className={`absolute left-3 transition-all duration-200 pointer-events-none ${
              internalCountry || isDropdownOpen
                ? `-top-2 text-xs bg-white px-1 font-medium ${
                    isEmpty ? "text-red-600" : "text-teal-600"
                  }`
                : `top-4 text-base ${
                    isEmpty ? "text-red-500" : "text-gray-500"
                  }`
            }`}
          >
            * {t("pais_de_tu_pasaporte")}
          </label>
        </div>

        {isEmpty && (
          <div className="mt-2 flex items-center gap-2 text-red-600 text-sm animate-in slide-in-from-top-1 duration-200">
            <svg
              className="w-4 h-4 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <span className="font-medium">{t("campo_requerido")}</span>
          </div>
        )}

        {isDropdownOpen && (
          <div
            className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg z-20 overflow-hidden animate-in slide-in-from-top-2 duration-200"
            style={{
              boxShadow:
                "0 20px 40px -12px rgba(8, 217, 189, 0.25), 0 8px 24px -8px rgba(4, 181, 189, 0.2), 0 4px 12px -4px rgba(0, 154, 188, 0.15)",
              filter: "drop-shadow(0 6px 20px rgba(8, 217, 189, 0.15))",
            }}
          >
            <div className="p-3 bg-gray-50">
              <div className="relative">
                <input
                  type="text"
                  placeholder={t("buscar_pais")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 pl-9 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                  style={{
                    boxShadow: "0 2px 8px -2px rgba(8, 217, 189, 0.15)",
                  }}
                />
                <svg
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
              {filteredCountries
                .filter((country) => country.spanishName !== "Afganistán")
                .map((country, index) => (
                  <button
                    key={country.cca2}
                    onClick={() => selectCountry(country)}
                    className={`w-full flex items-center gap-4 px-4 py-3 hover:bg-gradient-to-r hover:from-teal-50 hover:to-blue-50 transition-all duration-150 text-left border-b border-gray-50 last:border-b-0 group/item ${
                      internalCountry?.cca2 === country.cca2
                        ? "bg-gradient-to-r from-teal-100 to-blue-100 text-teal-800"
                        : "text-gray-700 hover:text-teal-700"
                    }`}
                    style={{
                      animationDelay: `${index * 20}ms`,
                    }}
                  >
                    <span className="text-2xl group-hover/item:scale-110 transition-transform duration-200">
                      <Image
                        src={country.flags?.svg || country.flags?.png}
                        className="top-1.5 relative mr-2"
                        width={20}
                        height={20}
                        alt="flag"
                      />
                    </span>
                    <span className="font-medium group-hover/item:translate-x-1 transition-transform duration-200">
                      {country.spanishName}
                    </span>
                    {internalCountry?.cca2 === country.cca2 && (
                      <div className="ml-auto">
                        <svg
                          className="w-5 h-5 text-teal-600"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    )}
                  </button>
                ))}

              {filteredCountries.length === 0 && (
                <div className="px-4 py-8 text-gray-500 text-center">
                  <div className="mb-2">
                    <svg
                      className="w-8 h-8 mx-auto text-gray-300"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  </div>
                  <p className="text-sm font-medium">{t("no_hay_paises")}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {isDropdownOpen && (
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsDropdownOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
