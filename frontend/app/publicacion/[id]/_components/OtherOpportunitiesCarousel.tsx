"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { Publication } from "@/app/lib/types";
import I18nText from "@/components/I18nText";
import { useTranslation } from "@/app/hooks/useTranslation";

const DEFAULT_PLACEHOLDER_IMAGE = "https://i.ibb.co/VmrmGrx/sin-foto.jpg";

function safeUrl(src: unknown) {
  if (!src) return null;
  const s = String(src);
  if (!s) return null;
  return s;
}

export default function OtherOpportunitiesCarousel({ items }: { items: Publication[] }) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [mobilePage, setMobilePage] = useState(0);
  const [mobilePages, setMobilePages] = useState(1);

  const scrollBy = (offset: number) => {
    if (!containerRef.current) return;
    containerRef.current.scrollBy({ left: offset, behavior: "smooth" });
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const recalculate = () => {
      const pages = Math.max(1, Math.ceil(el.scrollWidth / el.clientWidth));
      setMobilePages(pages);
      const page = Math.round(el.scrollLeft / el.clientWidth);
      setMobilePage(Math.max(0, Math.min(pages - 1, page)));
    };

    recalculate();
    el.addEventListener("scroll", recalculate, { passive: true });
    window.addEventListener("resize", recalculate);

    return () => {
      el.removeEventListener("scroll", recalculate);
      window.removeEventListener("resize", recalculate);
    };
  }, [items.length]);

  return (
    <div className="mt-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-gray-900">{t("otras_oportunidades")}</h3>
        <div className="hidden items-center gap-2 md:flex">
          <button
            type="button"
            onClick={() => scrollBy(-320)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-sm shadow"
            aria-label="Anterior"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => scrollBy(320)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-sm shadow"
            aria-label="Siguiente"
          >
            →
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto px-2 pb-3 pt-2 scroll-smooth [scroll-padding-inline:0.5rem] before:block before:w-0.5 before:shrink-0 before:content-[''] after:block after:w-0.5 after:shrink-0 after:content-[''] sm:px-3 sm:[scroll-padding-inline:0.75rem] md:gap-4 md:px-0 md:pb-4 md:before:hidden md:after:hidden"
      >
        {items.map((p) => {
          const pImgsRaw = Array.isArray(p.images) ? p.images : [];
          const pImgs = pImgsRaw.map(safeUrl).filter(Boolean);
          const cover = pImgs[0] ? String(pImgs[0]) : DEFAULT_PLACEHOLDER_IMAGE;
          return (
            <Link
              key={String(p.id)}
              href={`/${p.primaryGroupKey === "prestacion" ? "prestacion" : "publicacion"}/${p.id}`}
              className="w-[calc(100%-2.75rem)] min-w-[170px] max-w-[230px] shrink-0 snap-start rounded-2xl border border-gray-200 bg-white p-3 shadow-sm transition hover:shadow-md min-[390px]:w-[calc((100%-0.75rem)/1.35)] min-[430px]:w-[calc((100%-0.75rem)/1.55)] md:w-[260px] md:min-w-[260px] md:max-w-[260px]"
            >
              <div
                className="relative overflow-hidden rounded-xl border border-gray-200 bg-gray-50"
                style={{ aspectRatio: "16/9" }}
              >
                <Image src={cover} alt={String(p.title)} fill className="object-cover" />
              </div>
              <div className="mt-3 text-xs text-gray-500">
                {p.country ? String(p.country) : ""}
                {p.city ? ` · ${String(p.city)}` : ""}
              </div>
              <div className="mt-2 line-clamp-2 text-sm font-semibold text-gray-900">
                <I18nText value={(p as { titleI18n?: Record<string, string> | null }).titleI18n ?? null} fallback={String(p.title)} />
              </div>
              <div className="mt-3">
                <span className="inline-flex rounded-lg bg-teal-600 px-3 py-1 text-xs font-medium text-white">
                  Ver detalle
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mt-2 flex items-center justify-center gap-2 md:hidden">
        {Array.from({ length: mobilePages }).map((_, idx) => (
          <span
            key={`mobile-other-dot-${idx}`}
            className={`h-2 w-2 rounded-full transition ${idx === mobilePage ? "bg-teal-600" : "bg-slate-300"}`}
          />
        ))}
      </div>
    </div>
  );
}
