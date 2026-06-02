"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import ModalOferente from "@/components/ModalOferente";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCountry } from "@/app/context/CountryProvider";
import { ArrowRightLeft, BadgeCheck, Briefcase, CalendarClock, CheckCircle2, CircleDollarSign, Crown, FilePlus2, LogOut, Mail, RefreshCcw, ShieldCheck, Sparkles } from "lucide-react";

type PortalStats = {
  submissions: number;
  publications: number;
  pending: number;
  approved: number;
  freePlan: number;
  featuredPlan: number;
  monthlyPlan: number;
};

type PortalSubmission = {
  id: string;
  email: string;
  taxonomyType: string;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
  destinationCountry: string;
  profileName: string;
  planType: "basic_free" | "featured" | "monthly";
  paymentStatus: string;
  paymentType: string;
  approvedAt: string;
  expirationAt: string | null;
  category: string[];
  submittedViaPortal: boolean;
  requestKind?: string;
  previousPlan?: string;
  requestedPlan?: string;
  sourceServiceId?: string;
};

type PortalPublication = {
  id: string;
  title: string;
  status: string;
  featured: boolean;
  country: string;
  city: string;
  createdAt: string | null;
  updatedAt: string | null;
  expiration: string | null;
};

type PortalDashboard = {
  email: string;
  stats: PortalStats;
  submissions: PortalSubmission[];
  publications: PortalPublication[];
};

type PlanPriceResponseItem = {
  country: string | null;
  planType?: "featured_120d" | "featured_monthly";
  currency: "ARS" | "USD";
  amount: number;
};

type PortalSessionResponse = {
  ok: boolean;
  authenticated: boolean;
  session?: { email: string };
  dashboard?: PortalDashboard;
  error?: string;
};

function formatDate(value: string | null, locale: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : locale === "pt" ? "pt-BR" : locale === "it" ? "it-IT" : "es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function badgeClasses(kind: "pending" | "approved" | "free" | "featured" | "monthly" | "default") {
  if (kind === "pending") return "bg-amber-100 text-amber-800 border-amber-200";
  if (kind === "approved") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (kind === "free") return "bg-slate-100 text-slate-700 border-slate-200";
  if (kind === "featured") return "bg-cyan-100 text-cyan-800 border-cyan-200";
  if (kind === "monthly") return "bg-violet-100 text-violet-800 border-violet-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function formatPlanPrice(amount: number, currency: "ARS" | "USD", locale: string) {
  if (!Number.isFinite(amount) || amount <= 0) return currency === "ARS" ? "ARS 0" : "USD 0";
  return new Intl.NumberFormat(
    locale === "en" ? "en-US" : locale === "pt" ? "pt-BR" : locale === "it" ? "it-IT" : "es-AR",
    { style: "currency", currency, maximumFractionDigits: 2 },
  ).format(amount);
}

export default function ProviderPortalPanel() {
  const { locale } = useTranslation();
  const { selectedCountry } = useCountry();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [requestingLink, setRequestingLink] = useState(false);
  const [requestMessage, setRequestMessage] = useState("");
  const [requestError, setRequestError] = useState("");
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [sessionEmail, setSessionEmail] = useState("");
  const [dashboard, setDashboard] = useState<PortalDashboard | null>(null);
  const [panelError, setPanelError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [openSubmissionModal, setOpenSubmissionModal] = useState(false);
  const [modalPlanIntent, setModalPlanIntent] = useState<"basic_free" | "featured" | "monthly">("basic_free");
  const [preferredPaidPlanType, setPreferredPaidPlanType] = useState<"featured_120d" | "featured_monthly">("featured_120d");
  const [modalRequestKind, setModalRequestKind] = useState<"new_publication" | "renew_free" | "upgrade_featured_120d" | "upgrade_featured_monthly" | "downgrade_free">("new_publication");
  const [modalPreviousPlan, setModalPreviousPlan] = useState<"basic_free" | "featured" | "monthly" | undefined>(undefined);
  const [modalSourceServiceId, setModalSourceServiceId] = useState<string | undefined>(undefined);
  const [featured120Price, setFeatured120Price] = useState<PlanPriceResponseItem | null>(null);
  const [monthlyPrice, setMonthlyPrice] = useState<PlanPriceResponseItem | null>(null);

  const copy = useMemo(() => ({
    title:
      locale === "en" ? "Provider mini panel" :
      locale === "pt" ? "Mini painel do oferente" :
      locale === "it" ? "Mini pannello fornitore" :
      "Mini panel del oferente",
    subtitle:
      locale === "en" ? "Access your submissions, publications and request a new one from the same secure place." :
      locale === "pt" ? "Acesse seus envios, publicações e peça uma nova publicação do mesmo lugar seguro." :
      locale === "it" ? "Accedi ai tuoi invii, pubblicazioni e richiedi una nuova pubblicazione dallo stesso posto sicuro." :
      "Accedé a tus envíos, publicaciones y pedí una nueva publicación desde el mismo lugar seguro.",
    requestTitle:
      locale === "en" ? "Enter with a secure link" :
      locale === "pt" ? "Entrar com link seguro" :
      locale === "it" ? "Entra con link sicuro" :
      "Entrar con enlace seguro",
    requestBody:
      locale === "en" ? "Use the same email you left in your Travelgrin form. We will send you a one-time access link." :
      locale === "pt" ? "Use o mesmo email que você deixou no formulário da Travelgrin. Vamos te enviar um link de acesso de uso único." :
      locale === "it" ? "Usa la stessa email che hai lasciato nel modulo Travelgrin. Ti invieremo un link monouso." :
      "Usá el mismo email que dejaste en tu formulario de Travelgrin. Te vamos a enviar un enlace de acceso de un solo uso.",
    emailPlaceholder:
      locale === "en" ? "Your contact email" :
      locale === "pt" ? "Seu email de contato" :
      locale === "it" ? "La tua email di contatto" :
      "Tu email de contacto",
    sendLink:
      locale === "en" ? "Send secure link" :
      locale === "pt" ? "Enviar link seguro" :
      locale === "it" ? "Invia link sicuro" :
      "Enviar enlace seguro",
    sending:
      locale === "en" ? "Sending..." :
      locale === "pt" ? "Enviando..." :
      locale === "it" ? "Invio..." :
      "Enviando...",
    invalidEmail:
      locale === "en" ? "Enter a valid email." :
      locale === "pt" ? "Insira um email válido." :
      locale === "it" ? "Inserisci un'email valida." :
      "Ingresá un email válido.",
    securityHint:
      locale === "en" ? "The link expires in 20 minutes and the session stays active for 15 days on this device." :
      locale === "pt" ? "O link vence em 20 minutos e a sessão fica ativa por 15 dias neste dispositivo." :
      locale === "it" ? "Il link scade in 20 minuti e la sessione resta attiva per 15 giorni su questo dispositivo." :
      "El enlace vence en 20 minutos y la sesión queda activa por 15 días en este dispositivo.",
    accessOk:
      locale === "en" ? "Access verified. Welcome back." :
      locale === "pt" ? "Acesso verificado. Bem-vindo de volta." :
      locale === "it" ? "Accesso verificato. Bentornato." :
      "Acceso verificado. Bienvenido de nuevo.",
    accessInvalid:
      locale === "en" ? "That access link is no longer valid. Request a new one." :
      locale === "pt" ? "Esse link de acesso não é mais válido. Peça um novo." :
      locale === "it" ? "Quel link di accesso non è più valido. Richiedine uno nuovo." :
      "Ese enlace de acceso ya no es válido. Pedí uno nuevo.",
    activeSession:
      locale === "en" ? "Active session" :
      locale === "pt" ? "Sessão ativa" :
      locale === "it" ? "Sessione attiva" :
      "Sesión activa",
    logout:
      locale === "en" ? "Log out" :
      locale === "pt" ? "Salir" :
      locale === "it" ? "Esci" :
      "Cerrar sesión",
    refreshing:
      locale === "en" ? "Refreshing..." :
      locale === "pt" ? "Atualizando..." :
      locale === "it" ? "Aggiornamento..." :
      "Actualizando...",
    refresh:
      locale === "en" ? "Refresh panel" :
      locale === "pt" ? "Atualizar painel" :
      locale === "it" ? "Aggiorna pannello" :
      "Actualizar panel",
    newSubmissionHint:
      locale === "en" ? "Use this when you want to start a brand-new publication request without changing your current plan." :
      locale === "pt" ? "Use isto quando quiser iniciar um pedido de publicação totalmente novo sem mudar seu plano atual." :
      locale === "it" ? "Usa questo quando vuoi avviare una richiesta di pubblicazione completamente nuova senza cambiare il tuo piano attuale." :
      "Usá esto cuando quieras iniciar una solicitud de publicación totalmente nueva sin cambiar tu plan actual.",
    newSubmission:
      locale === "en" ? "Request another publication" :
      locale === "pt" ? "Pedir outra publicação" :
      locale === "it" ? "Richiedi un'altra pubblicazione" :
      "Pedir otra publicación",
    statsSubmissions:
      locale === "en" ? "Submitted forms" :
      locale === "pt" ? "Formulários enviados" :
      locale === "it" ? "Moduli inviati" :
      "Formularios enviados",
    statsPublications:
      locale === "en" ? "Admin-built publications" :
      locale === "pt" ? "Publicações armadas pelo admin" :
      locale === "it" ? "Pubblicazioni create dall'admin" :
      "Publicaciones armadas por admin",
    statsPending:
      locale === "en" ? "Pending review" :
      locale === "pt" ? "Pendentes de revisão" :
      locale === "it" ? "In attesa di revisione" :
      "Pendientes de revisión",
    statsPlans:
      locale === "en" ? "Plan mix" :
      locale === "pt" ? "Distribuição de planos" :
      locale === "it" ? "Mix dei piani" :
      "Distribución de planes",
    submissionsTitle:
      locale === "en" ? "Your submitted requests" :
      locale === "pt" ? "Seus pedidos enviados" :
      locale === "it" ? "Le tue richieste inviate" :
      "Tus solicitudes enviadas",
    publicationsTitle:
      locale === "en" ? "Publications visible for your account" :
      locale === "pt" ? "Publicações visíveis para sua conta" :
      locale === "it" ? "Pubblicazioni visibili per il tuo account" :
      "Publicaciones visibles para tu cuenta",
    emptySubmissions:
      locale === "en" ? "You still have no submissions with this email." :
      locale === "pt" ? "Você ainda não tem envios com este email." :
      locale === "it" ? "Non hai ancora invii con questa email." :
      "Todavía no tenés envíos con este email.",
    emptyPublications:
      locale === "en" ? "The admin has not built publications from your requests yet." :
      locale === "pt" ? "O admin ainda não armou publicações a partir dos seus pedidos." :
      locale === "it" ? "L'admin non ha ancora creato pubblicazioni dalle tue richieste." :
      "El admin todavía no armó publicaciones a partir de tus solicitudes.",
    createdAt:
      locale === "en" ? "Created" :
      locale === "pt" ? "Creado em" :
      locale === "it" ? "Creato il" :
      "Creada",
    expiresAt:
      locale === "en" ? "Expires" :
      locale === "pt" ? "Vence" :
      locale === "it" ? "Scade" :
      "Vence",
    destination:
      locale === "en" ? "Destination" :
      locale === "pt" ? "Destino" :
      locale === "it" ? "Destinazione" :
      "Destino",
    status:
      locale === "en" ? "Status" :
      locale === "pt" ? "Estado" :
      locale === "it" ? "Stato" :
      "Estado",
    payment:
      locale === "en" ? "Payment" :
      locale === "pt" ? "Pagamento" :
      locale === "it" ? "Pagamento" :
      "Pago",
    featured:
      locale === "en" ? "Featured 120 days" :
      locale === "pt" ? "Destaque 120 dias" :
      locale === "it" ? "In evidenza 120 giorni" :
      "Destacado 120 días",
    monthly:
      locale === "en" ? "Monthly plan" :
      locale === "pt" ? "Plano mensal" :
      locale === "it" ? "Piano mensile" :
      "Plan mensual",
    free:
      locale === "en" ? "Free 60 days" :
      locale === "pt" ? "Grátis 60 dias" :
      locale === "it" ? "Gratis 60 giorni" :
      "Gratis 60 días",
    planSelectorTitle:
      locale === "en" ? "Choose how you want to continue" :
      locale === "pt" ? "Escolha como vocÃª quer continuar" :
      locale === "it" ? "Scegli come vuoi continuare" :
      "ElegÃ­ cÃ³mo querÃ©s continuar",
    planSelectorBody:
      locale === "en" ? "Stay free, upgrade to featured for 120 days, or switch to a monthly plan. Paid plans use the prices configured by the admin for your passport country." :
      locale === "pt" ? "Continue no gratuito, passe para destaque por 120 dias ou mude para o plano mensal. Os planos pagos usam os preÃ§os configurados pelo admin para o paÃ­s do seu passaporte." :
      locale === "it" ? "Resta nel gratuito, passa all'evidenza per 120 giorni oppure attiva il piano mensile. I piani a pagamento usano i prezzi configurati dall'admin per il paese del tuo passaporto." :
      "SeguÃ­ en gratis, pasÃ¡ a destacado por 120 dÃ­as o cambiÃ¡ al plan mensual. Los planes pagos usan los precios configurados por el admin para el paÃ­s de tu pasaporte.",
    freeCta:
      locale === "en" ? "Renew / request free" :
      locale === "pt" ? "Renovar / pedir grÃ¡tis" :
      locale === "it" ? "Rinnova / richiedi gratis" :
      "Renovar / pedir gratis",
    featuredCta:
      locale === "en" ? "Switch to featured 120 days" :
      locale === "pt" ? "Passar para destaque 120 dias" :
      locale === "it" ? "Passa a evidenza 120 giorni" :
      "Pasar a destacado 120 dÃ­as",
    monthlyCta:
      locale === "en" ? "Switch to monthly plan" :
      locale === "pt" ? "Passar para plano mensal" :
      locale === "it" ? "Passa al piano mensile" :
      "Pasar a plan mensual",
    freeDescription:
      locale === "en" ? "Visible in the listing for 60 days. When it expires, you can renew it from here and the request goes back to the admin." :
      locale === "pt" ? "VisÃ­vel na listagem por 60 dias. Quando vencer, vocÃª pode renovar por aqui e o pedido volta para o admin." :
      locale === "it" ? "Visibile nell'elenco per 60 giorni. Quando scade, puoi rinnovarlo da qui e la richiesta torna all'admin." :
      "Visible en el listado por 60 dÃ­as. Cuando vence, podÃ©s renovarla desde acÃ¡ y la solicitud vuelve al admin.",
    featuredDescription:
      locale === "en" ? "One-time payment. Includes the same featured benefits from the publication form for 120 days." :
      locale === "pt" ? "Pagamento Ãºnico. Inclui os mesmos benefÃ­cios destacados do formulÃ¡rio de publicaÃ§Ã£o por 120 dias." :
      locale === "it" ? "Pagamento unico. Include gli stessi vantaggi in evidenza del modulo di pubblicazione per 120 giorni." :
      "Pago Ãºnico. Incluye los mismos beneficios destacados del formulario de publicaciÃ³n por 120 dÃ­as.",
    monthlyDescription:
      locale === "en" ? "Recurring monthly billing with the same featured benefits to keep your publication boosted continuously." :
      locale === "pt" ? "CobranÃ§a mensal recorrente com os mesmos benefÃ­cios destacados para manter sua publicaÃ§Ã£o impulsionada de forma continua." :
      locale === "it" ? "Addebito mensile ricorrente con gli stessi vantaggi del piano in evidenza per mantenere la tua pubblicazione potenziata in modo continuo." :
      "Cobro mensual recurrente con los mismos beneficios destacados para mantener tu publicaciÃ³n impulsionada de forma continua.",
    includesTitle:
      locale === "en" ? "Includes" :
      locale === "pt" ? "Inclui" :
      locale === "it" ? "Include" :
      "Incluye",
    noPriceConfigured:
      locale === "en" ? "Price not configured yet" :
      locale === "pt" ? "PreÃ§o ainda nÃ£o configurado" :
      locale === "it" ? "Prezzo non ancora configurato" :
      "Precio todavÃ­a no configurado",
    priceUnavailableHint:
      locale === "en" ? "The admin still needs to configure this price for your passport country." :
      locale === "pt" ? "O admin ainda precisa configurar este preço para o país do seu passaporte." :
      locale === "it" ? "L'admin deve ancora configurare questo prezzo per il paese del tuo passaporto." :
      "El admin todavía tiene que configurar este precio para el país de tu pasaporte.",
  }), [locale]);

  const portalStatus = String(searchParams.get("portal_status") ?? "").trim().toLowerCase();

  const planCopy = useMemo(() => ({
    currentPlan:
      locale === "en" ? "Current plan" :
      locale === "pt" ? "Plano atual" :
      locale === "it" ? "Piano attuale" :
      "Plan actual",
    currentPlanBody:
      locale === "en" ? "From here you can renew your free publication, upgrade to a paid plan, or request going back to free." :
      locale === "pt" ? "Daqui voce pode renovar sua publicacao gratuita, mudar para um plano pago ou pedir para voltar ao gratuito." :
      locale === "it" ? "Da qui puoi rinnovare la tua pubblicazione gratuita, passare a un piano a pagamento o chiedere di tornare al gratuito." :
      "Desde aca podes renovar tu publicacion gratuita, pasar a un plan pago o pedir volver al gratuito.",
    currentBadge:
      locale === "en" ? "Current" :
      locale === "pt" ? "Atual" :
      locale === "it" ? "Attuale" :
      "Actual",
    renewFree:
      locale === "en" ? "Renew free publication" :
      locale === "pt" ? "Renovar publicacao gratuita" :
      locale === "it" ? "Rinnova pubblicazione gratuita" :
      "Renovar publicacion gratuita",
    goBackFree:
      locale === "en" ? "Request going back to free" :
      locale === "pt" ? "Pedir volta ao gratuito" :
      locale === "it" ? "Richiedi ritorno al gratuito" :
      "Pedir volver al gratis",
    currentFeatured:
      locale === "en" ? "You already have the 120-day featured plan." :
      locale === "pt" ? "Voce ja tem o destaque de 120 dias." :
      locale === "it" ? "Hai gia il piano in evidenza da 120 giorni." :
      "Ya tenes el plan destacado de 120 dias.",
    currentMonthly:
      locale === "en" ? "You already have the monthly plan active." :
      locale === "pt" ? "Voce ja tem o plano mensal ativo." :
      locale === "it" ? "Hai gia il piano mensile attivo." :
      "Ya tenes el plan mensual activo.",
    requestType:
      locale === "en" ? "Request" :
      locale === "pt" ? "Solicitud" :
      locale === "it" ? "Richiesta" :
      "Solicitud",
    requestNew:
      locale === "en" ? "New publication" :
      locale === "pt" ? "Nova publicacao" :
      locale === "it" ? "Nuova pubblicazione" :
      "Nueva publicacion",
    requestRenew:
      locale === "en" ? "Free renewal" :
      locale === "pt" ? "Renovacao gratuita" :
      locale === "it" ? "Rinnovo gratuito" :
      "Renovacion gratis",
    requestUpgrade120:
      locale === "en" ? "Upgrade to featured 120 days" :
      locale === "pt" ? "Upgrade para destaque 120 dias" :
      locale === "it" ? "Upgrade a evidenza 120 giorni" :
      "Upgrade a destacado 120 dias",
    requestUpgradeMonthly:
      locale === "en" ? "Upgrade to monthly plan" :
      locale === "pt" ? "Upgrade para plano mensal" :
      locale === "it" ? "Upgrade a piano mensile" :
      "Upgrade a plan mensual",
    requestDowngrade:
      locale === "en" ? "Request return to free" :
      locale === "pt" ? "Pedir retorno ao gratuito" :
      locale === "it" ? "Richiedi ritorno al gratuito" :
      "Pedir retorno al gratis",
  }), [locale]);

  const loadSession = useCallback(async () => {
    setLoading(true);
    setPanelError("");
    try {
      const response = await fetch("/api/provider-portal/session", { cache: "no-store", credentials: "include" });
      const data = (await response.json().catch(() => ({}))) as PortalSessionResponse;
      if (!response.ok || data?.ok === false) {
        throw new Error(String(data?.error ?? "No se pudo cargar el mini panel."));
      }
      setAuthenticated(Boolean(data.authenticated));
      setSessionEmail(String(data?.session?.email ?? ""));
      setDashboard(data?.dashboard ?? null);
    } catch (error) {
      setAuthenticated(false);
      setDashboard(null);
      setPanelError(error instanceof Error ? error.message : "No se pudo cargar el mini panel.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  useEffect(() => {
    const country = String(selectedCountry ?? "").trim();
    const buildUrl = (planType: "featured_120d" | "featured_monthly") =>
      `/api/featured-plan-pricing?country=${encodeURIComponent(country)}&planType=${encodeURIComponent(planType)}`;

    Promise.all([
      fetch(buildUrl("featured_120d"), { cache: "no-store" }).then((res) => res.json()).catch(() => ({})),
      fetch(buildUrl("featured_monthly"), { cache: "no-store" }).then((res) => res.json()).catch(() => ({})),
    ]).then(([featuredData, monthlyData]) => {
      setFeatured120Price((featuredData?.item ?? null) as PlanPriceResponseItem | null);
      setMonthlyPrice((monthlyData?.item ?? null) as PlanPriceResponseItem | null);
    }).catch(() => {
      setFeatured120Price(null);
      setMonthlyPrice(null);
    });
  }, [selectedCountry]);

  const submitRequestAccess = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setRequestError(copy.invalidEmail);
      return;
    }
    setRequestingLink(true);
    setRequestMessage("");
    setRequestError("");
    try {
      const response = await fetch("/api/provider-portal/request-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: normalizedEmail, locale }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) {
        throw new Error(String(data?.error ?? "No se pudo enviar el enlace seguro."));
      }
      setRequestMessage(String(data?.message ?? ""));
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "No se pudo enviar el enlace seguro.");
    } finally {
      setRequestingLink(false);
    }
  };

  const logout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/provider-portal/logout", {
        method: "POST",
        credentials: "include",
      });
      setAuthenticated(false);
      setSessionEmail("");
      setDashboard(null);
    } finally {
      setLoggingOut(false);
    }
  };

  const planBadge = (planType: PortalSubmission["planType"]) => {
    if (planType === "featured") return { label: copy.featured, kind: "featured" as const };
    if (planType === "monthly") return { label: copy.monthly, kind: "monthly" as const };
    return { label: copy.free, kind: "free" as const };
  };

  const planBenefits = useMemo(() => ({
    featured: [
      locale === "en" ? "Appears first in results" : locale === "pt" ? "Aparece primeiro nos resultados" : locale === "it" ? "Appare per prima nei risultati" : "Aparece primero en resultados",
      locale === "en" ? "Expanded description" : locale === "pt" ? "DescriÃ§Ã£o ampliada" : locale === "it" ? "Descrizione ampliata" : "DescripciÃ³n ampliada",
      locale === "en" ? "Multiple contact links" : locale === "pt" ? "VÃ¡rios links de contato" : locale === "it" ? "PiÃ¹ link di contatto" : "Varios links de contacto",
      locale === "en" ? "Available in 4 languages" : locale === "pt" ? "DisponÃ­vel em 4 idiomas" : locale === "it" ? "Disponibile in 4 lingue" : "Disponible en 4 idiomas",
      locale === "en" ? "Gallery up to 5 images" : locale === "pt" ? "Galeria de atÃ© 5 imagens" : locale === "it" ? "Galleria fino a 5 immagini" : "GalerÃ­a hasta 5 imÃ¡genes",
    ],
    free: [
      locale === "en" ? "Visible in the general listing" : locale === "pt" ? "VisÃ­vel na listagem geral" : locale === "it" ? "Visibile nell'elenco generale" : "Visible en el listado general",
      locale === "en" ? "Brief description" : locale === "pt" ? "DescriÃ§Ã£o breve" : locale === "it" ? "Descrizione breve" : "DescripciÃ³n breve",
      locale === "en" ? "1 contact link" : locale === "pt" ? "1 link de contato" : locale === "it" ? "1 link di contatto" : "1 link de contacto",
    ],
  }), [locale]);

  const featured120Label = featured120Price
    ? formatPlanPrice(Number(featured120Price.amount ?? 0), featured120Price.currency ?? "USD", locale)
    : copy.noPriceConfigured;
  const monthlyLabel = monthlyPrice
    ? formatPlanPrice(Number(monthlyPrice.amount ?? 0), monthlyPrice.currency ?? "USD", locale)
    : copy.noPriceConfigured;
  const latestApprovedSubmission = useMemo(() => {
    const submissions = [...(dashboard?.submissions ?? [])];
    submissions.sort((a, b) => {
      const aTime = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime();
      const bTime = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime();
      return bTime - aTime;
    });
    return submissions.find((item) => {
      const status = String(item.status ?? "").trim().toLowerCase();
      return ["aprobado", "approved", "active", "activo", "paid"].includes(status);
    }) ?? submissions[0] ?? null;
  }, [dashboard?.submissions]);

  const latestVisiblePublication = useMemo(() => {
    const publications = [...(dashboard?.publications ?? [])];
    publications.sort((a, b) => {
      const aTime = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime();
      const bTime = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime();
      return bTime - aTime;
    });
    return publications[0] ?? null;
  }, [dashboard?.publications]);

  const currentPlanType = latestApprovedSubmission?.planType ?? "basic_free";
  const currentPlanCreatedAt = latestVisiblePublication?.createdAt ?? latestApprovedSubmission?.createdAt ?? null;
  const currentPlanExpiresAt = latestVisiblePublication?.expiration ?? latestApprovedSubmission?.expirationAt ?? null;

  const requestKindLabel = useCallback((value?: string) => {
    const normalized = String(value ?? "").trim().toLowerCase();
    if (normalized === "renew_free") return planCopy.requestRenew;
    if (normalized === "upgrade_featured_120d") return planCopy.requestUpgrade120;
    if (normalized === "upgrade_featured_monthly") return planCopy.requestUpgradeMonthly;
    if (normalized === "downgrade_free") return planCopy.requestDowngrade;
    return planCopy.requestNew;
  }, [planCopy]);

  const openPlanRequest = useCallback((plan: "basic_free" | "featured" | "monthly") => {
    const previous = currentPlanType === "featured" || currentPlanType === "monthly" ? currentPlanType : "basic_free";
    let requestKind: "new_publication" | "renew_free" | "upgrade_featured_120d" | "upgrade_featured_monthly" | "downgrade_free" = "new_publication";
    if (plan === "basic_free") {
      if (latestApprovedSubmission?.id) {
        requestKind = previous === "basic_free" ? "renew_free" : "downgrade_free";
      }
    } else if (plan === "featured") {
      requestKind = "upgrade_featured_120d";
    } else {
      requestKind = "upgrade_featured_monthly";
    }
    setModalPlanIntent(plan);
    setPreferredPaidPlanType(plan === "monthly" ? "featured_monthly" : "featured_120d");
    setModalRequestKind(requestKind);
    setModalPreviousPlan(previous);
    setModalSourceServiceId(latestApprovedSubmission?.id);
    setOpenSubmissionModal(true);
  }, [currentPlanType, latestApprovedSubmission?.id]);

  const openNewPublicationRequest = useCallback(() => {
    setModalPlanIntent("basic_free");
    setPreferredPaidPlanType("featured_120d");
    setModalRequestKind("new_publication");
    setModalPreviousPlan(undefined);
    setModalSourceServiceId(undefined);
    setOpenSubmissionModal(true);
  }, []);

  const planCards = useMemo(() => {
    const currentIsFree = currentPlanType === "basic_free";
    const currentIsFeatured = currentPlanType === "featured";
    const currentIsMonthly = currentPlanType === "monthly";
    const featuredReady = Boolean(featured120Price && Number(featured120Price.amount ?? 0) > 0);
    const monthlyReady = Boolean(monthlyPrice && Number(monthlyPrice.amount ?? 0) > 0);
    return [
      {
        key: "free",
        icon: ShieldCheck,
        title: copy.free,
        description: copy.freeDescription,
        price: locale === "en" ? "Free" : locale === "pt" ? "Gratis" : locale === "it" ? "Gratis" : "Gratis",
        benefits: planBenefits.free,
        current: currentIsFree,
        disabled: false,
        helper: copy.newSubmissionHint,
        actionLabel: currentIsFree ? planCopy.renewFree : planCopy.goBackFree,
        action: () => openPlanRequest("basic_free"),
      },
      {
        key: "featured",
        icon: Crown,
        title: copy.featured,
        description: copy.featuredDescription,
        price: featured120Label,
        benefits: planBenefits.featured,
        current: currentIsFeatured,
        disabled: currentIsFeatured || !featuredReady,
        helper: currentIsFeatured ? planCopy.currentFeatured : featuredReady ? "" : copy.priceUnavailableHint,
        actionLabel: currentIsFeatured ? planCopy.currentFeatured : copy.featuredCta,
        action: () => openPlanRequest("featured"),
      },
      {
        key: "monthly",
        icon: Sparkles,
        title: copy.monthly,
        description: copy.monthlyDescription,
        price: monthlyLabel,
        benefits: planBenefits.featured,
        current: currentIsMonthly,
        disabled: currentIsMonthly || !monthlyReady,
        helper: currentIsMonthly ? planCopy.currentMonthly : monthlyReady ? "" : copy.priceUnavailableHint,
        actionLabel: currentIsMonthly ? planCopy.currentMonthly : copy.monthlyCta,
        action: () => openPlanRequest("monthly"),
      },
    ];
  }, [copy.featured, copy.featuredCta, copy.featuredDescription, copy.free, copy.freeDescription, copy.monthly, copy.monthlyCta, copy.monthlyDescription, copy.newSubmissionHint, copy.priceUnavailableHint, currentPlanType, featured120Label, featured120Price, locale, monthlyLabel, monthlyPrice, openPlanRequest, planBenefits.featured, planBenefits.free, planCopy.currentFeatured, planCopy.currentMonthly, planCopy.goBackFree, planCopy.renewFree]);

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <RefreshCcw className="h-4 w-4 animate-spin" />
          {copy.refreshing}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">{copy.title}</h2>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">{copy.subtitle}</p>
            </div>
            {authenticated ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                <div className="flex items-center gap-2 font-semibold">
                  <ShieldCheck className="h-4 w-4" />
                  {copy.activeSession}
                </div>
                <div className="mt-1 break-all text-xs">{sessionEmail}</div>
              </div>
            ) : null}
          </div>

          {portalStatus === "ok" && authenticated ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {copy.accessOk}
            </div>
          ) : null}
          {portalStatus === "invalid" ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {copy.accessInvalid}
            </div>
          ) : null}
          {panelError ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {panelError}
            </div>
          ) : null}
        </div>

        {!authenticated ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="max-w-2xl">
              <h3 className="text-lg font-semibold text-slate-900">{copy.requestTitle}</h3>
              <p className="mt-2 text-sm text-slate-600">{copy.requestBody}</p>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      if (requestError) setRequestError("");
                    }}
                    placeholder={copy.emailPlaceholder}
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-[#0B8FA3]/25"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void submitRequestAccess()}
                  disabled={requestingLink}
                  className="rounded-2xl bg-[#0B8FA3] px-5 py-3 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
                >
                  {requestingLink ? copy.sending : copy.sendLink}
                </button>
              </div>
              {requestError ? <p className="mt-3 text-sm text-red-600">{requestError}</p> : null}
              {requestMessage ? <p className="mt-3 text-sm text-emerald-700">{requestMessage}</p> : null}
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                {copy.securityHint}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3 text-slate-500"><FilePlus2 className="h-4 w-4" /> <span className="text-xs font-semibold uppercase tracking-wide">{copy.statsSubmissions}</span></div>
                <div className="mt-3 text-3xl font-semibold text-slate-900">{dashboard?.stats.submissions ?? 0}</div>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3 text-slate-500"><Briefcase className="h-4 w-4" /> <span className="text-xs font-semibold uppercase tracking-wide">{copy.statsPublications}</span></div>
                <div className="mt-3 text-3xl font-semibold text-slate-900">{dashboard?.stats.publications ?? 0}</div>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3 text-slate-500"><CalendarClock className="h-4 w-4" /> <span className="text-xs font-semibold uppercase tracking-wide">{copy.statsPending}</span></div>
                <div className="mt-3 text-3xl font-semibold text-slate-900">{dashboard?.stats.pending ?? 0}</div>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3 text-slate-500"><CircleDollarSign className="h-4 w-4" /> <span className="text-xs font-semibold uppercase tracking-wide">{copy.statsPlans}</span></div>
                <div className="mt-3 space-y-2">
                  <div className="text-sm font-semibold text-slate-900">{planCopy.currentPlan}</div>
                  <div className="flex flex-wrap gap-2">
                    {currentPlanCreatedAt ? (
                      <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">
                        {copy.createdAt}: {formatDate(currentPlanCreatedAt, locale)}
                      </span>
                    ) : null}
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeClasses(currentPlanType === "monthly" ? "monthly" : currentPlanType === "featured" ? "featured" : "free")}`}>
                      {currentPlanType === "monthly" ? copy.monthly : currentPlanType === "featured" ? copy.featured : copy.free}
                    </span>
                    {currentPlanExpiresAt ? (
                      <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">
                        {copy.expiresAt}: {formatDate(currentPlanExpiresAt, locale)}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs leading-relaxed text-slate-500">{planCopy.currentPlanBody}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={openNewPublicationRequest}
                className="rounded-2xl bg-[#0B8FA3] px-5 py-3 text-sm font-semibold text-white hover:opacity-95"
              >
                {copy.newSubmission}
              </button>
              <button
                type="button"
                onClick={() => void loadSession()}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                {copy.refresh}
              </button>
              <button
                type="button"
                onClick={() => void logout()}
                disabled={loggingOut}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                <LogOut className="h-4 w-4" />
                {copy.logout}
              </button>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              {planCards.map((card) => {
                const Icon = card.icon;
                return (
                  <div key={card.key} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0B8FA3]/10 text-[#0B8FA3]">
                        <Icon className="h-5 w-5" />
                      </div>
                      {card.current ? (
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                          {planCopy.currentBadge}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-4">
                      <div className="text-lg font-semibold text-slate-900">{card.title}</div>
                      <div className="mt-1 text-2xl font-bold text-slate-900">{card.price}</div>
                      <p className="mt-3 text-sm leading-relaxed text-slate-600">{card.description}</p>
                    </div>
                    <div className="mt-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{copy.includesTitle}</div>
                      <ul className="mt-2 space-y-2 text-sm text-slate-600">
                        {card.benefits.map((benefit) => (
                          <li key={`${card.key}-${benefit}`} className="flex items-start gap-2">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
                            <span>{benefit}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    {card.helper ? (
                      <p className="mt-4 text-xs leading-relaxed text-slate-500">{card.helper}</p>
                    ) : null}
                    <button
                      type="button"
                      onClick={card.action}
                      disabled={card.disabled}
                      className={`mt-5 w-full rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                        card.current || card.disabled
                          ? "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-80"
                          : "bg-[#0B8FA3] text-white hover:opacity-95"
                      }`}
                    >
                      {card.actionLabel}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900">{copy.submissionsTitle}</h3>
                <div className="mt-4 space-y-3">
                  {dashboard?.submissions.length ? dashboard.submissions.map((item) => {
                    const plan = planBadge(item.planType);
                    const statusKind = ["aprobado", "approved", "active", "paid"].includes(String(item.status).toLowerCase()) ? "approved" : "pending";
                    return (
                      <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900">{item.profileName || item.email}</span>
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${badgeClasses(plan.kind)}`}>{plan.label}</span>
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${badgeClasses(statusKind)}`}>{copy.status}: {item.status || "-"}</span>
                        </div>
                        <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                          <div><span className="font-medium text-slate-800">{copy.destination}:</span> {item.destinationCountry || "-"}</div>
                          <div><span className="font-medium text-slate-800">{copy.payment}:</span> {item.paymentStatus || "-"}</div>
                          <div><span className="font-medium text-slate-800">{copy.createdAt}:</span> {formatDate(item.createdAt, locale)}</div>
                          <div><span className="font-medium text-slate-800">{copy.expiresAt}:</span> {formatDate(item.expirationAt, locale)}</div>
                          <div className="sm:col-span-2"><span className="font-medium text-slate-800">{planCopy.requestType}:</span> {requestKindLabel(item.requestKind)}</div>
                          {item.previousPlan ? (
                            <div><span className="font-medium text-slate-800">{locale === "en" ? "Previous plan" : locale === "pt" ? "Plano anterior" : locale === "it" ? "Piano precedente" : "Plan anterior"}:</span> {item.previousPlan === "monthly" ? copy.monthly : item.previousPlan === "featured" ? copy.featured : copy.free}</div>
                          ) : null}
                          {item.requestedPlan ? (
                            <div><span className="font-medium text-slate-800">{locale === "en" ? "Requested plan" : locale === "pt" ? "Plano solicitado" : locale === "it" ? "Piano richiesto" : "Plan solicitado"}:</span> {item.requestedPlan === "featured_monthly" || item.requestedPlan === "monthly" ? copy.monthly : item.requestedPlan === "featured_120d" || item.requestedPlan === "featured" ? copy.featured : copy.free}</div>
                          ) : null}
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                      {copy.emptySubmissions}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900">{copy.publicationsTitle}</h3>
                <div className="mt-4 space-y-3">
                  {dashboard?.publications.length ? dashboard.publications.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">{item.title || item.id}</span>
                        {item.featured ? (
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${badgeClasses("featured")}`}>{copy.featured}</span>
                        ) : (
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${badgeClasses("free")}`}>{copy.free}</span>
                        )}
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${badgeClasses(item.status?.toLowerCase() === "approved" ? "approved" : "default")}`}>{copy.status}: {item.status || "-"}</span>
                      </div>
                      <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                        <div><span className="font-medium text-slate-800">{copy.destination}:</span> {[item.city, item.country].filter(Boolean).join(", ") || "-"}</div>
                        <div><span className="font-medium text-slate-800">{copy.createdAt}:</span> {formatDate(item.createdAt, locale)}</div>
                        <div><span className="font-medium text-slate-800">{copy.expiresAt}:</span> {formatDate(item.expiration, locale)}</div>
                      </div>
                    </div>
                  )) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                      {copy.emptyPublications}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {openSubmissionModal && sessionEmail ? (
        <ModalOferente
          onClose={() => setOpenSubmissionModal(false)}
          initialEmail={sessionEmail}
          lockEmail
          showMonthlyPlanOption
          initialPlan={modalPlanIntent}
          preferredPaidPlanType={preferredPaidPlanType}
          requestKind={modalRequestKind}
          previousPlan={modalPreviousPlan}
          sourceServiceId={modalSourceServiceId}
          onSubmitted={() => {
            setOpenSubmissionModal(false);
            void loadSession();
          }}
        />
      ) : null}
    </>
  );
}
