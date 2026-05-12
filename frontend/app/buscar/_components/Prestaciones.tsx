"use client";

import { useState } from "react";

const CHIPS = [
  { key: "tel", label: "Telefonía e internet" },
  { key: "bank", label: "Bancos y financiamiento" },
  { key: "seguro", label: "Seguro de viaje" },
  { key: "aloj", label: "Alojamiento" },
  { key: "comida", label: "Comida y supermercado" },
  { key: "imp", label: "Impuestos" },
];

const CONTENT: Record<string, { title: string; body: string }> = {
  tel: {
    title: "Telefonía e internet",
    body:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
  },
  bank: {
    title: "Bancos y financiamiento",
    body:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
  },
  seguro: {
    title: "Seguro de viaje",
    body:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
  },
  aloj: {
    title: "Alojamiento",
    body:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
  },
  comida: {
    title: "Comida y supermercado",
    body:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
  },
  imp: {
    title: "Impuestos",
    body:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
  },
};

export default function Prestaciones() {
  const [active, setActive] = useState(CHIPS[0].key);
  const c = CONTENT[active];

  const goToResults = () => {
    const el = document.getElementById("resultados");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <h2 className="text-balance text-2xl font-semibold text-[#0B2B30] md:text-3xl">
        Recorre el mundo con la seguridad de{" "}
        <span className="text-[#00A9C6]">nuestras prestaciones</span>
      </h2>

      {/* CHIPS: mobile/tablet horizontal con flecha; desktop wrap */}
      <div className="mt-4 relative">
        <div
          className={`chipsRow flex gap-2 overflow-x-auto whitespace-nowrap pr-10 md:flex-nowrap md:overflow-x-auto lg:flex-wrap lg:whitespace-normal lg:overflow-visible`}
          style={{
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none" as any,
          }}
        >
          <style jsx>{`
            .chipsRow::-webkit-scrollbar {
              display: none;
            }
          `}</style>

          {CHIPS.map((chip) => {
            const on = chip.key === active;
            return (
              <button
                key={chip.key}
                type="button"
                onClick={() => setActive(chip.key)}
                className={
                  "flex-shrink-0 rounded-full px-3 py-1 text-xs font-semibold shadow-sm transition " +
                  (on
                    ? "bg-[#00A9C6] text-white"
                    : "bg-[#E6F7F9] text-[#0B2B30] hover:bg-[#D8F2F5]")
                }
              >
                {chip.label}
              </button>
            );
          })}

          {/* Botón desktop (como tu original) */}
          <button
            type="button"
            className="ml-auto hidden h-7 w-7 items-center justify-center rounded-full border border-[#B7D9DA] bg-white text-[#0B2B30] shadow-sm md:flex lg:flex"
            aria-label="Siguiente"
          >
            ›
          </button>
        </div>

        {/* Flechita SOLO en mobile/tablet para indicar scroll */}
        <div className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 md:block lg:hidden">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#B7D9DA] bg-white text-[#0B2B30] shadow-sm">
            ›
          </span>
        </div>
      </div>

      {/* CONTENIDO (se despliega abajo) + botón ver opciones */}
      <div className="mt-4 rounded-xl border border-[#B7D9DA] bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#0B2B30]">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[#E6F7F9]">
            📄
          </span>
          {c.title}
        </div>

        <p className="text-sm leading-6 text-[#4B5B5E]">{c.body}</p>

        <div className="mt-4 flex">
          <button
            type="button"
            onClick={goToResults}
            className="rounded-lg bg-[#00A9C6] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
          >
            Ver opciones
          </button>
        </div>
      </div>
    </section>
  );
}
