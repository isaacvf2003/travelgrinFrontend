"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { Loader2, Search, X } from "lucide-react";
import { useSearchNavigation } from "./SearchNavigationContext";

type SearchEntry = [string, string | string[] | undefined];

export default function SearchForm({
  q,
  preservedEntries,
}: {
  q: string;
  preservedEntries: SearchEntry[];
}) {
  const { t, locale } = useTranslation();
  const { params, applySearchParams, isNavigating } = useSearchNavigation();
  const [inputValue, setInputValue] = useState(q || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInputValue(q || "");
    setIsSubmitting(false);
  }, [q, params]);

  const placeholderByLocale: Record<string, string> = {
    es: "Búsqueda inteligente con IA",
    en: "Smart AI search",
    pt: "Busca inteligente com IA",
    it: "Ricerca intelligente con IA",
  };

  const searchingLabelByLocale: Record<string, string> = {
    es: "Buscando...",
    en: "Searching...",
    pt: "Buscando...",
    it: "Ricerca in corso...",
  };

  const placeholderText = isSubmitting || isNavigating
    ? (searchingLabelByLocale[locale] ?? searchingLabelByLocale.es)
    : (placeholderByLocale[locale] ?? placeholderByLocale.es);

  const performSearch = (queryText: string) => {
    const rawQ = queryText.trim();
    setIsSubmitting(true);
    applySearchParams((next) => {
      if (rawQ) next.set("q", rawQ);
      else next.delete("q");
      next.delete("page");
      next.delete("prestacionesPage");
    });
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    performSearch(inputValue);
  };

  const handleClear = () => {
    setInputValue("");
    if (inputRef.current) inputRef.current.value = "";
    performSearch("");
  };

  return (
    <div className="w-full">
      <form
        onSubmit={onSubmit}
        className="group relative flex items-center gap-2.5 rounded-2xl border border-[#14A7B8]/25 bg-gradient-to-r from-white via-[#F8FDFF] to-white px-3.5 py-2.5 shadow-[0_8px_30px_rgba(20,167,184,0.08)] transition-all duration-300 focus-within:border-[#14A7B8] focus-within:shadow-[0_12px_35px_rgba(20,167,184,0.16)]"
      >
        {preservedEntries.map(([key, value]) => {
          if (key === "q") return null;
          if (Array.isArray(value)) {
            return value
              .filter(Boolean)
              .map((v, idx) => <input key={`${key}-${idx}`} type="hidden" name={key} value={v} />);
          }
          if (typeof value === "string" && value) {
            return <input key={key} type="hidden" name={key} value={value} />;
          }
          return null;
        })}

        <div className="flex items-center text-[#14A7B8]">
          {isSubmitting || isNavigating ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Search className="h-5 w-5" />
          )}
        </div>

        <input
          ref={inputRef}
          name="q"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={placeholderText}
          className="w-full bg-transparent text-[14px] md:text-[15px] font-normal text-slate-800 outline-none placeholder:text-slate-400"
        />

        {inputValue ? (
          <button
            type="button"
            onClick={handleClear}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition"
            title="Limpiar búsqueda"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}

        <button
          type="submit"
          className="hidden sm:inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#14A7B8] to-[#128B99] px-4 py-1.5 text-xs font-semibold text-white shadow-md hover:from-[#128B99] hover:to-[#0F7582] transition-all transform hover:scale-[1.02] active:scale-[0.98]"
        >
          {t("buscar")}
        </button>
      </form>
    </div>
  );
}
