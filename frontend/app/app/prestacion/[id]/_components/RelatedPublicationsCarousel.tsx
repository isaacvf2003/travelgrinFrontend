"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "@/app/hooks/useTranslation";
import RichText from "@/components/RichText";


function compactPlainText(value: string) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactTextLength(value: string) {
  return compactPlainText(value).length;
}

function descriptionPreview(value: string, maxWords = 18) {
  const plainText = compactPlainText(value);
  const words = plainText.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return value;
  return `${words.slice(0, maxWords).join(" ")}…`;
}

type RelatedCard = {
  id: string;
  category: string;
  title: string;
  description: string;
  image: string;
  href: string;
};

export default function RelatedPublicationsCarousel({ items }: { items: RelatedCard[] }) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState("Todas");
  const [expanded, setExpanded] = useState(false);

  const categories = useMemo(
    () => ["Todas", ...Array.from(new Set(items.map((item) => item.category).filter(Boolean)))],
    [items]
  );
  const filteredItems = useMemo(
    () => items.filter((item) => categoryFilter === "Todas" || item.category === categoryFilter),
    [items, categoryFilter]
  );
  const visibleItems = useMemo(
    () => (expanded ? filteredItems : filteredItems.slice(0, 12)),
    [filteredItems, expanded]
  );

  const hasControls = visibleItems.length > 1;
  const returnTo = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    const onScroll = () => {
      const children = Array.from(el.children) as HTMLElement[];
      if (!children.length) return;
      const viewportCenter = el.scrollLeft + el.clientWidth / 2;

      let bestIdx = 0;
      let bestDistance = Number.POSITIVE_INFINITY;

      children.forEach((child, idx) => {
        const childCenter = child.offsetLeft + child.clientWidth / 2;
        const distance = Math.abs(childCenter - viewportCenter);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIdx = idx;
        }
      });

      setActiveIndex(bestIdx);
    };

    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [visibleItems.length]);

  useEffect(() => {
    setActiveIndex(0);
  }, [categoryFilter, expanded]);

  const scrollToIndex = (index: number) => {
    const el = trackRef.current;
    if (!el) return;
    const children = Array.from(el.children) as HTMLElement[];
    const target = children[index];
    if (!target) return;
    el.scrollTo({ left: target.offsetLeft, behavior: "smooth" });
  };

  const scrollByStep = (direction: -1 | 1) => {
    const next = Math.min(visibleItems.length - 1, Math.max(0, activeIndex + direction));
    scrollToIndex(next);
  };

  return (
    <div className="mt-5">
      <div className="mb-3 flex flex-wrap gap-2">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setCategoryFilter(category)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              categoryFilter === category
                ? "bg-indigo-600 text-white"
                : "border border-slate-300 bg-white text-slate-700"
            }`}
          >
            {category}
          </button>
        ))}
      </div>
      {hasControls ? (
        <div className="mb-3 hidden items-center justify-end gap-2 md:flex">
          <button
            type="button"
            onClick={() => scrollByStep(-1)}
            className="grid h-9 w-9 place-items-center rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            aria-label="Anterior"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => scrollByStep(1)}
            className="grid h-9 w-9 place-items-center rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            aria-label="Siguiente"
          >
            →
          </button>
        </div>
      ) : null}

      <div className="relative">
        {hasControls ? (
          <>
            <button
              type="button"
              onClick={() => scrollByStep(-1)}
              className="absolute left-3 top-20 z-10 grid h-8 w-8 place-items-center rounded-full bg-white/95 text-sm text-slate-700 shadow-lg ring-1 ring-slate-200/70 md:hidden"
              aria-label="Anterior"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => scrollByStep(1)}
              className="absolute right-3 top-20 z-10 grid h-8 w-8 place-items-center rounded-full bg-white/95 text-sm text-slate-700 shadow-lg ring-1 ring-slate-200/70 md:hidden"
              aria-label="Siguiente"
            >
              →
            </button>
          </>
        ) : null}
        <div ref={trackRef} className="tg-hide-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-2">
        {visibleItems.map((pub) => {
          const href = `${pub.href}${pub.href.includes("?") ? "&" : "?"}returnTo=${encodeURIComponent(returnTo)}`;
          const previewDescription = descriptionPreview(pub.description);
          const descriptionLength = compactTextLength(previewDescription);
          const descriptionSizeClass = descriptionLength > 110
            ? "text-[11px] leading-4"
            : descriptionLength > 70
              ? "text-[12px] leading-4"
              : "text-sm leading-5";

          return (
            <Link key={pub.id} href={href} className="flex h-[260px] max-h-[260px] w-full flex-[0_0_100%] snap-start flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:shadow-md md:w-[300px] md:flex-[0_0_300px]">
              <img
                src={pub.image}
                alt={pub.title || "Publicación relacionada"}
                className="h-24 w-full object-cover"
              />
              <div className="flex min-h-0 flex-1 flex-col justify-between p-3">
                <div className="min-w-0">
                  <div className="text-xs text-slate-500">{pub.category || "Prestación"}</div>
                  <h3 className="mt-2 line-clamp-2 h-12 overflow-hidden text-xl font-semibold leading-6 text-slate-900">{pub.title}</h3>
                  {previewDescription ? <RichText value={previewDescription} className={`related-card-description mt-1 h-10 overflow-hidden text-slate-600 ${descriptionSizeClass}`} /> : null}
                </div>
                <span className="mb-2 mt-2 inline-flex rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white">
                  {t("ver_mas")}
                </span>
              </div>
            </Link>
          );
        })}
        </div>
      </div>
      {filteredItems.length > 12 ? (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
          >
            {expanded ? "Ver menos" : "Ver más"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
