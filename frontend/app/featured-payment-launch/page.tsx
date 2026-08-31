"use client";

import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type LaunchLocale = "es" | "en" | "pt" | "it";
type LaunchStatus = "success" | "cancel" | "pending";

const LAUNCH_TEXT: Record<LaunchLocale, {
  preparingTitle: string;
  preparingDescription: string;
  connectingTitle: string;
  connectingDescription: string;
  freeTitle: string;
  freeDescription: string;
  trust: string;
  freeTrust: string;
  nextSteps: string;
  freeNextSteps: string;
}> = {
  es: {
    preparingTitle: "Preparando pago",
    preparingDescription: "Estamos generando tu checkout seguro.",
    connectingTitle: "Conectando con dLocal Go",
    connectingDescription: "Te estamos enviando al checkout seguro.",
    freeTitle: "Activando publicación destacada",
    freeDescription: "Estamos procesando tu beneficio de publicación destacada gratuita.",
    trust: "TravelGrin usa servicios seguros para proteger tus datos.",
    freeTrust: "TravelGrin valida y procesa tus beneficios promocionales de forma segura.",
    nextSteps: "Cuando cierres la ventana, recibirás por email los pasos a seguir.",
    freeNextSteps: "Recibirás por email la confirmación de tu publicación destacada.",
  },
  en: {
    preparingTitle: "Preparing payment",
    preparingDescription: "We are creating your secure checkout.",
    connectingTitle: "Connecting with dLocal Go",
    connectingDescription: "We are taking you to the secure checkout.",
    freeTitle: "Activating featured publication",
    freeDescription: "We are processing your free featured publication benefit.",
    trust: "TravelGrin uses secure services to protect your data.",
    freeTrust: "TravelGrin validates and processes your promotional benefits securely.",
    nextSteps: "You will receive confirmation and next steps by email.",
    freeNextSteps: "You will receive confirmation of your featured publication by email.",
  },
  pt: {
    preparingTitle: "Preparando pagamento",
    preparingDescription: "Estamos criando seu checkout seguro.",
    connectingTitle: "Conectando com dLocal Go",
    connectingDescription: "Estamos levando voce ao checkout seguro.",
    freeTitle: "Ativando publicação destacada",
    freeDescription: "Estamos processando seu benefício de publicação destacada gratuita.",
    trust: "A TravelGrin usa serviços seguros para proteger seus dados.",
    freeTrust: "A TravelGrin valida e processa seus benefícios promocionais com segurança.",
    nextSteps: "Depois disso, você receberá os próximos passos por e-mail.",
    freeNextSteps: "Você receberá por e-mail a confirmação da sua publicação destacada.",
  },
  it: {
    preparingTitle: "Preparazione del pagamento",
    preparingDescription: "Stiamo creando il tuo checkout sicuro.",
    connectingTitle: "Connessione con dLocal Go",
    connectingDescription: "Ti stiamo portando al checkout sicuro.",
    freeTitle: "Attivazione pubblicazione in evidenza",
    freeDescription: "Stiamo elaborando il tuo beneficio di pubblicazione in evidenza gratuita.",
    trust: "TravelGrin usa servizi sicuri per proteggere i tuoi dati.",
    freeTrust: "TravelGrin convalida e elabora i tuoi benefici promozionali in modo sicuro.",
    nextSteps: "Riceverai via email i prossimi passi.",
    freeNextSteps: "Riceverai via email la conferma della tua pubblicazione in evidenza.",
  },
};

function safeBase64Decode(value: string) {
  try {
    if (!value) return "";
    return atob(value);
  } catch {
    return "";
  }
}

function normalizeResult(raw: string): LaunchStatus {
  const value = String(raw ?? "").trim().toLowerCase();
  if (["success", "approved", "paid", "completed", "ok"].includes(value)) return "success";
  if (["pending", "processing", "in_process", "authorized"].includes(value)) return "pending";
  return "cancel";
}

type PaymentLaunchContext = {
  serviceId: string;
  locale: LaunchLocale;
  redirectUrl: string;
  launchedAt: number;
};

export default function FeaturedPaymentLaunchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectEncoded = String(searchParams.get("redirect") ?? "").trim();
  const serviceId = String(searchParams.get("serviceId") ?? "").trim();
  const status = String(searchParams.get("state") ?? "").trim().toLowerCase();
  const localeParam = String(searchParams.get("locale") ?? "es").trim().toLowerCase();
  const locale = (["es", "en", "pt", "it"].includes(localeParam) ? localeParam : "es") as LaunchLocale;
  const copy = LAUNCH_TEXT[locale];
  const redirectUrl = useMemo(() => safeBase64Decode(redirectEncoded), [redirectEncoded]);
  const storageKey = useMemo(() => `tg-featured-payment-launch:${serviceId || "unknown"}`, [serviceId]);
  const paymentContextKey = useMemo(
    () => `tg-featured-payment-context:${serviceId || "unknown"}`,
    [serviceId],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (status === "preparing") {
      if (serviceId) {
        const payload: PaymentLaunchContext = {
          serviceId,
          locale,
          redirectUrl: "",
          launchedAt: Date.now(),
        };
        try {
          window.sessionStorage.setItem(paymentContextKey, JSON.stringify(payload));
        } catch {}
      }
      return;
    }
    if (!serviceId || !redirectUrl) return;

    const payload: PaymentLaunchContext = {
      serviceId,
      locale,
      redirectUrl,
      launchedAt: Date.now(),
    };
    try {
      window.sessionStorage.setItem(paymentContextKey, JSON.stringify(payload));
    } catch {}

    const alreadyLaunched = window.sessionStorage.getItem(storageKey) === "1";
    if (!alreadyLaunched) {
      window.sessionStorage.setItem(storageKey, "1");
      window.location.replace(redirectUrl);
      return;
    }

    window.sessionStorage.removeItem(storageKey);
    fetch("/api/payments/featured/return", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceId, status: "abandoned" }),
    })
      .then((response) => response.json().catch(() => ({})))
      .then((data) => normalizeResult(String(data?.status ?? "cancelled")))
      .catch(() => "cancel" as const)
      .then((resolvedStatus) => {
        const payload = JSON.stringify({
          status: resolvedStatus,
          serviceId,
          at: Date.now(),
        });
        try {
          window.localStorage.setItem("tg-featured-payment-result", payload);
        } catch {}
        if (window.opener && !window.opener.closed) {
          try {
            window.opener.postMessage({ type: "tg-featured-payment-result", status: resolvedStatus, serviceId }, window.location.origin);
            window.opener.focus();
          } catch {}
        }
        try {
          window.close();
        } catch {}
        router.replace(`/panel-oferente?featuredPayment=${resolvedStatus}&serviceId=${encodeURIComponent(serviceId)}`);
      });
  }, [locale, paymentContextKey, redirectUrl, router, serviceId, status, storageKey]);

  const isFree = searchParams.get("isFree") === "1" || status === "free_preparing";

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-xl items-center justify-center px-4">
      <section className="w-full rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <img src="/logo-navbar.png" alt="TravelGrin" className="mx-auto mb-6 h-12 w-auto" />
        <h1 className="text-2xl font-bold text-[#273166]">
          {isFree ? copy.freeTitle : status === "preparing" ? copy.preparingTitle : copy.connectingTitle}
        </h1>
        <p className="mt-3 text-slate-600">
          {isFree ? copy.freeDescription : status === "preparing" ? copy.preparingDescription : copy.connectingDescription}
        </p>
        <div className="mt-6 rounded-2xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm leading-6 text-cyan-950">
          <p className="font-semibold">{isFree ? copy.freeTrust : copy.trust}</p>
          <p className="mt-1">{isFree ? copy.freeNextSteps : copy.nextSteps}</p>
        </div>
      </section>
    </main>
  );
}
