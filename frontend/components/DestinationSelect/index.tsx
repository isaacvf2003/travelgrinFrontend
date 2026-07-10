"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { ChevronDown, MapPin } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";

type CountryApi = {
  name: { common: string };
  cca2: string;
  translations?: { spa?: { common: string } };
  flags?: { svg?: string; png?: string };
};

type Country = CountryApi & { spanishName: string };
const EMPTY_ALLOWED_COUNTRIES: string[] = [];

type Props = {
  destinationCountry: string;
  setDestinationCountry: (country: string) => void;
  label: string;
  customClass?: string;
  showLabel?: boolean;
  labelStyle?: string;
  buttonClass?: string;
  isInModal?: boolean;
  textBuscarPais?: string;
  noHayPaises?: string;
  publishedOnly?: boolean;
  allowedCountries?: string[];
  error?: boolean;
};

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

export default function DestinationSelect({
  destinationCountry,
  setDestinationCountry,
  label,
  customClass = "",
  showLabel = true,
  labelStyle = "",
  buttonClass = "",
  isInModal = false,
  textBuscarPais = "",
  noHayPaises = "",
  publishedOnly = false,
  allowedCountries = EMPTY_ALLOWED_COUNTRIES,
  error = false,
}: Props) {
  const { t } = useTranslation();

  const [countries, setCountries] = useState<Country[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isClient, setIsClient] = useState(false);

  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const allowedCountrySignature = useMemo(
    () => (Array.isArray(allowedCountries) ? allowedCountries : []).map((entry) => String(entry ?? "").trim()).filter(Boolean).join("|"),
    [allowedCountries]
  );

  const allowedCountryKeys = useMemo(
    () =>
      new Set(
        allowedCountrySignature
          .split("|")
          .map((entry) => normalize(String(entry ?? "")))
          .filter(Boolean)
      ),
    [allowedCountrySignature]
  );

  useEffect(() => {
    setIsClient(true);
    (async () => {
      try {
        const [countriesRes, destinationsRes] = await Promise.all([
          fetch("/api/countries"),
          publishedOnly
            ? fetch("/api/publications?status=active&destinationsOnly=1", {
                cache: "no-store",
              })
            : Promise.resolve(null),
        ]);
        const countriesPayload = await countriesRes.json().catch(() => ({}));
        const data = (Array.isArray(countriesPayload?.items) ? countriesPayload.items : []) as CountryApi[];
        const destinationsPayload = destinationsRes
          ? await destinationsRes.json().catch(() => ({}))
          : { items: [] as string[] };
        const destinationKeys = new Set(
          (Array.isArray(destinationsPayload?.items) ? destinationsPayload.items : [])
            .map((entry: unknown) => normalize(String(entry ?? "")))
            .filter(Boolean)
        );

        const items: Country[] = data
          .map((c) => ({
            ...c,
            spanishName: c.translations?.spa?.common || c.name.common,
          }))
          .filter((country) => {
            if (allowedCountryKeys.size) {
              const isAllowed =
                allowedCountryKeys.has(normalize(country.spanishName)) ||
                allowedCountryKeys.has(normalize(country.name.common)) ||
                allowedCountryKeys.has(normalize(country.cca2));
              if (!isAllowed) return false;
            }
            if (!publishedOnly) return true;
            return (
              destinationKeys.has(normalize(country.spanishName)) ||
              destinationKeys.has(normalize(country.name.common)) ||
              destinationKeys.has(normalize(country.cca2))
            );
          })
          .sort((a, b) => a.spanishName.localeCompare(b.spanishName));

        setCountries(items);
      } catch (e) {
        console.error("Error fetching countries:", e);
      }
    })();
  }, [publishedOnly, allowedCountryKeys]);

  const selectedCountryObj = useMemo(() => {
    if (!destinationCountry) return null;
    const target = normalize(destinationCountry);
    return (
      countries.find((c) => normalize(c.spanishName) === target) ||
      countries.find((c) => normalize(c.name.common) === target) ||
      null
    );
  }, [countries, destinationCountry]);

  const filteredCountries = useMemo(() => {
    const term = normalize(searchTerm);
    if (!term) return countries;
    return countries.filter((c) => {
      const a = normalize(c.spanishName);
      const b = normalize(c.name.common);
      return a.includes(term) || b.includes(term);
    });
  }, [countries, searchTerm]);

  const selectCountry = (country: Country) => {
    setDestinationCountry(country.spanishName);
    setIsDropdownOpen(false);
    setSearchTerm("");
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
      setIsDropdownOpen(false);
    }
  };

  const handleButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDropdownOpen((v) => !v);
  };

  useEffect(() => {
    if (!isDropdownOpen) setSearchTerm("");
  }, [isDropdownOpen]);

    const hasValue = Boolean(destinationCountry);

    // si te pasan h-[3rem] (como en SearchBar), lo tratamos como modo compacto
    const hasCustomButtonSizing = Boolean(buttonClass && buttonClass.trim().length > 0);
    const compactMode = hasCustomButtonSizing;

    // ✅ Label arriba SOLO en modo NO compacto y SOLO si no hay valor
    const showTopLabel = Boolean(showLabel && !hasValue && !compactMode && !isInModal);

    // ✅ placeholder interno: si hay label arriba, adentro NO mostramos nada (para no duplicar)
    const innerPlaceholder = showTopLabel ? "" : label;

  const DropdownPortal = () => {
    const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

    const updatePosition = useCallback(() => {
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const dropdownHeight = 320;

      const spaceBelow = viewportHeight - rect.bottom;
      const showAbove = window.innerWidth >= 768 && spaceBelow < dropdownHeight && rect.top > dropdownHeight;

      setPos({
        top: showAbove ? rect.top - dropdownHeight - 8 : rect.bottom + 8,
        left: rect.left,
        width: rect.width,
      });
    }, []);

    useEffect(() => {
      if (!isDropdownOpen) return;
      updatePosition();
      const onMove = () => updatePosition();

      window.addEventListener("scroll", onMove, true);
      window.addEventListener("resize", onMove);

      return () => {
        window.removeEventListener("scroll", onMove, true);
        window.removeEventListener("resize", onMove);
      };
    }, [isDropdownOpen, updatePosition]);

    if (!isDropdownOpen || !isClient || !buttonRef.current) return null;

    return createPortal(
      <>
        <div className="fixed inset-0" style={{ zIndex: 9998 }} onClick={handleBackdropClick} />

        <div
          ref={dropdownRef}
          className="fixed overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl"
          style={{
            zIndex: 9999,
            top: pos.top,
            left: pos.left,
            width: pos.width,
            maxHeight: 320,
            boxShadow:
              "0 20px 40px -12px rgba(8, 217, 189, 0.25), 0 8px 24px -8px rgba(4, 181, 189, 0.2)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b border-gray-200 bg-gray-50 p-3">
            <div className="relative">
              <input
                type="text"
                placeholder={textBuscarPais || t("buscar_pais")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 pl-9 text-black focus:outline-none focus:ring-2 focus:ring-teal-500"
                autoFocus
              />
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
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

          <div className="max-h-60 overflow-y-auto" style={{ WebkitOverflowScrolling: "touch" }}>
            {filteredCountries
              .filter((c) => c.spanishName !== "Afganistán")
              .map((country) => {
                const isSelected =
                  selectedCountryObj?.cca2 && selectedCountryObj.cca2 === country.cca2;

                const flagSrc = country.flags?.svg || country.flags?.png || null;

                return (
                  <button
                    key={country.cca2}
                    type="button"
                    onClick={() => selectCountry(country)}
                    className={`flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3 text-left transition-all duration-150 last:border-b-0 hover:bg-gray-50 ${
                      isSelected ? "bg-teal-50 text-teal-800" : "text-gray-700 hover:text-teal-700"
                    }`}
                  >
                    {flagSrc ? <Image src={flagSrc} width={20} height={14} alt="flag" /> : null}

                    <span className="font-medium">{country.spanishName}</span>

                    {isSelected ? <span className="ml-auto text-teal-600">✓</span> : null}
                  </button>
                );
              })}

            {filteredCountries.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500">
                <p className="text-sm font-medium">{noHayPaises || t("no_hay_paises")}</p>
              </div>
            ) : null}
          </div>
        </div>
      </>,
      document.body
    );
  };

  const flagSelected = selectedCountryObj?.flags?.svg || selectedCountryObj?.flags?.png || null;
  const buttonTitle = destinationCountry || innerPlaceholder || label;

  return (
    // ✅ w-full para que el rectángulo ocupe TODO el ancho del wrapper (y quede igual al de categoría)
    <div className={`relative w-full ${customClass}`}>
      <MapPin
        className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500"
        style={{ zIndex: 20 }}
      />

      <button
        ref={buttonRef}
        type="button"
        onClick={handleButtonClick}
        title={buttonTitle}
        className={`group relative w-full rounded-lg border bg-white text-left shadow-sm transition-all duration-200 hover:shadow-md ${
          error ? "border-rose-300 ring-2 ring-rose-100" : "border-gray-200 hover:border-teal-200"
        } ${
          !isInModal ? "pl-10" : "pl-12 pr-12"
        } ${buttonClass} ${hasCustomButtonSizing ? "" : "p-4 pt-6"}`}
        style={{
          boxShadow:
            "0 8px 32px -12px rgba(8, 217, 189, 0.3), 0 4px 16px -6px rgba(4, 181, 189, 0.25), 0 2px 8px -3px rgba(0, 154, 188, 0.2)",
        }}
      >
        {/* ✅ SOLO aparece cuando NO hay país seleccionado */}
        {showTopLabel ? (
          <span className={`absolute left-5 top-3 text-xs text-gray-500 transition-all ${labelStyle}`}>
            {label}
          </span>
        ) : null}

        <div className="flex items-center gap-3">
          {flagSelected ? <Image src={flagSelected} width={20} height={14} alt="flag" /> : null}

          <span
            title={buttonTitle}
            className={`block w-full truncate whitespace-nowrap ${
              destinationCountry ? "text-gray-700" : "text-gray-500 text-sm"
            }`}
          >
            {/* ✅ Cuando no hay país: muestra label como placeholder
                ✅ Cuando hay país: muestra el país (y NO muestra label arriba) */}
            {destinationCountry ? destinationCountry : innerPlaceholder}
          </span>
        </div>

        <ChevronDown
          className={`absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 transition-all duration-200 group-hover:text-teal-500 ${
            isDropdownOpen ? "rotate-180 text-teal-500" : ""
          }`}
        />
      </button>

      <DropdownPortal />
    </div>
  );
}
