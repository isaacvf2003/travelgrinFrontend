"use client";

import { useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Heart, Share2 } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";

import I18nText from "@/components/I18nText";
import type { Publication } from "@/app/lib/types";

const DEFAULT_PLACEHOLDER_IMAGE = "https://i.ibb.co/VmrmGrx/sin-foto.jpg";

function safeUrl(src: any) {
  if (!src) return null;
  const s = String(src);
  return s || null;
}

export default function OthersCarousel({ items }: { items: Publication[] }) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement | null>(null);

  const scrollByAmount = (dir: "left" | "right") => {
    const el = containerRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.8;
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-gray-900">{t("otras_oportunidades_titulo")}</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => scrollByAmount("left")}
            className="rounded-full border border-gray-200 p-2 text-gray-500 hover:bg-gray-50"
            aria-label={t("otras_oportunidades_prev")}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollByAmount("right")}
            className="rounded-full border border-gray-200 p-2 text-gray-500 hover:bg-gray-50"
            aria-label={t("otras_oportunidades_next")}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div ref={containerRef} className="tg-hide-scrollbar mt-4 flex gap-4 overflow-x-auto scroll-smooth pb-2">
        {items.map((p) => {
          const pImgsRaw = (p.images as any) ?? [];
          const pImgs = Array.isArray(pImgsRaw) ? pImgsRaw.map(safeUrl).filter(Boolean) : [];
          const cover = pImgs[0] ? String(pImgs[0]) : DEFAULT_PLACEHOLDER_IMAGE;

          return (
            <Link
              key={String(p.id)}
              href={`/publicacion/${p.id}`}
              className="min-w-[260px] max-w-[260px] rounded-2xl border border-gray-200 bg-white p-3 hover:shadow-md transition-all"
            >
              <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-gray-50" style={{ aspectRatio: "16/9" }}>
                <Image src={cover} alt={String(p.title)} fill className="object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
              </div>

              <div className="mt-3 flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-gray-500">
                    {p.country ? String(p.country) : ""}{p.city ? ` · ${String(p.city)}` : ""}
                  </div>
                  <div className="mt-1 line-clamp-2 text-sm font-semibold text-gray-900">
                    <I18nText value={(p as any).titleI18n} fallback={String(p.title)} />
                  </div>
                </div>

                <div className="flex items-center gap-2 text-gray-400">
                  <Heart className="h-4 w-4" />
                  <Share2 className="h-4 w-4" />
                </div>
              </div>

              <div className="mt-3">
                <span className="inline-flex rounded-lg bg-teal-600 px-3 py-1 text-xs font-medium text-white">
                  {t("ver_detalle")}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
