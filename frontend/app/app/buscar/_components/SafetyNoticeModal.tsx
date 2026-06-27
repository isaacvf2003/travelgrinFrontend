"use client";

import { type ComponentType, useEffect, useMemo, useState } from "react";
import { ShieldCheck, UserCheck, Lock, CreditCard, FileText, AlertTriangle, Siren } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";

type NoticeCard = {
  title: string;
  body: string;
  icon: ComponentType<{ className?: string }>;
  tone: string;
};

function getCopy(locale: string) {
  if (locale === "en") {
    return {
      title: "How to avoid scams",
      cta: "Accept and continue",
      cards: [
        { title: "Verify the host", body: "Check profiles with ratings and reviews. No history or social links? Be careful." },
        { title: "Protect your data", body: "Never share personal or financial information outside official channels." },
        { title: "Safe payment", body: "Never use Western Union or crypto. Prefer traceable and secure bank methods." },
        { title: "Written agreement", body: "Ask for a contract detailing services and costs before closing the deal." },
        { title: "Avoid traps", body: "Be wary of deals that look too good or when someone pressures you to decide fast." },
        { title: "Report risks", body: "If something seems suspicious, use the Report option so everyone stays safe." },
      ],
    };
  }

  if (locale === "pt") {
    return {
      title: "Como evitar golpes",
      cta: "Aceitar e continuar",
      cards: [
        { title: "Verifique o anfitrião", body: "Procure perfis com avaliações e comentários. Sem histórico nem redes? Desconfie." },
        { title: "Proteja seus dados", body: "Não compartilhe dados pessoais ou financeiros fora dos canais oficiais." },
        { title: "Pagamento seguro", body: "Nunca use Western Union ou cripto. Prefira bancos rastreáveis e seguros." },
        { title: "Acordo por escrito", body: "Peça um contrato com serviços e custos antes de fechar o acordo." },
        { title: "Evite armadilhas", body: "Desconfie de ofertas boas demais ou pressão para decidir com urgência." },
        { title: "Denuncie riscos", body: "Se algo parecer suspeito, use a opção Denunciar para cuidar de todos." },
      ],
    };
  }

  if (locale === "it") {
    return {
      title: "Come evitare truffe",
      cta: "Accetta e continua",
      cards: [
        { title: "Verifica l'host", body: "Cerca profili con valutazioni e recensioni. Senza storico o social? Fai attenzione." },
        { title: "Proteggi i tuoi dati", body: "Non condividere dati personali o finanziari fuori dai canali ufficiali." },
        { title: "Pagamento sicuro", body: "Non usare Western Union o cripto. Preferisci metodi bancari tracciabili e sicuri." },
        { title: "Accordo scritto", body: "Richiedi un contratto con servizi e costi prima di concludere." },
        { title: "Evita le trappole", body: "Diffida da offerte troppo convenienti o dalla pressione a decidere subito." },
        { title: "Segnala rischi", body: "Se qualcosa sembra sospetto, usa l'opzione Segnala per proteggerci tutti." },
      ],
    };
  }

  return {
    title: "Cómo evitar estafas",
    cta: "Aceptar y continuar",
    cards: [
      { title: "Verifica al anfitrión", body: "Busca perfiles con valoraciones y reseñas. Sin historial ni redes, desconfía." },
      { title: "Protege tus datos", body: "No des información personal o financiera fuera de los canales oficiales." },
      { title: "Pago seguro", body: "Nunca uses Western Union o criptos. Usa bancos rastreables y seguros." },
      { title: "Acuerdo escrito", body: "Pide un contrato que detalle servicios y costos antes de cerrar el trato." },
      { title: "Evita trampas", body: "Desconfía de ofertas demasiado buenas o de que te apuren para decidir." },
      { title: "Denuncia riesgos", body: "Si algo parece sospechoso, usa la opción Denunciar y cuidémonos todos." },
    ],
  };
}

const SAFETY_NOTICE_KEY = "tg_buscar_safety_notice_accepted_v1";

export default function SafetyNoticeModal() {
  const { locale } = useTranslation();
  const [open, setOpen] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const accepted = window.localStorage.getItem(SAFETY_NOTICE_KEY) === "1";
      setOpen(!accepted);
    } catch {
      setOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const copy = useMemo(() => getCopy(locale), [locale]);

  const cards = useMemo<NoticeCard[]>(
    () =>
      copy.cards.map((card, idx) => {
        const styles = [
          "from-amber-50 to-amber-100 border-amber-200 text-amber-900",
          "from-emerald-50 to-emerald-100 border-emerald-200 text-emerald-900",
          "from-orange-50 to-orange-100 border-orange-200 text-orange-900",
          "from-sky-50 to-sky-100 border-sky-200 text-sky-900",
          "from-yellow-50 to-yellow-100 border-yellow-200 text-yellow-900",
          "from-rose-50 to-rose-100 border-rose-200 text-rose-900",
        ];
        const icons = [UserCheck, Lock, CreditCard, FileText, AlertTriangle, Siren];
        return {
          ...card,
          icon: icons[idx] ?? ShieldCheck,
          tone: styles[idx] ?? styles[0],
        };
      }),
    [copy.cards]
  );

  if (open == null || !open) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/55 px-4 py-6">
      <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-8">
        <div className="mb-6 rounded-2xl bg-gradient-to-r from-blue-700 to-blue-500 px-5 py-4 text-white shadow-lg">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-10 w-10" />
            <h2 className="text-2xl font-extrabold sm:text-4xl">{copy.title}</h2>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <article key={card.title} className={`rounded-2xl border bg-gradient-to-b p-4 shadow-sm ${card.tone}`}>
                <div className="mb-3 flex items-center gap-2 text-lg font-bold">
                  <Icon className="h-5 w-5" />
                  <span>{card.title}</span>
                </div>
                <p className="text-sm leading-relaxed">{card.body}</p>
              </article>
            );
          })}
        </div>

        <div className="mt-7 flex justify-center">
          <button
            type="button"
            onClick={() => {
              try {
                window.localStorage.setItem(SAFETY_NOTICE_KEY, "1");
              } catch {}
              setOpen(false);
            }}
            className="rounded-full bg-[#00A9C6] px-8 py-3 text-base font-semibold text-white shadow-md transition hover:brightness-110"
          >
            {copy.cta}
          </button>
        </div>
      </div>
    </div>
  );
}
