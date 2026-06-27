"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type CountryContextType = {
  selectedCountry: string; // label, e.g. "Argentina"
  setSelectedCountry: (country: string) => void;
  isCountryHydrated: boolean;

  isOpenModal: boolean;
  setIsOpenModal: (v: boolean) => void;

  isOpenModalOferente: boolean;
  setIsOpenModalOferente: (v: boolean) => void;

  isOpenModalDemandante: boolean;
  setIsOpenModalDemandante: (v: boolean) => void;
};

const CountryContext = createContext<CountryContextType | null>(null);

export const CountryProvider = ({ children }: { children: React.ReactNode }) => {
  const [selectedCountry, _setSelectedCountry] = useState<string>("");
  const [isCountryHydrated, setIsCountryHydrated] = useState(false);
  const [isOpenModal, setIsOpenModal] = useState(false);
  const [isOpenModalOferente, setIsOpenModalOferente] = useState(false);
  const [isOpenModalDemandante, setIsOpenModalDemandante] = useState(false);

  const trackPassportVisit = (country: string, source: string) => {
    const normalized = String(country || "").trim();
    if (!normalized) return;
    try {
      const sessionKey = `tg_country_visit_logged:${normalized.toLowerCase()}`;
      if (window.sessionStorage.getItem(sessionKey)) return;
      window.sessionStorage.setItem(sessionKey, "1");
    } catch {}
    fetch("/api/passport-selections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ country: normalized, source }),
      keepalive: true,
    }).catch(() => null);
  };

  // Load saved country (client-only)
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("tg_country");
      if (saved) {
        _setSelectedCountry(saved);
        trackPassportVisit(saved, "country-provider-hydration");
        setIsCountryHydrated(true);
        return;
      }
      const legacy = window.localStorage.getItem("travelgrin_country_selected");
      if (!legacy) {
        setIsCountryHydrated(true);
        return;
      }
      const parsed = JSON.parse(legacy);
      if (typeof parsed === "string") {
        _setSelectedCountry(parsed);
        trackPassportVisit(parsed, "country-provider-legacy");
        setIsCountryHydrated(true);
        return;
      }
      const value =
        parsed?.country?.spanishName ||
        parsed?.country?.name?.common ||
        parsed?.country ||
        parsed?.originCountry?.spanishName ||
        parsed?.originCountry?.name?.common ||
        parsed?.spanishName ||
        parsed?.name?.common ||
        "";
      if (value) {
        _setSelectedCountry(String(value));
        trackPassportVisit(String(value), "country-provider-legacy");
      }
    } catch {}
    setIsCountryHydrated(true);
  }, []);

  const setSelectedCountry = (country: string) => {
    const normalized = String(country || "");
    _setSelectedCountry(normalized);
    try {
      window.localStorage.setItem("tg_country", normalized);
    } catch {}
    if (!normalized || normalized === selectedCountry) return;
    trackPassportVisit(normalized, "country-provider");
  };

  return (
    <CountryContext.Provider
      value={{
        selectedCountry,
        setSelectedCountry,
        isCountryHydrated,
        isOpenModal,
        setIsOpenModal,
        isOpenModalOferente,
        setIsOpenModalOferente,
        isOpenModalDemandante,
        setIsOpenModalDemandante,
      }}
    >
      {children}
    </CountryContext.Provider>
  );
};

export const useCountry = () => {
  const ctx = useContext(CountryContext);
  if (!ctx) throw new Error("useCountry must be used within a CountryProvider");
  return ctx;
};
