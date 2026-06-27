"use client";

import { Globe2, Mail } from "lucide-react";

import { useCountry } from "@/app/context/CountryProvider";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function BottomCards({ emptyState = false }: { emptyState?: boolean }) {
  const { t, locale } = useTranslation();
  const { setIsOpenModal, setIsOpenModalDemandante } = useCountry();

  const openDemandanteForm = () => {
    setIsOpenModal(true);
    setIsOpenModalDemandante(true);
  };

  const emptyCopy =
    locale === "en"
      ? {
          title: "We still couldn't find the right opportunities for you",
          description: "Tell us more about your trip purpose and we'll guide you toward the right next step.",
          cta: "Let's do it",
        }
      : locale === "pt"
        ? {
            title: "Ainda não encontramos oportunidades ideais para você",
            description: "Conte-nos mais sobre o propósito da sua viagem e vamos orientá-lo para o próximo passo certo.",
            cta: "Vamos nessa",
          }
        : locale === "it"
          ? {
              title: "Non abbiamo ancora trovato le opportunità giuste per te",
              description: "Raccontaci meglio il tuo obiettivo di viaggio e ti guideremo verso il passo successivo più adatto.",
              cta: "Andiamo",
            }
          : {
              title: "Todavía no encontramos oportunidades ideales para vos",
              description: "Contanos mejor el propósito de tu viaje y te guiamos hacia el próximo paso indicado.",
              cta: "Vamos por ello",
            };

  const ctaClass =
    "relative mt-4 inline-flex items-center justify-center overflow-hidden rounded-full bg-[#273166] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_28px_rgba(255,255,255,0.38)] transition hover:shadow-[0_0_36px_rgba(255,255,255,0.55)] before:absolute before:inset-y-[-60%] before:left-[-45%] before:w-1/2 before:skew-x-12 before:bg-white/45 before:opacity-0 before:transition-all before:duration-700 hover:before:left-[120%] hover:before:opacity-100";

  return (
    <div className="mt-8 space-y-4">
      <div className="rounded-2xl bg-gradient-to-r from-[#08D9BD] via-[#04B5BD] to-[#009ABC] px-6 py-6 text-center shadow-[0_14px_40px_rgba(0,154,188,0.18)]">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-full bg-white/20 text-white ring-1 ring-white/35">
            <Globe2 className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-white">
              {emptyState ? emptyCopy.title : t("tu_proxima_aventura_titulo")}
            </h3>
            <p className="mt-1 text-sm leading-6 text-white/85">
              {emptyState ? emptyCopy.description : t("tu_proxima_aventura_descripcion")}
            </p>
            {emptyState ? (
              <button type="button" onClick={openDemandanteForm} className={ctaClass}>
                <span className="relative z-10">{emptyCopy.cta}</span>
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-gradient-to-r from-[#08D9BD] via-[#04B5BD] to-[#009ABC] px-6 py-6 text-center shadow-[0_14px_40px_rgba(0,154,188,0.18)]">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-full bg-white/20 text-white ring-1 ring-white/35">
            <Mail className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-white">{t("recibe_oportunidades_titulo")}</h3>
            <button type="button" onClick={openDemandanteForm} className={ctaClass}>
              <span className="relative z-10">{t("viajar_por_un_cambio")}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
