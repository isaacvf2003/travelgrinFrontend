"use client";

import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { Loader2, Search } from "lucide-react";
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const searchingLabel =
    locale === "en"
      ? "Searching..."
      : locale === "pt"
        ? "Buscando..."
        : locale === "it"
          ? "Ricerca in corso..."
          : "Buscando...";

  useEffect(() => {
    setIsSubmitting(false);
  }, [params]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const rawQ = String(formData.get("q") ?? "").trim();
    setIsSubmitting(true);
    applySearchParams((next) => {
      if (rawQ) next.set("q", rawQ);
      else next.delete("q");
      next.delete("page");
      next.delete("prestacionesPage");
    });
  };

  return (
    <form
      onSubmit={onSubmit}
      className="flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 shadow-[0_8px_30px_rgba(0,0,0,0.06)]"
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

      <span className="text-black/40">
        {isSubmitting || isNavigating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
      </span>
      <input
        name="q"
        defaultValue={q}
        onChange={() => setIsSubmitting(false)}
        placeholder={isSubmitting || isNavigating ? searchingLabel : t("buscar")}
        className="w-full bg-transparent text-sm outline-none placeholder:text-black/40"
      />
    </form>
  );
}
