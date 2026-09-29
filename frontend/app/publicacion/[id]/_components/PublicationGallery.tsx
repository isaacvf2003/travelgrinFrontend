"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { ImageIcon } from "lucide-react";

type PublicationGalleryProps = {
  images: string[];
  title: string;
};

export default function PublicationGallery({ images, title }: PublicationGalleryProps) {
  const [failedUrls, setFailedUrls] = useState<Record<string, boolean>>({});

  const sanitizedImages = useMemo(
    () => images.map((src) => String(src ?? "").trim()).filter((src) => src && !failedUrls[src]),
    [images, failedUrls]
  );

  const [activeIndex, setActiveIndex] = useState(0);
  const mobileScrollRef = useRef<HTMLDivElement>(null);
  const thumbRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    setActiveIndex(0);
  }, [sanitizedImages]);

  useEffect(() => {
    const currentThumb = thumbRefs.current[activeIndex];
    if (!currentThumb) return;
    currentThumb.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeIndex]);

  const handleImageError = (src: string) => {
    if (!src) return;
    setFailedUrls((prev) => ({ ...prev, [src]: true }));
  };

  const total = sanitizedImages.length;
  const mainImage = sanitizedImages[activeIndex] ?? "";

  const goToIndex = (index: number) => {
    if (!total) return;
    const next = Math.max(0, Math.min(total - 1, index));
    setActiveIndex(next);
  };

  const goToNext = () => {
    if (total <= 1) return;
    setActiveIndex((prev) => (prev + 1) % total);
  };

  const handleMobileScroll = () => {
    const el = mobileScrollRef.current;
    if (!el) return;
    const nextIndex = Math.round(el.scrollLeft / el.clientWidth);
    setActiveIndex(Math.max(0, Math.min(total - 1, nextIndex)));
  };

  if (!total) {
    return (
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-br from-slate-50 via-cyan-50/30 to-slate-100/60 p-8">
        <div className="relative aspect-[4/3] w-full md:aspect-[16/10] flex flex-col items-center justify-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white border border-cyan-100 shadow-sm text-[#00A9C6]">
            <ImageIcon className="h-8 w-8 text-[#00A9C6]" />
          </div>
          <div className="mt-4 max-w-md px-4">
            <span className="inline-flex rounded-full bg-[#00A9C6]/10 px-3 py-1 text-xs font-semibold text-[#007D92]">
              Publicación Oficial
            </span>
            <h4 className="mt-2 text-base font-semibold text-slate-800 line-clamp-2">
              {title}
            </h4>
            <p className="mt-1 text-xs text-slate-500">
              Información y propuesta verificada
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (total === 1) {
    return (
      <div className="relative overflow-hidden rounded-3xl border border-gray-200 bg-slate-900/5">
        <div className="relative aspect-[4/3] w-full md:aspect-[16/10] flex items-center justify-center overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mainImage}
            alt={title}
            onError={() => handleImageError(mainImage)}
            className="h-full w-full object-cover object-center"
          />
        </div>
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center rounded-full bg-slate-900/20 px-2 py-1 backdrop-blur-sm md:hidden">
          <span className="h-2.5 w-2.5 rounded-full bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.08)]" />
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-[96px_1fr] lg:grid-cols-[110px_1fr]">
      <div className="hidden md:block">
        <div className="max-h-[312px] space-y-3 overflow-y-auto pr-1 lg:max-h-[354px]">
          {sanitizedImages.map((src, idx) => (
            <button
              key={`${src}-${idx}`}
              ref={(el) => {
                thumbRefs.current[idx] = el;
              }}
              type="button"
              onClick={() => goToIndex(idx)}
              className={`relative w-full overflow-hidden rounded-2xl border transition ${
                idx === activeIndex ? "border-teal-400 ring-2 ring-teal-200" : "border-gray-200 hover:border-teal-300"
              }`}
              style={{ aspectRatio: "1 / 1" }}
              aria-label={`Ver imagen ${idx + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`thumb-${idx + 1}`}
                onError={() => handleImageError(src)}
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-gray-200 bg-gray-50">
        <div
          ref={mobileScrollRef}
          onScroll={handleMobileScroll}
          className="tg-hide-scrollbar flex w-full snap-x snap-mandatory overflow-x-auto scroll-smooth md:hidden"
        >
          {sanitizedImages.map((src, idx) => (
            <div key={`${src}-${idx}`} className="relative w-full flex-shrink-0 snap-center">
              <div className="relative w-full aspect-[4/3]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={`${title}-${idx + 1}`}
                  onError={() => handleImageError(src)}
                  className="h-full w-full object-cover object-center"
                />
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={goToNext}
          className="hidden h-full w-full md:block"
          aria-label="Siguiente imagen"
        >
          <div className="relative w-full aspect-[16/10] bg-slate-900/5 flex items-center justify-center overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mainImage}
              alt={title}
              onError={() => handleImageError(mainImage)}
              className="h-full w-full object-cover object-center"
            />
          </div>
        </button>

        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-900/20 px-2.5 py-1.5 backdrop-blur-sm md:hidden">
          {sanitizedImages.map((_, idx) => (
            <button
              key={`dot-${idx}`}
              type="button"
              aria-label={`Ver imagen ${idx + 1}`}
              onClick={() => {
                setActiveIndex(idx);
                const scroller = mobileScrollRef.current;
                if (!scroller) return;
                scroller.scrollTo({ left: idx * scroller.clientWidth, behavior: "smooth" });
              }}
              className={`h-2.5 rounded-full transition-all duration-200 ${
                idx === activeIndex ? "w-5 bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.08)]" : "w-2.5 bg-white/55"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
