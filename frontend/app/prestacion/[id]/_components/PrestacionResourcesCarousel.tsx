"use client";

import { useEffect, useRef, useState } from "react";
import RichText from "@/components/RichText";

type ResourceButton = {
  label: string;
  url: string;
  style?: "primary" | "secondary";
  bgColor?: string;
  textColor?: string;
};

type ResourceItem = {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  checkItems: string[];
  buttons: ResourceButton[];
};

export default function PrestacionResourcesCarousel({ items }: { items: ResourceItem[] }) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    const onScroll = () => {
      const cards = Array.from(el.children) as HTMLElement[];
      if (!cards.length) return;
      const center = el.scrollLeft + el.clientWidth / 2;
      let idx = 0;
      let dist = Number.POSITIVE_INFINITY;
      cards.forEach((card, i) => {
        const cardCenter = card.offsetLeft + card.clientWidth / 2;
        const d = Math.abs(cardCenter - center);
        if (d < dist) {
          dist = d;
          idx = i;
        }
      });
      setActiveIndex(idx);
    };

    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [items.length]);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    const measureOverflow = () => {
      setHasOverflow(el.scrollWidth - el.clientWidth > 8);
      setIsDesktop(window.innerWidth >= 1024);
    };

    measureOverflow();
    window.addEventListener("resize", measureOverflow);
    return () => window.removeEventListener("resize", measureOverflow);
  }, [items.length]);

  const scrollTo = (idx: number) => {
    const el = trackRef.current;
    if (!el) return;
    const cards = Array.from(el.children) as HTMLElement[];
    const card = cards[idx];
    if (!card) return;
    el.scrollTo({ left: card.offsetLeft, behavior: "smooth" });
  };

  return (
    <div className="mt-5">
      {hasOverflow && isDesktop ? (
        <div className="mb-3 hidden justify-end gap-2 md:flex">
          <button type="button" onClick={() => scrollTo(Math.max(0, activeIndex - 1))} className="grid h-9 w-9 place-items-center rounded-full border border-slate-300 bg-white">←</button>
          <button type="button" onClick={() => scrollTo(Math.min(items.length - 1, activeIndex + 1))} className="grid h-9 w-9 place-items-center rounded-full border border-slate-300 bg-white">→</button>
        </div>
      ) : null}

      <div ref={trackRef} className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 md:justify-center">
        {items.map((card) => (
          <article key={card.id} className="w-full flex-[0_0_100%] snap-start overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm md:flex-[0_0_48%] lg:flex-[0_0_32%]">
            {card.image ? <img src={card.image} alt={card.title || "Recurso"} className="h-44 w-full object-cover" /> : null}
            <div className="space-y-3 p-5">
              <h3 className="text-xl font-bold text-slate-900">{card.title}</h3>
              {card.subtitle ? <RichText value={card.subtitle} className="text-sm text-slate-600" /> : null}

              {card.checkItems.length ? (
                <ul className="space-y-1">
                  {card.checkItems.map((it, i) => (
                    <li key={`${card.id}-check-${i}`} className="flex items-start gap-2 text-sm text-slate-700">
                      <span className="mt-0.5 grid h-5 w-5 place-items-center rounded-full bg-emerald-50 text-emerald-700">✓</span>
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="flex flex-wrap gap-2 pt-2">
                {card.buttons.slice(0, 2).map((btn, i) => (
                  <a
                    key={`${card.id}-btn-${i}`}
                    href={btn.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex rounded-xl px-4 py-2 text-sm font-semibold shadow-[0_10px_22px_rgba(15,23,42,0.18)] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_14px_26px_rgba(15,23,42,0.22)] active:translate-y-[1px] active:shadow-[0_6px_12px_rgba(15,23,42,0.18)]"
                    style={{
                      backgroundColor: btn.style === "secondary" ? (btn.bgColor || "#EFF6FF") : (btn.bgColor || "#2563EB"),
                      color: btn.style === "secondary" ? (btn.textColor || "#1D4ED8") : (btn.textColor || "#FFFFFF"),
                    }}
                  >
                    {btn.label}
                  </a>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>

      {items.length > 1 ? (
        <div className="mt-2 flex justify-center gap-1.5 md:hidden">
          {items.map((_, idx) => (
            <button
              key={`resource-dot-${idx}`}
              type="button"
              onClick={() => scrollTo(idx)}
              className={`h-2.5 w-2.5 rounded-full ${idx === activeIndex ? "bg-indigo-600" : "bg-slate-300"}`}
              aria-label={`Ir al recurso ${idx + 1}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
