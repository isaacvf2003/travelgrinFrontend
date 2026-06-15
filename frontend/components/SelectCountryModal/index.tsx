"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";
import Image from "next/image";
import { useIsClient } from "@/app/hooks/isClient";
import { LockClosedIcon } from "../ModalDemandante";
import SelectCountry from "../SelectCountry";
import ButtonSolid from "../ButtonSolid";
import { useTranslation } from "@/app/hooks/useTranslation";

type Props = {
  selectedCountry: string | null;
  setSelectedCountry: (country: string) => void;
};

type CountryApi = {
  name?: { common?: string };
  cca2?: string;
  translations?: { spa?: { common?: string } };
  flags?: { svg?: string; png?: string };
};

type Country = CountryApi & { spanishName: string };

const CountrySelectionModal = ({
  selectedCountry,
  setSelectedCountry,
}: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [countries, setCountries] = useState<Country[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [countryError, setCountryError] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const isClient = useIsClient();
  const { t, locale } = useTranslation();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
//
  // Bloquear scroll del body y configurar viewport
  useEffect(() => {
    if (isOpen) {
      // Guardar posición actual del scroll
      const scrollY = window.scrollY;

      // Aplicar estilos para prevenir scroll y movimiento
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.width = "100%";
      document.body.style.height = "100vh";
      document.body.style.overflow = "hidden";

      // Prevenir zoom en dispositivos móviles
      const viewport = document.querySelector("meta[name=viewport]");
      if (viewport && window.innerWidth <= 768) {
        viewport.setAttribute(
          "content",
          "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0, viewport-fit=cover"
        );
      }

      return () => {
        // Restaurar estilos del body
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.left = "";
        document.body.style.right = "";
        document.body.style.width = "";
        document.body.style.height = "";
        document.body.style.overflow = "";

        // Restaurar scroll
        window.scrollTo(0, scrollY);

        // Restaurar viewport
        if (viewport && window.innerWidth <= 768) {
          viewport.setAttribute(
            "content",
            "width=device-width, initial-scale=1.0, viewport-fit=cover"
          );
        }
      };
    }
  }, [isOpen]);

  // Detectar teclado virtual usando Visual Viewport API
  useEffect(() => {
    if (!isClient || !isOpen) return;

    const initialViewportHeight = window.innerHeight;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    const handleViewportChange = () => {
      if (window.visualViewport) {
        const currentHeight = window.visualViewport.height;
        const heightDifference = initialViewportHeight - currentHeight;

        // Considerar que hay teclado si la diferencia es significativa
        const keyboardIsOpen = heightDifference > 150;
        setIsKeyboardOpen(keyboardIsOpen);

        // Si hay teclado y el input está enfocado, posicionar el dropdown
        if (keyboardIsOpen && inputFocused && dropdownRef.current) {
          setTimeout(() => {
            const dropdown = dropdownRef.current;
            const availableHeight = window.visualViewport.height;
            const inputRect = searchInputRef.current?.getBoundingClientRect();

            if (inputRect) {
              // En iOS, siempre mostrar hacia abajo a menos que no haya espacio
              const spaceBelow = availableHeight - inputRect.bottom - 20;
              const spaceAbove = inputRect.top - 20;

              // Definir alturas mínimas y máximas
              const minDropdownHeight = 200; // Reducido para iOS
              const maxDropdownHeight = 300;

              // En iOS, preferir siempre hacia abajo
              if (isIOS) {
                if (spaceBelow >= 150) {
                  // Mínimo más bajo para iOS
                  const optimalHeight = Math.min(
                    maxDropdownHeight,
                    Math.max(minDropdownHeight, spaceBelow)
                  );
                  dropdown.style.maxHeight = `${optimalHeight}px`;
                  dropdown.style.minHeight = `${Math.min(
                    200,
                    optimalHeight
                  )}px`;
                  dropdown.style.top = "100%";
                  dropdown.style.bottom = "auto";
                } else {
                  // Si no hay espacio abajo, usar lo que haya disponible
                  dropdown.style.maxHeight = `${spaceBelow - 10}px`;
                  dropdown.style.minHeight = `${Math.min(
                    150,
                    spaceBelow - 10
                  )}px`;
                  dropdown.style.top = "100%";
                  dropdown.style.bottom = "auto";
                }
              } else {
                // Android: lógica original
                if (spaceBelow >= minDropdownHeight) {
                  const optimalHeight = Math.min(maxDropdownHeight, spaceBelow);
                  dropdown.style.maxHeight = `${optimalHeight}px`;
                  dropdown.style.minHeight = `${minDropdownHeight}px`;
                  dropdown.style.top = "100%";
                  dropdown.style.bottom = "auto";
                } else if (spaceAbove >= minDropdownHeight) {
                  const optimalHeight = Math.min(maxDropdownHeight, spaceAbove);
                  dropdown.style.maxHeight = `${optimalHeight}px`;
                  dropdown.style.minHeight = `${minDropdownHeight}px`;
                  dropdown.style.top = "auto";
                  dropdown.style.bottom = "100%";
                } else {
                  const maxAvailableSpace = Math.max(spaceBelow, spaceAbove);
                  dropdown.style.maxHeight = `${maxAvailableSpace - 10}px`;
                  dropdown.style.minHeight = `${Math.min(
                    minDropdownHeight,
                    maxAvailableSpace - 10
                  )}px`;

                  if (spaceBelow >= spaceAbove) {
                    dropdown.style.top = "100%";
                    dropdown.style.bottom = "auto";
                  } else {
                    dropdown.style.top = "auto";
                    dropdown.style.bottom = "100%";
                  }
                }
              }
            }
          }, 150);
        }
      }
    };

    // Usar Visual Viewport API si está disponible
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", handleViewportChange);
      return () => {
        if (window.visualViewport) {
          window.visualViewport.removeEventListener(
            "resize",
            handleViewportChange
          );
        }
      };
    } else {
      // Fallback para navegadores sin Visual Viewport API
      const handleResize = () => {
        const currentHeight = window.innerHeight;
        const heightDifference = initialViewportHeight - currentHeight;
        const keyboardIsOpen = heightDifference > 150;

        setIsKeyboardOpen(keyboardIsOpen);
      };

      window.addEventListener("resize", handleResize);
      return () => {
        window.removeEventListener("resize", handleResize);
      };
    }
  }, [isClient, isOpen, inputFocused]);

  // Verificar si el usuario ya completó la selección
  const openPassportModal = () => {
    setIsOpen(true);
    setTimeout(() => {
      setShowModal(true);
    }, 50);
    fetchCountries();
  };

  useEffect(() => {
    if (!isClient) return;
    const hasCompletedSelection = localStorage.getItem(
      "travelgrin_country_selected"
    );
    if (!hasCompletedSelection) openPassportModal();
  }, [isClient]);

  useEffect(() => {
    if (!isClient) return;
    const onOpen = () => openPassportModal();
    window.addEventListener("tg-open-country-modal", onOpen);
    return () => window.removeEventListener("tg-open-country-modal", onOpen);
  }, [isClient]);

  // Fetch países de la API gratuita
  const fetchCountries = async () => {
    try {
      const response = await fetch(
        "/api/countries"
      );
      const payload = await response.json().catch(() => ({}));
      const data = (Array.isArray(payload?.items) ? payload.items : []) as CountryApi[];

      const countriesWithSpanish: Country[] = data.map((country: CountryApi) => ({
        ...country,
        spanishName: country.translations?.spa?.common || country.name?.common || "",
      }));

      const sortedCountries = countriesWithSpanish.sort((a: Country, b: Country) =>
        a.spanishName.localeCompare(b.spanishName)
      );

      setCountries(sortedCountries);
    } catch (error) {
      console.error("Error fetching countries:", error);
    }
  };

  const filteredCountries = countries.filter(
    (country) =>
      country?.spanishName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      country?.name?.common?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const closeAndSave = () => {
    setShowModal(false);
    if (isClient) {
      setTimeout(() => {
        const effectiveCountry = selectedCountry || "";
        if (effectiveCountry) {
          localStorage.setItem("travelgrin_country_selected", JSON.stringify({ country: effectiveCountry, timestamp: Date.now() }));
        }
        setIsOpen(false);
      }, 300);
    }
  };

  const handleContinue = () => {
    if (!selectedCountry) {
      setCountryError(true);
      return;
    }
    closeAndSave();
  };

  const selectCountry = (country: { spanishName?: string; name?: { common?: string } }) => {
    const label = country.spanishName || country.name?.common || "";
    if (!label) return;
    setSelectedCountry(label);
    setCountryError(false);
    setIsDropdownOpen(false);
    setSearchTerm("");
    setInputFocused(false);

    // Cerrar teclado
    if (searchInputRef.current) {
      searchInputRef.current.blur();
    }
  };

  const handleDropdownToggle = () => {
    const newDropdownState = !isDropdownOpen;
    setIsDropdownOpen(newDropdownState);

    if (newDropdownState) {
      setSearchTerm("");
      // Enfocar el input automáticamente cuando se abre
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 100);
    } else {
      setInputFocused(false);
      if (searchInputRef.current) {
        searchInputRef.current.blur();
      }
    }
  };

  const handleInputFocus = () => {
    setInputFocused(true);
  };

  const handleInputBlur = () => {
    // Delay para permitir selección de país
    setTimeout(() => {
      setInputFocused(false);
    }, 200);
  };

  if (!isOpen) return null;
  const modalLabelsByLocale: Record<string, {
    skip: string;
    selectCountry: string;
    searchCountry: string;
    noCountries: string;
    countryRequired: string;
  }> = {
    es: {
      skip: "Omitir por ahora",
      selectCountry: "Selecciona un país",
      searchCountry: "Buscar país...",
      noCountries: "No se encontraron países",
      countryRequired: "Elegí tu país de pasaporte para continuar.",
    },
    en: {
      skip: "Skip for now",
      selectCountry: "Select a country",
      searchCountry: "Search country...",
      noCountries: "No countries found",
      countryRequired: "Choose your passport country to continue.",
    },
    pt: {
      skip: "Pular por agora",
      selectCountry: "Selecione um país",
      searchCountry: "Buscar país...",
      noCountries: "Nenhum país encontrado",
      countryRequired: "Escolha o país do seu passaporte para continuar.",
    },
    it: {
      skip: "Salta per ora",
      selectCountry: "Seleziona un paese",
      searchCountry: "Cerca paese...",
      noCountries: "Nessun paese trovato",
      countryRequired: "Scegli il paese del tuo passaporto per continuare.",
    },
  };
  const modalLabels = modalLabelsByLocale[locale] ?? modalLabelsByLocale.es;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) closeAndSave(); }}
      className={`fixed inset-0 bg-black/60 flex items-start justify-center pt-4 pb-4 px-4 z-[9999] transition-opacity duration-300 ${
        showModal ? "opacity-100" : "opacity-0"
      }`}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        height: "100vh",
        width: "100vw",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "16px",
        paddingBottom: "16px",
        paddingLeft: "16px",
        paddingRight: "16px",
      }}
    >
      {/* Modal Content */}
      <div
        ref={modalRef}
        className={`bg-white rounded-2xl p-8 shadow-2xl w-full max-w-md transition-all duration-500 ease-out transform ${
          showModal
            ? "translate-y-0 scale-100 opacity-100"
            : "-translate-y-12 scale-95 opacity-0"
        }`}
        style={{
          WebkitFontSmoothing: "antialiased",
          MozOsxFontSmoothing: "grayscale",
          textRendering: "optimizeLegibility",
          backgroundColor: "#ffffff",
          maxHeight: "calc(100vh - 32px)",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          overscrollBehavior: "contain",
          width: "100%",
          maxWidth: "400px",
          marginTop: "0px",
        }}
      >
        {/* Logo y título */}
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-row justify-start">
            <SelectCountry isBorderBlack={true} isWelcome />
          </div>
          <button type="button" onClick={closeAndSave} className="rounded-full border border-[#00A9C6]/30 bg-[#00A9C6]/10 px-4 py-1.5 text-sm font-semibold text-[#0B5E6B] hover:bg-[#00A9C6]/20">{modalLabels.skip}</button>
        </div>
        <div className="text-center mb-8">
          <div className="mb-6 flex justify-center">
            <Image
              alt="logo verde travel grin"
              width={300}
              height={200}
              src="/logo-green.png"
            />
          </div>

          <h2
            className="md:text-[28px] text-black mb-2"
            style={{
              WebkitFontSmoothing: "antialiased",
              MozOsxFontSmoothing: "grayscale",
              color: "#000000",
              textRendering: "optimizeLegibility",
            }}
          >
            {t("bienvenido")}
          </h2>
          <p
            className="text-black text-sm md:text-[px] leading-relaxed whitespace-pre-line"
            style={{
              WebkitFontSmoothing: "antialiased",
              MozOsxFontSmoothing: "grayscale",
              color: "#000000",
              textRendering: "optimizeLegibility",
            }}
          >
            {t("cuentanos_el_pais")}
          </p>
        </div>

        {/* Selector de país */}
        <div className="mb-6 relative">
          <Image
            src={"/pasaporte-transparente.png"}
            className="w-[3rem] h-[2rem] relative top-12 ml-2 z-10"
            width={100}
            height={100}
            alt="icon pasaporte"
          />

          <button
            onClick={handleDropdownToggle}
            className="w-full flex items-center justify-between p-4 pl-12 border border-gray-300 rounded-lg hover:border-teal-500 transition-colors bg-white relative"
            style={{
              backgroundColor: "#ffffff",
              borderColor: "#d1d5db",
              WebkitFontSmoothing: "antialiased",
              MozOsxFontSmoothing: "grayscale",
            }}
          >
            <div className="flex items-center gap-3">
              <span
                className="text-gray-700 relative top-1"
                style={{
                  WebkitFontSmoothing: "antialiased",
                  MozOsxFontSmoothing: "grayscale",
                  color: "#374151",
                  textRendering: "optimizeLegibility",
                }}
              >
                {selectedCountry || modalLabels.selectCountry}
              </span>
            </div>
            <ChevronDown
              className={`w-5 h-5 text-gray-400 transition-transform ${
                isDropdownOpen ? "rotate-180" : ""
              }`}
              style={{ color: "#9ca3af" }}
            />
          </button>

          {/* Dropdown con posición fija cuando hay teclado */}
          {isDropdownOpen && (
            <div
              ref={dropdownRef}
              className="absolute left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg overflow-hidden"
              style={{
                backgroundColor: "#ffffff",
                borderColor: "#d1d5db",
                WebkitFontSmoothing: "antialiased",
                MozOsxFontSmoothing: "grayscale",
                zIndex: 10000,
                // Forzar posición hacia abajo en iOS, mantener lógica original en Android
                top: "100%",
                bottom: "auto",
                // Altura adaptativa por dispositivo
                minHeight: /iPad|iPhone|iPod/.test(navigator.userAgent)
                  ? isKeyboardOpen
                    ? "200px"
                    : "280px"
                  : isKeyboardOpen
                  ? "280px"
                  : "320px",
                maxHeight: /iPad|iPhone|iPod/.test(navigator.userAgent)
                  ? isKeyboardOpen
                    ? "300px"
                    : "400px"
                  : isKeyboardOpen
                  ? "350px"
                  : "400px",
              }}
            >
              {/* Input de búsqueda */}
              <div
                className="p-3 border-b border-gray-200"
                style={{ borderBottomColor: "#e5e7eb" }}
              >
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder={modalLabels.searchCountry}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  style={{
                    WebkitFontSmoothing: "antialiased",
                    MozOsxFontSmoothing: "grayscale",
                    textRendering: "optimizeLegibility",
                    color: "#111827",
                    backgroundColor: "#ffffff",
                    borderColor: "#d1d5db",
                    WebkitTextFillColor: "#111827",
                    opacity: "1",
                    fontSize: "16px", // Prevenir zoom en iOS
                  }}
                />

                {/* Estilos para placeholder */}
                <style jsx>{`
                  input::placeholder {
                    color: #6b7280 !important;
                    opacity: 1 !important;
                    -webkit-text-fill-color: #6b7280 !important;
                    -webkit-font-smoothing: antialiased !important;
                    -moz-osx-font-smoothing: grayscale !important;
                  }

                  input::-webkit-input-placeholder {
                    color: #6b7280 !important;
                    opacity: 1 !important;
                    -webkit-text-fill-color: #6b7280 !important;
                    -webkit-font-smoothing: antialiased !important;
                  }

                  input::-moz-placeholder {
                    color: #6b7280 !important;
                    opacity: 1 !important;
                    -moz-osx-font-smoothing: grayscale !important;
                  }

                  input:-ms-input-placeholder {
                    color: #6b7280 !important;
                    opacity: 1 !important;
                  }
                `}</style>
              </div>

              {/* Lista de países */}
              <div
                className="overflow-y-auto"
                style={{
                  // Altura adaptativa por dispositivo
                  minHeight: /iPad|iPhone|iPod/.test(navigator.userAgent)
                    ? isKeyboardOpen
                      ? "150px"
                      : "200px"
                    : isKeyboardOpen
                    ? "200px"
                    : "240px",
                  maxHeight: /iPad|iPhone|iPod/.test(navigator.userAgent)
                    ? isKeyboardOpen
                      ? "250px"
                      : "320px"
                    : isKeyboardOpen
                    ? "280px"
                    : "320px",
                  overflowY: "auto",
                  WebkitOverflowScrolling: "touch",
                }}
              >
                {filteredCountries
                  .filter((country) => country.spanishName !== "Afganistán")
                  .map((country) => (
                    <button
                      key={country.cca2}
                      onClick={() => selectCountry(country)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                      style={{
                        WebkitFontSmoothing: "antialiased",
                        MozOsxFontSmoothing: "grayscale",
                        textRendering: "optimizeLegibility",
                      }}
                    >
                      <span className="text-xl">
                        <Image
                          src={country.flags?.svg || country.flags?.png}
                          className="top-0 relative mr-2"
                          width={20}
                          height={20}
                          alt="flag"
                        />
                      </span>
                      <span
                        className="text-gray-700"
                        style={{
                          WebkitFontSmoothing: "antialiased",
                          MozOsxFontSmoothing: "grayscale",
                          color: "#374151",
                          textRendering: "optimizeLegibility",
                        }}
                      >
                        {country.spanishName}
                      </span>
                    </button>
                  ))}

                {filteredCountries.length === 0 && (
                  <div
                    className="px-4 py-3 text-gray-500 text-center"
                    style={{
                      WebkitFontSmoothing: "antialiased",
                      MozOsxFontSmoothing: "grayscale",
                      color: "#6b7280",
                      textRendering: "optimizeLegibility",
                    }}
                  >
                    {modalLabels.noCountries}
                  </div>
                )}
              </div>
            </div>
          )}
          {countryError ? <p className="mt-2 text-sm font-medium text-red-600">{modalLabels.countryRequired}</p> : null}
        </div>


        <ButtonSolid
          onSubmit={handleContinue}
          title={t("continuar")}
          hexButton="#15A4AE"
          hasSubmit
          disabled={false}
          classStyle={`w-full py-4 rounded-lg font-medium transition-all ${
            "bg-teal-500 hover:bg-teal-600 text-white shadow-md hover:shadow-lg"
          }`}
        />

        {/* Sección de privacidad */}
        <div
          className="my-4 flex flex-row items-center justify-center"
          style={{
            WebkitFontSmoothing: "antialiased",
            MozOsxFontSmoothing: "grayscale",
            textRendering: "optimizeLegibility",
            opacity: "1",
            WebkitTextFillColor: "#000000",
            color: "#000000",
            mixBlendMode: "normal",
            WebkitMixBlendMode: "normal",
          }}
        >
          <LockClosedIcon
            className="inline-block h-[1.7rem] mr-2"
            style={{
              color: "#000000",
              fill: "#000000",
              opacity: "1",
              WebkitTextFillColor: "#000000",
            }}
          />
          <p
            className="text-[13px] whitespace-pre-line"
            style={{
              color: "#000000 !important",
              WebkitTextFillColor: "#000000",
              opacity: "1",
              backgroundColor: "transparent",
              WebkitFontSmoothing: "antialiased",
              MozOsxFontSmoothing: "grayscale",
              textRendering: "optimizeLegibility",
              fontSize: "13px",
              lineHeight: "1.4",
            }}
          >
            {t("este_dato_es")}
          </p>
        </div>
      </div>
    </div>
  );
};

export default CountrySelectionModal;
//trigger
