"use client";

import { type ComponentType, type TouchEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileText,
  MessageSquareLock,
  ShieldCheck,
  Siren,
  UserCheck,
} from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import type { TranslationKey } from "@/app/lib/translations";

type SafetyCard = {
  titleKey: TranslationKey;
  descriptionKey: TranslationKey;
  icon: ComponentType<{ className?: string }>;
  headerClass: string;
  bodyClass: string;
  iconClass: string;
};

const ACCEPTANCE_KEY = "buscarSafetyNoticeAccepted_v1";

const safetyCards: SafetyCard[] = [
  {
    titleKey: "safety_card_1_title",
    descriptionKey: "safety_card_1_text",
    icon: UserCheck,
    headerClass: "bg-amber-300 text-amber-950",
    bodyClass: "bg-amber-50",
    iconClass: "text-amber-600",
  },
  {
    titleKey: "safety_card_2_title",
    descriptionKey: "safety_card_2_text",
    icon: MessageSquareLock,
    headerClass: "bg-emerald-200 text-emerald-950",
    bodyClass: "bg-emerald-50",
    iconClass: "text-emerald-600",
  },
  {
    titleKey: "safety_card_3_title",
    descriptionKey: "safety_card_3_text",
    icon: CreditCard,
    headerClass: "bg-orange-300 text-orange-950",
    bodyClass: "bg-orange-50",
    iconClass: "text-orange-600",
  },
  {
    titleKey: "safety_card_4_title",
    descriptionKey: "safety_card_4_text",
    icon: FileText,
    headerClass: "bg-sky-300 text-sky-950",
    bodyClass: "bg-sky-50",
    iconClass: "text-sky-600",
  },
  {
    titleKey: "safety_card_5_title",
    descriptionKey: "safety_card_5_text",
    icon: AlertTriangle,
    headerClass: "bg-yellow-300 text-yellow-950",
    bodyClass: "bg-yellow-50",
    iconClass: "text-yellow-700",
  },
  {
    titleKey: "safety_card_6_title",
    descriptionKey: "safety_card_6_text",
    icon: Siren,
    headerClass: "bg-red-400 text-red-50",
    bodyClass: "bg-red-50",
    iconClass: "text-red-600",
  },
];

export default function SafetyWarningModal() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const localizedCards = useMemo(
    () =>
      safetyCards.map((card) => ({
        ...card,
        title: t(card.titleKey),
        description: t(card.descriptionKey),
      })),
    [t]
  );

  useEffect(() => {
    const accepted = window.localStorage.getItem(ACCEPTANCE_KEY) === "true";
    setIsOpen(!accepted);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const { style } = document.body;
    const previousOverflow = style.overflow;
    style.overflow = "hidden";

    return () => {
      style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const handleAccept = () => {
    window.localStorage.setItem(ACCEPTANCE_KEY, "true");
    setIsOpen(false);
  };

  const goToPrevCard = () => {
    setActiveCardIndex((current) => (current === 0 ? localizedCards.length - 1 : current - 1));
  };

  const goToNextCard = () => {
    setActiveCardIndex((current) => (current === localizedCards.length - 1 ? 0 : current + 1));
  };

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    setTouchStartX(event.changedTouches[0]?.clientX ?? null);
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    if (touchStartX == null) return;
    const touchEndX = event.changedTouches[0]?.clientX ?? touchStartX;
    const distance = touchStartX - touchEndX;
    const swipeThreshold = 40;
    if (Math.abs(distance) < swipeThreshold) {
      setTouchStartX(null);
      return;
    }
    if (distance > 0) {
      goToNextCard();
    } else {
      goToPrevCard();
    }
    setTouchStartX(null);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[220] bg-slate-900/60 p-3 pt-20 backdrop-blur-[2px] sm:p-4 sm:pt-24 md:p-8 md:pt-28"
      aria-modal="true"
      role="dialog"
      aria-labelledby="buscar-safety-title"
      aria-describedby="buscar-safety-description"
    >
      <div className="mx-auto my-3 max-h-[calc(100vh-1.5rem)] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white shadow-2xl sm:my-4 sm:max-h-[calc(100vh-2rem)] md:my-6 md:max-h-[calc(100vh-3rem)]">
        <div className="bg-gradient-to-r from-blue-700 to-blue-500 px-4 py-4 text-white sm:px-6 sm:py-5 md:px-8">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="rounded-2xl bg-white/20 p-2 shadow-inner sm:p-2.5">
              <ShieldCheck className="h-8 w-8 sm:h-9 sm:w-9 md:h-11 md:w-11" />
            </div>
            <div>
              <p id="buscar-safety-description" className="text-xs font-semibold uppercase tracking-wider text-blue-100">
                {t("safety_modal_badge")}
              </p>
              <h2 id="buscar-safety-title" className="text-2xl font-extrabold leading-tight sm:text-3xl md:text-5xl">
                {t("safety_modal_title")}
              </h2>
            </div>
          </div>
        </div>

        <div className="space-y-5 p-4 sm:p-5 md:space-y-6 md:p-8">
          <div className="md:hidden" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
            {localizedCards[activeCardIndex]
              ? (() => {
                  const activeCard = localizedCards[activeCardIndex];
                  const ActiveIcon = activeCard.icon;
                  return (
                    <article className={`overflow-hidden rounded-2xl border border-slate-100 ${activeCard.bodyClass}`}>
                      <header className={`flex items-center gap-2 px-4 py-3 text-xl font-extrabold sm:text-lg ${activeCard.headerClass}`}>
                        <ActiveIcon className={`h-5 w-5 sm:h-6 sm:w-6 ${activeCard.iconClass}`} />
                        <span>{activeCard.title}</span>
                      </header>
                      <div className="px-4 py-5">
                        <div className="mb-3 flex justify-center">
                          <div className="rounded-full bg-white/75 p-3 shadow-sm">
                            <ActiveIcon className={`h-9 w-9 ${activeCard.iconClass}`} />
                          </div>
                        </div>
                        <div className="border-t border-slate-300/70 pt-3 text-center text-base font-semibold text-slate-700 sm:text-base md:text-lg">
                          {activeCard.description}
                        </div>
                      </div>
                    </article>
                  );
                })()
              : null}

            <div className="mt-4 flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={goToPrevCard}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-700 shadow-md ring-1 ring-slate-200"
                aria-label="Tarjeta anterior"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-2">
                {localizedCards.map((_, index) => (
                  <button
                    type="button"
                    key={`dot-${index}`}
                    onClick={() => setActiveCardIndex(index)}
                    className={`h-2.5 rounded-full transition-all ${activeCardIndex === index ? "w-6 bg-blue-600" : "w-2.5 bg-slate-300"}`}
                    aria-label={`Ir a tarjeta ${index + 1}`}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={goToNextCard}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-700 shadow-md ring-1 ring-slate-200"
                aria-label="Siguiente tarjeta"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="hidden gap-4 md:grid md:grid-cols-2 lg:grid-cols-3">
            {localizedCards.map((card) => {
              const Icon = card.icon;
              return (
                <article key={card.titleKey} className={`overflow-hidden rounded-2xl border border-slate-100 ${card.bodyClass}`}>
                  <header className={`flex items-center gap-2 px-4 py-3 text-xl font-extrabold sm:text-lg ${card.headerClass}`}>
                    <Icon className={`h-5 w-5 sm:h-6 sm:w-6 ${card.iconClass}`} />
                    <span>{card.title}</span>
                  </header>
                  <div className="px-4 py-5">
                    <div className="mb-3 flex justify-center">
                      <div className="rounded-full bg-white/75 p-3 shadow-sm">
                        <Icon className={`h-9 w-9 ${card.iconClass}`} />
                      </div>
                    </div>
                    <div className="border-t border-slate-300/70 pt-3 text-center text-base font-semibold text-slate-700 sm:text-base md:text-lg">
                      {card.description}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="flex justify-center pb-1">
            <button
              type="button"
              onClick={handleAccept}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-base font-bold text-white shadow-lg transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 md:px-8 md:text-lg"
            >
              <BadgeCheck className="h-5 w-5" />
              {t("safety_modal_accept")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
