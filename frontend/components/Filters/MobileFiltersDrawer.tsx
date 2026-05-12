"use client";

import React, { useEffect, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";

type Props = {
  title?: string;
  children: React.ReactNode;
};

export default function MobileFiltersDrawer({ title = "Filtros", children }: Props) {
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
      {/* ✅ Botón flotante SOLO móvil */}
      <button
        className="md:hidden fixed bottom-5 right-5 z-[9999] w-14 h-14 rounded-full bg-teal-600 text-white shadow-xl flex items-center justify-center active:scale-95 transition"
        onClick={() => setOpen(true)}
        aria-label="Abrir filtros"
      >
        <SlidersHorizontal className="w-6 h-6" />
      </button>

      {/* Overlay */}
      <div
        className={`md:hidden fixed inset-0 z-[9998] bg-black/40 transition-opacity ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setOpen(false)}
      />

      {/* Drawer (MISMO sidebar, sólo cambia posición en móvil) */}
      <aside
        className={`fixed md:static top-0 left-0 z-[9999] h-full md:h-auto w-[86%] max-w-[360px] md:w-auto bg-white md:bg-transparent shadow-2xl md:shadow-none transition-transform md:transition-none ${
          open ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0`}
      >
        {/* Header móvil */}
        <div className="md:hidden flex items-center justify-between px-4 py-4 border-b">
          <span className="font-semibold text-gray-900">{title}</span>
          <button
            className="p-2 rounded-lg hover:bg-gray-100"
            onClick={() => setOpen(false)}
            aria-label="Cerrar filtros"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 md:p-0">{children}</div>
      </aside>
    </>
  );
}
