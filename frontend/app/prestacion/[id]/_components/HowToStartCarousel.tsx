"use client";

import { useEffect, useMemo, useState } from "react";
import RichText from "@/components/RichText";

type HowToItem = {
  id: string;
  title: string;
  subtitle: string;
  image: string;
};

const AUTO_MS = 4500;
const TICK_MS = 90;
const PLACEHOLDER_IMAGE = "https://i.ibb.co/VmrmGrx/sin-foto.jpg";

export default function HowToStartCarousel({ items }: { items: HowToItem[] }) {
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);

  const safeItems = useMemo(
    () => items.filter((item) => item.title || item.subtitle || item.image).slice(0, 3),
    [items]
  );

  useEffect(() => {
    if (safeItems.length <= 1) return;

    setProgress(0);

    const startedAt = window.performance.now();
    const progressTimer = window.setInterval(() => {
      const elapsed = window.performance.now() - startedAt;
      const nextProgress = Math.min((elapsed / AUTO_MS) * 100, 100);
      setProgress(nextProgress);
    }, TICK_MS);

    const stepTimer = window.setTimeout(() => {
      setActive((current) => (current + 1) % safeItems.length);
    }, AUTO_MS);

    return () => {
      window.clearInterval(progressTimer);
      window.clearTimeout(stepTimer);
    };
  }, [active, safeItems.length]);

  if (!safeItems.length) return null;

  const current = safeItems[Math.min(active, safeItems.length - 1)];
  const setStep = (idx: number) => {
    setActive(idx);
    setProgress(0);
  };

  const numberWithTimer = (idx: number) => {
    const isActive = idx === active;
    const fill = isActive ? progress : idx < active ? 100 : 0;

    return (
      <span
        className="grid h-9 w-9 place-items-center rounded-md p-[2px]"
        style={{
          background: `conic-gradient(#00A9C6 ${fill}%, #D7E9EE ${fill}% 100%)`,
        }}
      >
        <span className="grid h-full w-full place-items-center rounded-[6px] bg-white text-sm font-semibold text-slate-700">
          {idx + 1}
        </span>
      </span>
    );
  };

  return (
    <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
      <div className="md:hidden">
        <div className="mb-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setStep((active - 1 + safeItems.length) % safeItems.length)}
            className="grid h-9 w-9 place-items-center rounded-full border border-slate-300 bg-white text-slate-700"
            aria-label="Anterior"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => setStep((active + 1) % safeItems.length)}
            className="grid h-9 w-9 place-items-center rounded-full border border-transparent bg-[#00A9C6] text-white"
            aria-label="Siguiente"
          >
            →
          </button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#00A9C6]/20 bg-gradient-to-br from-[#F4FBFC] to-[#E6F7FA]">
          <img
            src={current.image || PLACEHOLDER_IMAGE}
            alt={current.title || "Paso"}
            className="h-60 w-full object-cover object-center"
          />
        </div>

        <div className="mt-4 flex items-start gap-3">
          {numberWithTimer(active)}
          <div>
            <h3 className="text-[21px] font-bold leading-tight text-slate-900">{current.title}</h3>
            {current.subtitle ? <RichText value={current.subtitle} className="mt-1 text-sm text-slate-600" /> : null}
          </div>
        </div>

        {safeItems.length > 1 ? (
          <div className="mt-3 flex gap-2">
            {safeItems.map((_, idx) => (
              <button
                key={`mobile-step-${idx}`}
                type="button"
                onMouseEnter={() => setStep(idx)}
                onClick={() => setStep(idx)}
                className={`h-1.5 flex-1 rounded-full ${idx === active ? "bg-[#00A9C6]" : "bg-slate-200"}`}
                aria-label={`Ir al paso ${idx + 1}`}
              />
            ))}
          </div>
        ) : null}
      </div>

      <div className="hidden md:block">
        <div className="flex gap-4">
          {safeItems.map((step, idx) => {
            const isActive = idx === active;
            return (
              <button
                key={`panel-${step.id}`}
                type="button"
                onMouseEnter={() => {
                  if (window.innerWidth >= 1024) setStep(idx);
                }}
                onClick={() => setStep(idx)}
                className={`h-[420px] overflow-hidden rounded-[1.65rem] border transition-all duration-500 ${
                  isActive
                    ? "flex-[2.9] border-[#00A9C6]/35 bg-gradient-to-br from-[#EAF9FC] to-[#D6F1F7] shadow-md"
                    : "flex-[1.1] border-slate-200 bg-gradient-to-br from-[#F6FAFF] to-[#EEF5FF]"
                }`}
              >
                <img
                  src={step.image || PLACEHOLDER_IMAGE}
                  alt={step.title || `Paso ${idx + 1}`}
                  className={`h-full w-full object-cover object-center ${isActive ? "" : "opacity-75"}`}
                />
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex items-start gap-3">
          {safeItems.map((step, idx) => {
            const isActive = idx === active;
            return (
              <button
                key={`legend-${step.id}`}
                type="button"
                onClick={() => setStep(idx)}
                className={`min-w-0 text-left transition-all duration-500 ${isActive ? "flex-[2.9]" : "flex-[1.1]"}`}
              >
                <div className={`flex items-start gap-4 ${isActive ? "" : "justify-start"}`}>
                  <div className="shrink-0">{numberWithTimer(idx)}</div>
                  {isActive ? (
                    <div className="min-w-0 flex-1 pt-1">
                      <h3 className="break-words text-[22px] font-semibold leading-tight text-slate-900 md:text-[24px]">
                        {step.title}
                      </h3>
                      {step.subtitle ? (
                        <RichText value={step.subtitle} className="mt-2 max-w-[34rem] break-words text-[15px] leading-7 text-slate-600" />
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
