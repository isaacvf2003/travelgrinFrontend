"use client";

import { useEffect, useState } from "react";

import type { Category, FilterGroup } from "@/app/lib/types";
import Filters from "./Filters";

export default function MobileFiltersDrawer({
  categories,
  filterGroups,
}: {
  categories: Category[];
  filterGroups: FilterGroup[];
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      {/* Botón flotante SOLO mobile */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-[120] inline-flex items-center gap-2 rounded-full bg-[#00A9C6] px-4 py-3 text-sm font-semibold text-white shadow-lg md:hidden"
      >
        <span className="text-base">⚙</span>
        Filtros
      </button>

      {open ? (
        <div className="fixed inset-0 z-[9999] isolate md:hidden">
          {/* backdrop */}
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => setOpen(false)}
            className="absolute inset-0 z-[9998] bg-black/50"
          />

          {/* drawer */}
          <div className="absolute bottom-0 left-0 right-0 z-[10000]  rounded-t-2xl bg-white p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-base font-semibold text-[#0B2B30]">Filtros</div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-[#0B2B30]"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            <Filters categories={categories} filterGroups={filterGroups} />
          </div>
        </div>
      ) : null}
    </>
  );
}
