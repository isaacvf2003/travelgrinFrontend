"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useSearchNavigation } from "./SearchNavigationContext";

export default function SortSelect() {
  const { t } = useTranslation();
  const { params, applySearchParams } = useSearchNavigation();
  const current = params.get("sort") ?? "relevance";
  const [selectedSort, setSelectedSort] = useState(current);
  const options = [
    { value: "relevance", label: t("relevancia") },
    { value: "priceAsc", label: t("precio_asc") },
    { value: "priceDesc", label: t("precio_desc") },
  ];

  useEffect(() => {
    setSelectedSort(current);
  }, [current]);

  return (
    <select
      value={selectedSort}
      onChange={(e) => {
        const value = e.target.value;
        setSelectedSort(value);
        applySearchParams((next) => {
          if (value && value !== "relevance") next.set("sort", value);
          else next.delete("sort");
          next.delete("page");
          next.delete("prestacionesPage");
        });
      }}
      className="rounded-lg border border-black/10 bg-white px-2 py-1 text-sm text-[#0B2B30] shadow-sm outline-none focus:ring-2 focus:ring-[#00A9C6]/30"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
