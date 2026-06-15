"use client";
import React, { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useIsClient } from "@/app/hooks/isClient";
import Image from "next/image";
import { useTranslation } from "@/app/hooks/useTranslation";
import {
  fetchCountriesWithSpanish,
  type CountryWithSpanish,
} from "@/components/countryList";

type Props = {
  selectedCountry: string | null;
  setSelectedCountry: (country: string) => void;
  isMobile?: boolean;
};

type Country = CountryWithSpanish;

const getCountryLabel = (value: unknown) => {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  const obj = value as { spanishName?: string; name?: { common?: string } };
  return obj.spanishName || obj.name?.common || "";
};

export default function PaisPasaporte({
  selectedCountry,
  setSelectedCountry,
  isMobile = false,
}: Props) {
  const [countries, setCountries] = useState<Country[]>([]);
  const { t } = useTranslation();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const isClient = useIsClient();

  useEffect(() => {
    fetchCountries();
  }, []);

  useEffect(() => {
    if (countries.length > 0 && isClient) {
      const savedCountry = localStorage.getItem("travelgrin_country_selected");
      if (savedCountry) {
        try {
          const countryData = JSON.parse(savedCountry);
          const label = getCountryLabel(countryData?.country ?? countryData);
          if (label) setSelectedCountry(label);
        } catch (error) {
          console.error("Error parsing saved country:", error);
        }
      }
    }
  }, [countries, isClient, setSelectedCountry]);

  const fetchCountries = async () => {
    try {
      const sortedCountries = await fetchCountriesWithSpanish();
      setCountries(sortedCountries);
    } catch (error) {
      console.error("Error fetching countries:", error);
    }
  };

  const filteredCountries = countries.filter(
    (country) =>
      country?.spanishName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      country?.name?.common?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const selectCountry = (country: Country) => {
    setSelectedCountry(country.spanishName);
    setIsDropdownOpen(false);
    setSearchTerm("");

    if (isClient) {
      localStorage.setItem(
        "travelgrin_country_selected",
        JSON.stringify({
          country: country.spanishName,
          timestamp: Date.now(),
        }),
      );
    }
  };

  const selectedCountryObj = countries.find(
    (country) =>
      country.spanishName === selectedCountry || country.name?.common === selectedCountry,
  );
  const selectedFlag = selectedCountryObj?.flags?.svg || selectedCountryObj?.flags?.png || "";

  return (
    <div className="relative">
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className={`flex items-center justify-between px-4 ${isMobile ? "py-2" : "py-3"} border-2 border-white/30 rounded-xl bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-all duration-300 text-white ${isMobile ? "w-[12rem] flex flex-row" : "w-full"}  md:min-w-[200px] h-[3.27rem]`}
      >
        <div className="flex items-center justify-center">
          <Image
            src="/pasaporte-transparente.png"
            className="w-[4rem] h-[2rem] relative -top-0 mr-2 right-5 object-fit"
            width={100}
            height={100}
            alt="icon pasaporte"
          />
          <div
            className={`relative right-10 ${isMobile ? "flex flex-row items-center" : "flex flex-row items-center"}`}
          >
            {selectedCountryObj && selectedFlag ? (
              <span className="text-lg mr-2 relative -top-0 w-[1.3rem]">
                <Image src={selectedFlag} width={20} height={20} alt="flag" />
              </span>
            ) : null}
            <span className="text-sm font-medium">
              {selectedCountry ? selectedCountry : t("pais_de_tu_pasaporte")}
            </span>
          </div>
        </div>

        <ChevronDown
          className={`w-4 h-4 text-white/70 transition-transform duration-300 ${
            isDropdownOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isDropdownOpen && (
        <div className="z-99 absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl max-h-72 overflow-hidden">
          <div className="p-3 border-b border-gray-200">
            <input
              type="text"
              placeholder="Buscar pais..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm"
            />
          </div>

          <div className="max-h-48 overflow-y-auto">
            {filteredCountries
              .filter((country) => country.spanishName !== "Afganistan")
              .map((country) => (
                <button
                  key={country.cca2}
                  onClick={() => selectCountry(country)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-100 last:border-b-0"
                >
                  <Image
                    src={(country.flags?.svg || country.flags?.png) as string}
                    width={20}
                    height={20}
                    alt="flag"
                  />
                  <span className="text-gray-700 text-sm">{country.spanishName}</span>
                </button>
              ))}

            {filteredCountries.length === 0 && (
              <div className="px-4 py-6 text-gray-500 text-center text-sm">
                {t("no_hay_paises")}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
