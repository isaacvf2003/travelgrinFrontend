"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import ModalOferente from "@/components/ModalOferente";
import TurnstileWidget from "@/components/TurnstileWidget";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCountry } from "@/app/context/CountryProvider";
import { Briefcase, CalendarClock, CheckCircle2, CircleDollarSign, Crown, FilePlus2, LogOut, Mail, RefreshCcw, ShieldCheck, Sparkles } from "lucide-react";

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
  statusReason?: string;
  statusUpdatedAt?: string;
  refundStatus?: string;
  refundRequestedAt?: string;
  refundReviewedAt?: string;
  refundApprovedAt?: string;
  refundRejectedAt?: string;
  refundProcessingAt?: string;
  refundedAt?: string;
  refundFailedAt?: string;
  refundReason?: string;
  refundAdminReason?: string;
  refundAmount?: number | null;
  refundCurrency?: string;
  refundProviderReference?: string;
  paymentReturnStatus?: string;
  createdAt: string | null;
  updatedAt: string | null;
  country: string;
  destinationCountry: string;
  profileName: string;
  planType: "basic_free" | "featured" | "monthly";
  paymentStatus: string;
  providerPaymentId?: string;
  paymentType: string;
  monthlyAutoRenew?: boolean;
  monthlySubscriptionStatus?: string;
  monthlySubscriptionCancelledAt?: string;
  approvedAt: string;
  expirationAt: string | null;
  category: string[];
  submittedViaPortal: boolean;
  requestKind?: string;
  previousPlan?: string;
  requestedPlan?: string;
  sourceServiceId?: string;
  whatSearchingRaw?: string;
  draftData?: Record<string, unknown>;
  resubmittedAt?: string;
  resumeUrl?: string;
};

type PortalPublication = {
  id: string;
  title: string;
  description?: string;
  category?: string;
  subcategory?: string;
  status: string;
  featured: boolean;
  country: string;
  headquarterCountry?: string;
  city: string;
  price?: string;
  currency?: string;
  languages?: string[];
  images?: string[];
  website?: string;
  socialLinks?: string[];
  createdAt: string | null;
  updatedAt: string | null;
  expiration: string | null;
  providerEmail?: string;
  providerName?: string;
  planType?: "basic_free" | "featured" | "monthly";
  sourceServiceId?: string;
  requestKind?: string;
  previousPlan?: string;
  requestedPlan?: string;
  relatedSubmissionId?: string;
  relatedProfileName?: string;
  monthlyAutoRenew?: boolean;
  monthlySubscriptionStatus?: string;
  monthlySubscriptionCancelledAt?: string;
  fields?: Record<string, unknown>;
};

type PortalDashboard = {
  email: string;
  stats: PortalStats;
  submissions: PortalSubmission[];
  publications: PortalPublication[];
};

type VisiblePublicationEntry = {
  publication: PortalPublication;
  relatedSubmission: PortalSubmission | null;
  effectivePlanType: "basic_free" | "featured" | "monthly";
  effectiveExpiration: string | null;
  needsInfoSubmission: PortalSubmission | null;
  monthlyCancellationScheduled: boolean;
  monthlyCancellationAt: string | null;
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

function badgeClasses(kind: "pending" | "approved" | "rejected" | "needsInfo" | "free" | "featured" | "monthly" | "default") {
  if (kind === "pending") return "bg-amber-100 text-amber-800 border-amber-200";
  if (kind === "approved") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (kind === "rejected") return "bg-rose-100 text-rose-800 border-rose-200";
  if (kind === "needsInfo") return "bg-orange-100 text-orange-800 border-orange-200";
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

function normalizePortalPlanType(value: unknown): "basic_free" | "featured" | "monthly" {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "featured" || raw === "featured_120d") return "featured";
  if (raw === "monthly" || raw === "featured_monthly") return "monthly";
  return "basic_free";
}

function hasMonthlyCancellationScheduled(value: {
  planType?: "basic_free" | "featured" | "monthly";
  monthlyAutoRenew?: boolean;
  monthlySubscriptionStatus?: string;
} | null | undefined) {
  if (!value || value.planType !== "monthly") return false;
  return (
    value.monthlyAutoRenew === false ||
    String(value.monthlySubscriptionStatus ?? "").trim().toLowerCase() === "cancelled"
  );
}

function normalizeBrokenLatinText(value: string) {
  return value
    .replace(/Ã¡/g, "á")
    .replace(/Ã©/g, "é")
    .replace(/Ã­/g, "í")
    .replace(/Ã³/g, "ó")
    .replace(/Ãº/g, "ú")
    .replace(/Ã±/g, "ñ")
    .replace(/Ã¼/g, "ü")
    .replace(/Â¿/g, "¿")
    .replace(/Â¡/g, "¡")
    .replace(/Â°/g, "°");
}

function decodeLikelyMojibake(value: string) {
  if (!/[ÃÂâðï¿½]/.test(value)) return value;
  let current = value;
  for (let index = 0; index < 3; index += 1) {
    try {
      const bytes = Uint8Array.from(current, (char) => char.charCodeAt(0));
      const decoded = new TextDecoder("utf-8").decode(bytes);
      if (!decoded || decoded === current) break;
      current = decoded;
      if (!/[ÃÂâðï¿½]/.test(current)) break;
    } catch {
      break;
    }
  }
  return normalizePortalMojibake(current);
}

function normalizePortalMojibake(value: string) {
  return normalizeBrokenLatinText(
    value
      .replace(/ÃƒÂ¡/g, "\u00e1")
      .replace(/ÃƒÂ©/g, "\u00e9")
      .replace(/ÃƒÂ­/g, "\u00ed")
      .replace(/ÃƒÂ³/g, "\u00f3")
      .replace(/ÃƒÂº/g, "\u00fa")
      .replace(/ÃƒÂ±/g, "\u00f1")
      .replace(/ÃƒÂ¼/g, "\u00fc")
      .replace(/Ã¡/g, "\u00e1")
      .replace(/Ã©/g, "\u00e9")
      .replace(/Ã­/g, "\u00ed")
      .replace(/Ã³/g, "\u00f3")
      .replace(/Ãº/g, "\u00fa")
      .replace(/Ã±/g, "\u00f1")
      .replace(/Ã¼/g, "\u00fc")
      .replace(/Ã‚Â¿/g, "\u00bf")
      .replace(/Ã‚Â¡/g, "\u00a1")
      .replace(/Ã‚Â°/g, "\u00b0")
      .replace(/Â¿/g, "\u00bf")
      .replace(/Â¡/g, "\u00a1")
      .replace(/Â°/g, "\u00b0"),
  );
}

function sanitizePortalVisibleTree<T>(value: T): T {
  if (typeof value === "string") return normalizePortalUiText(normalizePortalVisibleCopy(cleanPortalCopy(value as string))) as T;
  if (Array.isArray(value)) return value.map((entry) => sanitizePortalVisibleTree(entry)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, sanitizePortalVisibleTree(entry as unknown)])) as T;
  }
  return value;
}

function normalizePortalUiText(value: string) {
  return String(value ?? "")
    .replace(/ÃƒÂ¡/g, "\u00e1")
    .replace(/ÃƒÂ©/g, "\u00e9")
    .replace(/ÃƒÂ­/g, "\u00ed")
    .replace(/ÃƒÂ³/g, "\u00f3")
    .replace(/ÃƒÂº/g, "\u00fa")
    .replace(/ÃƒÂ±/g, "\u00f1")
    .replace(/ÃƒÂ¼/g, "\u00fc")
    .replace(/Ã‚Â¿/g, "\u00bf")
    .replace(/Ã‚Â¡/g, "\u00a1")
    .replace(/Ã‚Â°/g, "\u00b0")
    .replace(/Ã¡/g, "\u00e1")
    .replace(/Ã©/g, "\u00e9")
    .replace(/Ã­/g, "\u00ed")
    .replace(/Ã³/g, "\u00f3")
    .replace(/Ãº/g, "\u00fa")
    .replace(/Ã±/g, "\u00f1")
    .replace(/Ã¼/g, "\u00fc")
    .replace(/Â¿/g, "\u00bf")
    .replace(/Â¡/g, "\u00a1")
    .replace(/Â°/g, "\u00b0")
    .replace(/publicaciÒ³n/gi, "publicaci\u00f3n")
    .replace(/descripciÒ³n/gi, "descripci\u00f3n")
    .replace(/revisiÒ³n/gi, "revisi\u00f3n")
    .replace(/secciÒ³n/gi, "secci\u00f3n")
    .replace(/enviÒ³/gi, "envi\u00f3")
    .replace(/categorÒ­a/gi, "categor\u00eda")
    .replace(/subcategorÒ­a/gi, "subcategor\u00eda")
    .replace(/tÒ­tulo/gi, "t\u00edtulo")
    .replace(/paÒ­s/gi, "pa\u00eds")
    .replace(/podÒ©s/gi, "pod\u00e9s")
    .replace(/querÒ©s/gi, "quer\u00e9s")
    .replace(/acÒ¡/gi, "ac\u00e1")
    .replace(/dÒ­as/gi, "d\u00edas")
    .replace(/Òºnico/gi, "\u00fanico")
    .replace(/galerÒ­a/gi, "galer\u00eda")
    .replace(/imÒ¡genes/gi, "im\u00e1genes")
    .replace(/sesiÒ³n/gi, "sesi\u00f3n")
    .replace(/ÃƒÆ’Ã‚Â/g, "")
    .replace(/ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚/g, "")
    .replace(/Ãƒâ€š/g, "")
    .replace(/ÃƒÆ’/g, "")
    .replace(/Ãƒâ€°/g, "\u00c9")
    .replace(/Ãƒâ€œ/g, "\u00d3")
    .replace(/Ãƒâ€\u009d/g, "\u00da")
    .replace(/ÃƒÅ¡/g, "\u00da");
}

function cleanPortalCopy<T>(value: T): T {
  if (typeof value === "string") return normalizePortalMojibake(decodeLikelyMojibake(String(value))) as T;
  if (Array.isArray(value)) return value.map((entry) => cleanPortalCopy(entry)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, cleanPortalCopy(entry as unknown)]),
    ) as T;
  }
  return value;
}

function normalizePortalVisibleCopy<T>(value: T): T {
  if (typeof value === "string") {
    let current = String(value);
    const replacements: Array<[RegExp, string]> = [
      [/ÃƒÆ’Ã‚Â/g, ""],
      [/Ãƒâ€”/g, "×"],
      [/ÃƒÂ¡/g, "á"],
      [/ÃƒÂ©/g, "é"],
      [/ÃƒÂ­/g, "í"],
      [/ÃƒÂ³/g, "ó"],
      [/ÃƒÂº/g, "ú"],
      [/ÃƒÂ±/g, "ñ"],
      [/ÃƒÂ¼/g, "ü"],
      [/ÃƒÂ§/g, "ç"],
      [/ÃƒÂ£/g, "ã"],
      [/ÃƒÂµ/g, "õ"],
      [/ÃƒÂ¨/g, "è"],
      [/Ã‚Â¿/g, "¿"],
      [/Ã‚Â¡/g, "¡"],
      [/Ã‚Â°/g, "°"],
      [/Ã¡/g, "á"],
      [/Ã©/g, "é"],
      [/Ã­/g, "í"],
      [/Ã³/g, "ó"],
      [/Ãº/g, "ú"],
      [/Ã±/g, "ñ"],
      [/Ã¼/g, "ü"],
    ];
    const wordFixes: Array<[RegExp, string]> = [
      [/publicaciÒ³n/gi, "publicación"],
      [/descripciÒ³n/gi, "descripción"],
      [/revisiÒ³n/gi, "revisión"],
      [/secciÒ³n/gi, "sección"],
      [/enviÒ³/gi, "envió"],
      [/querÒ©s/gi, "querés"],
      [/podÒ©s/gi, "podés"],
      [/acÒ¡/gi, "acá"],
      [/dÒ­as/gi, "días"],
      [/Òºnico/gi, "único"],
      [/galerÒ­a/gi, "galería"],
      [/imÒ¡genes/gi, "imágenes"],
      [/sesiÒ³n/gi, "sesión"],
      [/categorÒ­a/gi, "categoría"],
      [/paÒ­s/gi, "país"],
      [/Â·/g, "·"],
    ];
    for (let index = 0; index < 3; index += 1) {
      for (const [pattern, replacement] of replacements) current = current.replace(pattern, replacement);
      for (const [pattern, replacement] of wordFixes) current = current.replace(pattern, replacement);
      try {
        const decoded = decodeURIComponent(escape(current));
        if (!decoded || decoded === current) break;
        current = decoded;
      } catch {
        break;
      }
    }
    for (const [pattern, replacement] of replacements) current = current.replace(pattern, replacement);
    for (const [pattern, replacement] of wordFixes) current = current.replace(pattern, replacement);
    return current as T;
  }
  if (Array.isArray(value)) return value.map((entry) => normalizePortalVisibleCopy(entry)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, normalizePortalVisibleCopy(entry as unknown)]),
    ) as T;
  }
  return value;
}

function sanitizeVisibleCopy<T>(value: T): T {
  if (typeof value === "string") return normalizePortalUiText(decodeLikelyMojibake(String(value))) as T;
  if (Array.isArray(value)) return value.map((entry) => sanitizeVisibleCopy(entry)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, sanitizeVisibleCopy(entry as unknown)]),
    ) as T;
  }
  return value;
}

export default function ProviderPortalPanel() {
  const { locale, t } = useTranslation();
  const { selectedCountry } = useCountry();

  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [requestingLink, setRequestingLink] = useState(false);
  const [requestMessage, setRequestMessage] = useState("");
  const [requestError, setRequestError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [sessionEmail, setSessionEmail] = useState("");
  const [dashboard, setDashboard] = useState<PortalDashboard | null>(null);
  const [panelError, setPanelError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [openSubmissionModal, setOpenSubmissionModal] = useState(false);
  const [modalPlanIntent, setModalPlanIntent] = useState<"basic_free" | "featured" | "monthly">("basic_free");
  const [preferredPaidPlanType, setPreferredPaidPlanType] = useState<"featured_120d" | "featured_monthly">("featured_120d");
  const [modalVisiblePlans, setModalVisiblePlans] = useState<Array<"basic_free" | "featured" | "monthly">>(["basic_free", "featured"]);
  const [modalRequestKind, setModalRequestKind] = useState<"new_publication" | "renew_free" | "renew_featured_120d" | "renew_featured_monthly" | "upgrade_featured_120d" | "upgrade_featured_monthly" | "downgrade_free" | "edit_publication">("new_publication");
  const [modalPreviousPlan, setModalPreviousPlan] = useState<"basic_free" | "featured" | "monthly" | undefined>(undefined);
  const [modalSourceServiceId, setModalSourceServiceId] = useState<string | undefined>(undefined);
  const [modalSourcePublicationId, setModalSourcePublicationId] = useState<string | undefined>(undefined);
  const [modalPublicationChangeMode, setModalPublicationChangeMode] = useState(false);
  const [modalInitialData, setModalInitialData] = useState<Record<string, unknown> | null>(null);
  const [modalResumeMode, setModalResumeMode] = useState(false);
  const [modalResumeSubmissionId, setModalResumeSubmissionId] = useState<string | undefined>(undefined);
  const [modalResumePaymentState, setModalResumePaymentState] = useState("");
  const [modalResumeStatusReason, setModalResumeStatusReason] = useState("");

  useEffect(() => {
    document.body.style.overflow = "";
    document.documentElement.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    };
  }, []);
  const [featured120Price, setFeatured120Price] = useState<PlanPriceResponseItem | null>(null);
  const [monthlyPrice, setMonthlyPrice] = useState<PlanPriceResponseItem | null>(null);
  const [deletingSubmissionId, setDeletingSubmissionId] = useState<string | null>(null);
  const [refundingSubmissionId, setRefundingSubmissionId] = useState<string | null>(null);
  const [cancellingMonthlySubmissionId, setCancellingMonthlySubmissionId] = useState<string | null>(null);
  const publishCardsRef = useRef<HTMLDivElement | null>(null);
  const resumeHandledRef = useRef(false);
  const copy = useMemo(() => sanitizePortalVisibleTree({
    title:
      locale === "en" ? "Provider mini panel" :
      locale === "pt" ? "Mini painel do oferente" :
      locale === "it" ? "Mini pannello fornitore" :
      "Mini panel del oferente",
    subtitle:
      locale === "en" ? "Access your submissions, publications and request a new one from the same secure place." :
      locale === "pt" ? "Acesse seus envios, publicaÃ§Ãµes e peÃ§a uma nova publicaÃ§Ã£o do mesmo lugar seguro." :
      locale === "it" ? "Accedi ai tuoi invii, pubblicazioni e richiedi una nuova pubblicazione dallo stesso posto sicuro." :
      "AccedÃ© a tus envÃ­os, publicaciones y pedÃ­ una nueva publicaciÃ³n desde el mismo lugar seguro.",
    requestTitle:
      locale === "en" ? "Enter with a secure link" :
      locale === "pt" ? "Entrar com link seguro" :
      locale === "it" ? "Entra con link sicuro" :
      "Entrar con enlace seguro",
    requestBody:
      locale === "en" ? "Use the same email you left in your Travelgrin form. We will send you a one-time access link." :
      locale === "pt" ? "Use o mesmo email que vocÃª deixou no formulÃ¡rio da Travelgrin. Vamos te enviar um link de acesso de uso Ãºnico." :
      locale === "it" ? "Usa la stessa email che hai lasciato nel modulo Travelgrin. Ti invieremo un link monouso." :
      "UsÃ¡ el mismo email que dejaste en tu formulario de Travelgrin. Te vamos a enviar un enlace de acceso de un solo uso.",
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
      locale === "pt" ? "Insira um email vÃ¡lido." :
      locale === "it" ? "Inserisci un'email valida." :
      "IngresÃ¡ un email vÃ¡lido.",
    securityHint:
      locale === "en" ? "The link expires in 20 minutes and the session stays active for 15 days on this device." :
      locale === "pt" ? "O link vence em 20 minutos e a sessÃ£o fica ativa por 15 dias neste dispositivo." :
      locale === "it" ? "Il link scade in 20 minuti e la sessione resta attiva per 15 giorni su questo dispositivo." :
      "El enlace vence en 20 minutos y la sesiÃ³n queda activa por 15 dÃ­as en este dispositivo.",
    requestLinkSent:
      locale === "en" ? "If we find your email, we will send you a secure link to access your mini panel." :
      locale === "pt" ? "Se encontrarmos seu email, enviaremos um link seguro para entrar no mini painel." :
      locale === "it" ? "Se troviamo la tua email, ti invieremo un link sicuro per accedere al mini pannello." :
      "Si encontramos tu email, te enviamos un enlace seguro para entrar al mini panel.",
    loadPanelError:
      locale === "en" ? "The mini panel could not be loaded." :
      locale === "pt" ? "Nao foi possivel carregar o mini painel." :
      locale === "it" ? "Non e stato possibile caricare il mini pannello." :
      "No se pudo cargar el mini panel.",
    sendLinkError:
      locale === "en" ? "The secure link could not be sent." :
      locale === "pt" ? "Nao foi possivel enviar o link seguro." :
      locale === "it" ? "Non e stato possibile inviare il link sicuro." :
      "No se pudo enviar el enlace seguro.",
    deleteSubmissionError:
      locale === "en" ? "The request could not be deleted." :
      locale === "pt" ? "Nao foi possivel excluir a solicitacao." :
      locale === "it" ? "Non e stato possibile eliminare la richiesta." :
      "No se pudo eliminar la solicitud.",
    refundError:
      locale === "en" ? "The refund could not be requested." :
      locale === "pt" ? "Nao foi possivel solicitar o reembolso." :
      locale === "it" ? "Non e stato possibile richiedere il rimborso." :
      "No se pudo solicitar el reembolso.",
    cancelMonthlyError:
      locale === "en" ? "The monthly subscription could not be cancelled." :
      locale === "pt" ? "Nao foi possivel cancelar a assinatura mensal." :
      locale === "it" ? "Non e stato possibile annullare l'abbonamento mensile." :
      "No se pudo cancelar la suscripcion mensual.",
    accessOk:
      locale === "en" ? "Access verified. Welcome back." :
      locale === "pt" ? "Acesso verificado. Bem-vindo de volta." :
      locale === "it" ? "Accesso verificato. Bentornato." :
      "Acceso verificado. Bienvenido de nuevo.",
    accessInvalid:
      locale === "en" ? "That access link is no longer valid. Request a new one." :
      locale === "pt" ? "Esse link de acesso nÃ£o Ã© mais vÃ¡lido. PeÃ§a um novo." :
      locale === "it" ? "Quel link di accesso non Ã¨ piÃ¹ valido. Richiedine uno nuovo." :
      "Ese enlace de acceso ya no es vÃ¡lido. PedÃ­ uno nuevo.",
    activeSession:
      locale === "en" ? "Active session" :
      locale === "pt" ? "SessÃ£o ativa" :
      locale === "it" ? "Sessione attiva" :
      "SesiÃ³n activa",
    logout:
      locale === "en" ? "Log out" :
      locale === "pt" ? "Salir" :
      locale === "it" ? "Esci" :
      "Cerrar sesiÃ³n",
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
      locale === "pt" ? "Use isto quando quiser iniciar um pedido de publicaÃ§Ã£o totalmente novo sem mudar seu plano atual." :
      locale === "it" ? "Usa questo quando vuoi avviare una richiesta di pubblicazione completamente nuova senza cambiare il tuo piano attuale." :
      "UsÃ¡ esto cuando quieras iniciar una solicitud de publicaciÃ³n totalmente nueva sin cambiar tu plan actual.",
    newSubmission:
      locale === "en" ? "Request another publication" :
      locale === "pt" ? "Pedir outra publicaÃ§Ã£o" :
      locale === "it" ? "Richiedi un'altra pubblicazione" :
      "Pedir otra publicaciÃ³n",
    jumpToPublishOptions:
      locale === "en" ? "Create another publication" :
      locale === "pt" ? "Criar outra publicação" :
      locale === "it" ? "Crea un'altra pubblicazione" :
      "Crear otra publicación",
    publishOptionsTitle:
      locale === "en" ? "Create a new publication" :
      locale === "pt" ? "Criar uma nova publicação" :
      locale === "it" ? "Crea una nuova pubblicazione" :
      "Crear una nueva publicación",
    publishOptionsBody:
      locale === "en" ? "Choose the type of new publication you want to create with this same provider account." :
      locale === "pt" ? "Escolha o tipo de nova publicação que você quer criar com esta mesma conta de oferente." :
      locale === "it" ? "Scegli il tipo di nuova pubblicazione che vuoi creare con questo stesso account fornitore." :
      "Elegí el tipo de nueva publicación que querés crear con esta misma cuenta de oferente.",
    publishFreeAction:
      locale === "en" ? "Publish basic listing" :
      locale === "pt" ? "Publicar publicação básica" :
      locale === "it" ? "Pubblica pubblicazione base" :
      "Publicar publicación básica",
    publishFeaturedAction:
      locale === "en" ? "Publish featured listing" :
      locale === "pt" ? "Publicar destaque 120 dias" :
      locale === "it" ? "Pubblica evidenza 120 giorni" :
      "Publicar destacado",
    publishMonthlyAction:
      locale === "en" ? "Publish monthly plan" :
      locale === "pt" ? "Publicar plano mensal" :
      locale === "it" ? "Pubblica piano mensile" :
      "Publicar plan mensual",
    submissionDelete:
      locale === "en" ? "Delete" :
      locale === "pt" ? "Excluir" :
      locale === "it" ? "Elimina" :
      "Eliminar",
    deletingSubmission:
      locale === "en" ? "Deleting..." :
      locale === "pt" ? "Excluindo..." :
      locale === "it" ? "Eliminazione..." :
      "Eliminando...",
    submissionDeleted:
      locale === "en" ? "Request deleted." :
      locale === "pt" ? "SolicitaÃƒÂ§ÃƒÂ£o excluÃƒÂ­da." :
      locale === "it" ? "Richiesta eliminata." :
      "Solicitud eliminada.",
    submissionDeleteConfirm:
      locale === "en" ? "Do you want to delete this request from your history?" :
      locale === "pt" ? "Quer excluir esta solicitaÃƒÂ§ÃƒÂ£o do seu histÃƒÂ³rico?" :
      locale === "it" ? "Vuoi eliminare questa richiesta dal tuo storico?" :
      "Ã‚Â¿QuerÃƒÂ©s eliminar esta solicitud de tu historial?",
    compactHistoryHint:
      locale === "en" ? "Latest requests first. You can delete cancelled or pending requests from here." :
      locale === "pt" ? "Pedidos mais recentes primeiro. VocÃƒÂª pode excluir daqui os pedidos cancelados ou pendentes." :
      locale === "it" ? "Richieste piÃƒÂ¹ recenti per prime. Da qui puoi eliminare le richieste annullate o in sospeso." :
      "Las solicitudes mÃƒÂ¡s nuevas van primero. Desde acÃƒÂ¡ podÃƒÂ©s eliminar las canceladas o pendientes.",
    statsSubmissions:
      locale === "en" ? "Submitted forms" :
      locale === "pt" ? "FormulÃ¡rios enviados" :
      locale === "it" ? "Moduli inviati" :
      "Formularios enviados",
    statsPublications:
      locale === "en" ? "Admin-built publications" :
      locale === "pt" ? "PublicaÃ§Ãµes armadas pelo admin" :
      locale === "it" ? "Pubblicazioni create dall'admin" :
      "Publicaciones armadas por admin",
    statsPending:
      locale === "en" ? "Pending review" :
      locale === "pt" ? "Pendentes de revisÃ£o" :
      locale === "it" ? "In attesa di revisione" :
      "Pendientes de revisiÃ³n",
    statsPlans:
      locale === "en" ? "Plan mix" :
      locale === "pt" ? "DistribuiÃ§Ã£o de planos" :
      locale === "it" ? "Mix dei piani" :
      "DistribuciÃ³n de planes",
    submissionsTitle:
      locale === "en" ? "Your submitted requests" :
      locale === "pt" ? "Seus pedidos enviados" :
      locale === "it" ? "Le tue richieste inviate" :
      "Tus solicitudes enviadas",
    publicationsTitle:
      locale === "en" ? "Publications visible for your account" :
      locale === "pt" ? "PublicaÃ§Ãµes visÃ­veis para sua conta" :
      locale === "it" ? "Pubblicazioni visibili per il tuo account" :
      "Publicaciones visibles para tu cuenta",
    emptySubmissions:
      locale === "en" ? "You still have no submissions with this email." :
      locale === "pt" ? "VocÃª ainda nÃ£o tem envios com este email." :
      locale === "it" ? "Non hai ancora invii con questa email." :
      "TodavÃ­a no tenÃ©s envÃ­os con este email.",
    emptyPublications:
      locale === "en" ? "The admin has not built publications from your requests yet." :
      locale === "pt" ? "O admin ainda nÃ£o armou publicaÃ§Ãµes a partir dos seus pedidos." :
      locale === "it" ? "L'admin non ha ancora creato pubblicazioni dalle tue richieste." :
      "El admin todavÃ­a no armÃ³ publicaciones a partir de tus solicitudes.",
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
      "Destacado 120 dÃ­as",
    monthly:
      locale === "en" ? "Monthly plan" :
      locale === "pt" ? "Plano mensal" :
      locale === "it" ? "Piano mensile" :
      "Plan mensual",
    free:
      locale === "en" ? "Free 60 days" :
      locale === "pt" ? "GrÃ¡tis 60 dias" :
      locale === "it" ? "Gratis 60 giorni" :
      "Gratis 60 dÃ­as",
    planSelectorTitle:
      locale === "en" ? "Choose how you want to continue" :
      locale === "pt" ? "Escolha como vocÃƒÂª quer continuar" :
      locale === "it" ? "Scegli come vuoi continuare" :
      "ElegÃƒÂ­ cÃƒÂ³mo querÃƒÂ©s continuar",
    planSelectorBody:
      locale === "en" ? "Stay free, upgrade to featured for 120 days, or switch to a monthly plan. Paid plans use the prices configured by the admin for your passport country." :
      locale === "pt" ? "Continue no gratuito, passe para destaque por 120 dias ou mude para o plano mensal. Os planos pagos usam os preÃƒÂ§os configurados pelo admin para o paÃƒÂ­s do seu passaporte." :
      locale === "it" ? "Resta nel gratuito, passa all'evidenza per 120 giorni oppure attiva il piano mensile. I piani a pagamento usano i prezzi configurati dall'admin per il paese del tuo passaporto." :
      "SeguÃƒÂ­ en gratis, pasÃƒÂ¡ a destacado por 120 dÃƒÂ­as o cambiÃƒÂ¡ al plan mensual. Los planes pagos usan los precios configurados por el admin para el paÃƒÂ­s de tu pasaporte.",
    freeCta:
      locale === "en" ? "Renew / request free" :
      locale === "pt" ? "Renovar / pedir grÃƒÂ¡tis" :
      locale === "it" ? "Rinnova / richiedi gratis" :
      "Renovar / pedir gratis",
    featuredCta:
      locale === "en" ? "Switch to featured 120 days" :
      locale === "pt" ? "Passar para destaque 120 dias" :
      locale === "it" ? "Passa a evidenza 120 giorni" :
      "Pasar a destacado 120 dÃƒÂ­as",
    monthlyCta:
      locale === "en" ? "Switch to monthly plan" :
      locale === "pt" ? "Passar para plano mensal" :
      locale === "it" ? "Passa al piano mensile" :
      "Pasar a plan mensual",
    freeDescription:
      locale === "en" ? "Visible in the listing for 60 days. When it expires, you can renew it from here and the request goes back to the admin." :
      locale === "pt" ? "VisÃƒÂ­vel na listagem por 60 dias. Quando vencer, vocÃƒÂª pode renovar por aqui e o pedido volta para o admin." :
      locale === "it" ? "Visibile nell'elenco per 60 giorni. Quando scade, puoi rinnovarlo da qui e la richiesta torna all'admin." :
      "Visible en el listado por 60 dÃƒÂ­as. Cuando vence, podÃƒÂ©s renovarla desde acÃƒÂ¡ y la solicitud vuelve al admin.",
    featuredDescription:
      locale === "en" ? "One-time payment. Includes the same featured benefits from the publication form for 120 days." :
      locale === "pt" ? "Pagamento ÃƒÂºnico. Inclui os mesmos benefÃƒÂ­cios destacados do formulÃƒÂ¡rio de publicaÃƒÂ§ÃƒÂ£o por 120 dias." :
      locale === "it" ? "Pagamento unico. Include gli stessi vantaggi in evidenza del modulo di pubblicazione per 120 giorni." :
      "Pago ÃƒÂºnico. Incluye los mismos beneficios destacados del formulario de publicaciÃƒÂ³n por 120 dÃƒÂ­as.",
    monthlyDescription:
      locale === "en" ? "Recurring monthly billing with the same featured benefits to keep your publication boosted continuously." :
      locale === "pt" ? "CobranÃƒÂ§a mensal recorrente com os mesmos benefÃƒÂ­cios destacados para manter sua publicaÃƒÂ§ÃƒÂ£o impulsionada de forma continua." :
      locale === "it" ? "Addebito mensile ricorrente con gli stessi vantaggi del piano in evidenza per mantenere la tua pubblicazione potenziata in modo continuo." :
      "Cobro mensual recurrente con los mismos beneficios destacados para mantener tu publicaciÃƒÂ³n impulsionada de forma continua.",
    includesTitle:
      locale === "en" ? "Includes" :
      locale === "pt" ? "Inclui" :
      locale === "it" ? "Include" :
      "Incluye",
    noPriceConfigured:
      locale === "en" ? "Price not configured yet" :
      locale === "pt" ? "PreÃƒÂ§o ainda nÃƒÂ£o configurado" :
      locale === "it" ? "Prezzo non ancora configurato" :
      "Precio todavÃƒÂ­a no configurado",
    priceUnavailableHint:
      locale === "en" ? "The admin still needs to configure this price for your passport country." :
      locale === "pt" ? "O admin ainda precisa configurar este preÃ§o para o paÃ­s do seu passaporte." :
      locale === "it" ? "L'admin deve ancora configurare questo prezzo per il paese del tuo passaporto." :
      "El admin todavÃ­a tiene que configurar este precio para el paÃ­s de tu pasaporte.",
  }), [locale]);
  const portalStatus = String(searchParams.get("portal_status") ?? "").trim().toLowerCase();
  const portalAction = String(searchParams.get("portal_action") ?? "").trim().toLowerCase();
  const portalSubmissionId = String(searchParams.get("submission_id") ?? "").trim();
  const featuredPaymentStatus = String(searchParams.get("featuredPayment") ?? "").trim().toLowerCase();
  const featuredPaymentServiceId = String(searchParams.get("serviceId") ?? "").trim();

const planCopy = useMemo(() => sanitizePortalVisibleTree({
    currentPlan:
      locale === "en" ? "Current plan" :
      locale === "pt" ? "Plano atual" :
      locale === "it" ? "Piano attuale" :
      "Plan actual",
    currentPlanBody:
      locale === "en" ? "From here you can renew your free publication, upgrade to a paid plan, or request going back to free." :
      locale === "pt" ? "Daqui voce pode renovar sua publicacao gratuita, mudar para um plano pago ou pedir para voltar ao gratuito." :
      locale === "it" ? "Da qui puoi rinnovare la tua pubblicazione gratuita, passare a un piano a pagamento o chiedere di tornare al gratuito." :
      "Desde acá podés renovar tu publicación gratuita, pasar a un plan pago o pedir volver al gratuito.",
    currentBadge:
      locale === "en" ? "Current" :
      locale === "pt" ? "Atual" :
      locale === "it" ? "Attuale" :
      "Actual",
    renewFree:
      locale === "en" ? "Renew free publication" :
      locale === "pt" ? "Renovar publicacao gratuita" :
      locale === "it" ? "Rinnova pubblicazione gratuita" :
      "Renovar publicación gratuita",
    goBackFree:
      locale === "en" ? "Request going back to free" :
      locale === "pt" ? "Pedir volta ao gratuito" :
      locale === "it" ? "Richiedi ritorno al gratuito" :
      "Pedir volver al gratis",
    currentFeatured:
      locale === "en" ? "You already have the 120-day featured plan." :
      locale === "pt" ? "Voce ja tem o destaque de 120 dias." :
      locale === "it" ? "Hai gia il piano in evidenza da 120 giorni." :
      "Ya tenés el plan destacado de 120 días.",
    currentMonthly:
      locale === "en" ? "You already have the monthly plan active." :
      locale === "pt" ? "Voce ja tem o plano mensal ativo." :
      locale === "it" ? "Hai gia il piano mensile attivo." :
      "Ya tenés el plan mensual activo.",
    requestType:
      locale === "en" ? "Request" :
      locale === "pt" ? "Solicitud" :
      locale === "it" ? "Richiesta" :
      "Solicitud",
    requestNew:
      locale === "en" ? "New publication" :
      locale === "pt" ? "Nova publicacao" :
      locale === "it" ? "Nuova pubblicazione" :
      "Nueva publicación",
    requestRenew:
      locale === "en" ? "Free renewal" :
      locale === "pt" ? "Renovacao gratuita" :
      locale === "it" ? "Rinnovo gratuito" :
      "Renovación gratis",
    requestUpgrade120:
      locale === "en" ? "Upgrade to featured 120 days" :
      locale === "pt" ? "Upgrade para destaque 120 dias" :
      locale === "it" ? "Upgrade a evidenza 120 giorni" :
      "Upgrade a destacado 120 días",
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
    publicationActions:
      locale === "en" ? "Actions for this publication" :
      locale === "pt" ? "AÃ§Ãµes para esta publicaÃ§Ã£o" :
      locale === "it" ? "Azioni per questa pubblicazione" :
      "Acciones para esta publicaciÃ³n",
    renewFeatured:
      locale === "en" ? "Renew featured 120 days" :
      locale === "pt" ? "Renovar destaque 120 dias" :
      locale === "it" ? "Rinnova evidenza 120 giorni" :
      "Renovar destacado 120 dÃ­as",
    switchMonthly:
      locale === "en" ? "Switch this publication to monthly" :
      locale === "pt" ? "Passar esta publicaÃ§Ã£o ao mensal" :
      locale === "it" ? "Passa questa pubblicazione al mensile" :
      "Pasar esta publicaciÃ³n a mensual",
    downgradeThisPublication:
      locale === "en" ? "Move this publication back to free" :
      locale === "pt" ? "Voltar esta publicaÃ§Ã£o ao gratuito" :
      locale === "it" ? "Riporta questa pubblicazione al gratuito" :
      "Volver esta publicaciÃ³n al gratis",
    cancelMonthly:
      locale === "en" ? "Cancel monthly subscription" :
      locale === "pt" ? "Cancelar assinatura mensal" :
      locale === "it" ? "Annulla abbonamento mensile" :
      "Cancelar suscripción mensual",
    upgradeToFeatured:
      locale === "en" ? "Upgrade this publication to featured" :
      locale === "pt" ? "Passar esta publicaÃ§Ã£o a destaque" :
      locale === "it" ? "Passa questa pubblicazione a evidenza" :
      "Pasar esta publicaciÃ³n a destacado",
    upgradeToMonthly:
      locale === "en" ? "Upgrade this publication to monthly" :
      locale === "pt" ? "Passar esta publicaÃ§Ã£o ao mensal" :
      locale === "it" ? "Passa questa pubblicazione al mensile" :
      "Pasar esta publicaciÃ³n a mensual",
    requestAnotherPublication:
      locale === "en" ? "Create another publication" :
      locale === "pt" ? "Criar outra publicaÃ§Ã£o" :
      locale === "it" ? "Crea un'altra pubblicazione" :
      "Crear otra publicaciÃ³n",
    linkedRequest:
      locale === "en" ? "Source request" :
      locale === "pt" ? "SolicitaÃ§Ã£o de origem" :
      locale === "it" ? "Richiesta di origine" :
      "Solicitud de origen",
  }), [locale]);

  const loadSession = useCallback(async () => {
    setLoading(true);
    setPanelError("");
    try {
      const response = await fetch("/api/provider-portal/session", { cache: "no-store", credentials: "include" });
      const data = (await response.json().catch(() => ({}))) as PortalSessionResponse;
      if (!response.ok || data?.ok === false) {
        throw new Error(String(data?.error ?? copy.loadPanelError));
      }
      setAuthenticated(Boolean(data.authenticated));
      setSessionEmail(String(data?.session?.email ?? ""));
      setDashboard(data?.dashboard ?? null);
    } catch (error) {
      setAuthenticated(false);
      setDashboard(null);
      setPanelError(error instanceof Error ? error.message : copy.loadPanelError);
    } finally {
      setLoading(false);
    }
  }, [copy.loadPanelError]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  useEffect(() => {
    if (!featuredPaymentStatus) return;
    const paidText = locale === "en" ? "Your payment was accepted." : locale === "pt" ? "Seu pagamento foi aceito." : locale === "it" ? "Il tuo pagamento e stato accettato." : "Tu pago fue aceptado.";
    const cancelText = locale === "en" ? "The payment window was closed without completing the payment." : locale === "pt" ? "A janela de pagamento foi fechada sem concluir o pagamento." : locale === "it" ? "La finestra di pagamento e stata chiusa senza completare il pagamento." : "La ventana de pago se cerro sin completar el pago.";
    const reviewText = locale === "en" ? "We are checking your payment status." : locale === "pt" ? "Estamos verificando o status do seu pagamento." : locale === "it" ? "Stiamo verificando lo stato del pagamento." : "Estamos verificando el estado de tu pago.";
    const emailText = locale === "en" ? "You will receive the next steps by email." : locale === "pt" ? "Voce recebera os proximos passos por e-mail." : locale === "it" ? "Riceverai via email i prossimi passi." : "En tu cuenta de mail recibiras los pasos a seguir.";

    const reconcile = async () => {
      let resolvedStatus = featuredPaymentStatus;
      if (featuredPaymentServiceId) {
        try {
          const response = await fetch("/api/payments/featured/return", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ serviceId: featuredPaymentServiceId, status: featuredPaymentStatus }),
          });
          const data = await response.json().catch(() => ({}));
          const backendStatus = String(data?.status ?? "").trim().toLowerCase();
          if (response.ok && backendStatus) {
            resolvedStatus =
              ["paid", "approved", "completed", "success"].includes(backendStatus) ? "success" :
              ["processing", "pending"].includes(backendStatus) ? "check" :
              ["failed", "cancelled"].includes(backendStatus) ? "cancel" :
              featuredPaymentStatus;
          }
        } catch {}
      }

      if (resolvedStatus === "success") {
        toast.success(`${paidText} ${emailText}`, { duration: 9000 });
      } else if (resolvedStatus === "cancel") {
        toast(cancelText, { duration: 7000 });
      } else {
        toast(`${reviewText} ${emailText}`, { duration: 9000 });
      }
      await loadSession();
    };

    void reconcile();
  }, [featuredPaymentServiceId, featuredPaymentStatus, loadSession, locale]);

  useEffect(() => {
    if (!featuredPaymentStatus) return;
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.delete("featuredPayment");
    nextUrl.searchParams.delete("serviceId");
    window.history.replaceState({}, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
  }, [featuredPaymentStatus]);

  const openResumeSubmission = useCallback((submission: PortalSubmission) => {
    const resumePlan = submission.planType === "monthly" ? "monthly" : submission.planType === "featured" ? "featured" : "basic_free";
    const requestedPlan = String(submission.requestedPlan ?? "").trim().toLowerCase();
    const draftPaymentStatus = String((submission.draftData as Record<string, unknown> | undefined)?.paymentStatus ?? "").trim().toLowerCase();
    const draftPaymentReturnStatus = String((submission.draftData as Record<string, unknown> | undefined)?.paymentReturnStatus ?? "").trim().toLowerCase();
    const resumePaymentState =
      [String(submission.paymentStatus ?? "").trim().toLowerCase(), draftPaymentStatus, draftPaymentReturnStatus].some((value) =>
        ["paid", "approved", "completed", "success", "ok"].includes(value),
      )
        ? "paid"
        : String(submission.paymentStatus ?? (submission.draftData as Record<string, unknown> | undefined)?.paymentStatus ?? (submission.draftData as Record<string, unknown> | undefined)?.paymentReturnStatus ?? "");
    setModalPlanIntent(resumePlan);
    setPreferredPaidPlanType(
      requestedPlan === "featured_monthly" || resumePlan === "monthly" ? "featured_monthly" : "featured_120d",
    );
    setModalVisiblePlans([resumePlan]);
    setModalRequestKind((submission.requestKind as "new_publication" | "renew_free" | "renew_featured_120d" | "renew_featured_monthly" | "upgrade_featured_120d" | "upgrade_featured_monthly" | "downgrade_free" | "edit_publication") || "new_publication");
    setModalPreviousPlan(submission.previousPlan === "basic_free" || submission.previousPlan === "featured" || submission.previousPlan === "monthly" ? submission.previousPlan : undefined);
    setModalSourceServiceId(submission.sourceServiceId || undefined);
    setModalSourcePublicationId(String((submission.draftData as Record<string, unknown> | undefined)?.sourcePublicationId ?? "").trim() || undefined);
    setModalPublicationChangeMode(String(submission.requestKind ?? "").trim().toLowerCase() === "edit_publication");
    setModalInitialData({
      ...(submission.draftData ?? {}),
      name: submission.profileName || (submission.draftData as Record<string, unknown> | undefined)?.name || "",
      category: submission.category || (submission.draftData as Record<string, unknown> | undefined)?.category || [],
      country: submission.country || (submission.draftData as Record<string, unknown> | undefined)?.country || "",
      destinationCountry: submission.destinationCountry || (submission.draftData as Record<string, unknown> | undefined)?.destinationCountry || "",
      whatSearchingRaw: submission.whatSearchingRaw ?? "",
      statusReason: submission.statusReason ?? "",
      paymentStatus: submission.paymentStatus ?? "",
      paymentReturnStatus: submission.paymentReturnStatus ?? "",
    });
    setModalResumeMode(true);
    setModalResumeSubmissionId(submission.id);
    setModalResumePaymentState(resumePaymentState);
    setModalResumeStatusReason(String(submission.statusReason ?? ""));
    setOpenSubmissionModal(true);
  }, []);

  useEffect(() => {
    if (!authenticated || !dashboard?.submissions?.length) return;
    if (portalAction !== "resume_submission" || !portalSubmissionId) return;
    if (resumeHandledRef.current) return;
    resumeHandledRef.current = true;
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.delete("portal_action");
    nextUrl.searchParams.delete("submission_id");
    window.history.replaceState({}, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
    const targetSubmission = dashboard.submissions.find((item) => item.id === portalSubmissionId);
    if (!targetSubmission || String(targetSubmission.status ?? "").trim().toLowerCase() !== "needs_info") {
      toast.error(t("enlace_reanudacion_invalido"));
      return;
    }
    openResumeSubmission(targetSubmission);
  }, [authenticated, dashboard?.submissions, openResumeSubmission, portalAction, portalSubmissionId, t]);

  useEffect(() => {
    const country = String(
      dashboard?.submissions.find((item) => ["aprobado", "approved", "active", "activo", "paid"].includes(String(item.status ?? "").trim().toLowerCase()) && String(item.country ?? "").trim())?.country ??
      dashboard?.submissions.find((item) => String(item.country ?? "").trim())?.country ??
      selectedCountry ??
      "",
    ).trim();
    if (!country) {
      setFeatured120Price(null);
      setMonthlyPrice(null);
      return;
    }
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
  }, [dashboard?.submissions, selectedCountry]);

  const submitRequestAccess = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setRequestError(copy.invalidEmail);
      return;
    }
    if (!turnstileToken) {
      setRequestError(locale === "en" ? "Please complete the verification." : locale === "pt" ? "Complete a verificacao." : locale === "it" ? "Completa la verifica." : "Completa la verificacion.");
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
        body: JSON.stringify({ email: normalizedEmail, locale, turnstileToken }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) {
        throw new Error(String(data?.error ?? copy.sendLinkError));
      }
      setRequestMessage(String(data?.message ?? "") || copy.requestLinkSent);
      setTurnstileToken("");
      setTurnstileResetKey((value) => value + 1);
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : copy.sendLinkError);
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
  const getPortalPaymentView = useCallback((submission: PortalSubmission) => {
  const draft = submission.draftData ?? {};

  const values = [
    submission.paymentStatus,
    submission.paymentReturnStatus,
    draft.paymentStatus,
    draft.paymentReturnStatus,
    draft.status,
    draft.returnStatus,
  ].map((value) => String(value ?? "").trim().toLowerCase()).filter(Boolean);

  const hasPaymentReference = [
    submission.providerPaymentId,
    draft.providerPaymentId,
    draft.paymentId,
    draft.externalReference,
    draft.paymentReference,
    draft.merchantCheckoutToken,
    draft.checkoutId,
  ].some((value) => String(value ?? "").trim());

  if (values.some((value) => ["paid", "approved", "completed", "success", "ok", "accepted", "aceptado"].includes(value))) {
    return "confirmed" as const;
  }

  if (values.some((value) => ["failed", "rejected", "cancelled", "canceled", "error", "declined"].includes(value))) {
    return "failed" as const;
  }

  if (hasPaymentReference || values.some((value) => ["processing", "pending", "in_process", "in_review"].includes(value))) {
    return "review" as const;
  }

  return "none" as const;
}, []);
 const getResolvedProviderPaymentId = useCallback((submission: PortalSubmission) => {
  const draft = submission.draftData ?? {};
  return [
    submission.providerPaymentId,
    draft.providerPaymentId,
    draft.paymentId,
    draft.externalReference,
    draft.paymentReference,
    draft.checkoutId,
  ].map((value) => String(value ?? "").trim()).find(Boolean) ?? "";
}, []);
 const getVisualSubmissionStage = useCallback((submission: PortalSubmission) => {
    const normalizedStatus = String(submission.status ?? "").trim().toLowerCase();
    const paymentView = getPortalPaymentView(submission);
    const expiration = submission.expirationAt ? new Date(submission.expirationAt).getTime() : 0;
    const isExpired = Boolean(expiration) && !Number.isNaN(expiration) && expiration < Date.now();
    const isResubmitted = Boolean(submission.resubmittedAt || submission.draftData?.resubmittedAt);
    if (normalizedStatus === "rejected") return "rejected" as const;
    if (normalizedStatus === "needs_info") return "needsInfo" as const;
    if (["cancelled", "canceled"].includes(normalizedStatus) && paymentView !== "confirmed" && paymentView !== "review") {
  return "cancelled" as const;}
    if (["aprobado", "approved", "active", "activo", "paid"].includes(normalizedStatus)) {
      return isExpired ? "expired" as const : "approved" as const;
    }
    if (paymentView === "confirmed" || paymentView === "review") {
    return "paymentPending" as const;
    }
    
    if (["pendiente_pago", "payment_pending"].includes(normalizedStatus) || paymentView === "failed") {
      return paymentView === "failed" ? "cancelled" as const : "paymentPending" as const;
    }
    if (isExpired) return "expired" as const;
    if (isResubmitted) return "resubmitted" as const;
    return "pending" as const;
    }, [getPortalPaymentView]);
  const visualSubmissionLabel = useCallback((submission: PortalSubmission) => {
    const stage = getVisualSubmissionStage(submission);
    if (stage === "approved") return t("providerPortal.status.approved");
    if (stage === "resubmitted") return t("providerPortal.status.resubmittedForReview");
    if (stage === "paymentPending") return t("providerPortal.status.pendingReview");
    if (stage === "needsInfo") return t("providerPortal.status.needsInfo");
    if (stage === "rejected") return t("providerPortal.status.rejected");
    if (stage === "expired") return t("providerPortal.status.expired");
    if (stage === "cancelled") return t("providerPortal.status.cancelled");
    return t("providerPortal.status.pendingReview");
  }, [getVisualSubmissionStage, t]);

  const visualSubmissionKind = useCallback((submission: PortalSubmission) => {
    const stage = getVisualSubmissionStage(submission);
    if (stage === "approved") return "approved" as const;
    if (stage === "needsInfo") return "needsInfo" as const;
    if (stage === "rejected" || stage === "cancelled" || stage === "expired") return "rejected" as const;
    return "pending" as const;
  }, [getVisualSubmissionStage]);

  const visualPaymentLabel = useCallback((submission: PortalSubmission) => {
  const paymentView = getPortalPaymentView(submission);

  if (paymentView === "confirmed") {
    return locale === "en" ? "Payment accepted" : locale === "pt" ? "Pagamento aceito" : locale === "it" ? "Pagamento accettato" : "Pago aceptado";
  }

  if (paymentView === "review") {
    return locale === "en" ? "Payment under review" : locale === "pt" ? "Pagamento em revisão" : locale === "it" ? "Pagamento in revisione" : "Pago en revisión";
  }

  if (paymentView === "failed") return t("providerPortal.payment.rejected");

  return t("providerPortal.payment.notCompleted");
}, [getPortalPaymentView, locale, t]);

const visualPaymentKind = useCallback((submission: PortalSubmission) => {
  const paymentView = getPortalPaymentView(submission);

  if (paymentView === "confirmed") return "approved" as const;
  if (paymentView === "failed") return "rejected" as const;

  return "pending" as const;
}, [getPortalPaymentView]);

  const visualRefundLabel = useCallback((value?: string) => {
    const normalized = String(value ?? "").trim().toLowerCase();
    if (normalized === "refund_requested") return t("providerPortal.refund.requested");
    if (normalized === "refund_reviewing") return t("providerPortal.refund.reviewing");
    if (normalized === "refund_rejected") return t("providerPortal.refund.rejected");
    if (normalized === "refund_processing") return t("providerPortal.refund.processing");
    if (normalized === "refunded") return t("providerPortal.refund.completed");
    if (normalized === "refund_failed") return t("providerPortal.refund.failed");
    return value || "-";
  }, [t]);

  const visualRefundKind = useCallback((value?: string) => {
    const normalized = String(value ?? "").trim().toLowerCase();
    if (normalized === "refunded") return "approved" as const;
    if (["refund_rejected", "refund_failed"].includes(normalized)) return "rejected" as const;
    if (["refund_requested", "refund_reviewing", "refund_processing"].includes(normalized)) return "pending" as const;
    return "default" as const;
  }, []);

  

  const submissionSortRank = useCallback((submission: PortalSubmission) => {
    const stage = getVisualSubmissionStage(submission);
    if (stage === "approved") return 0;
    if (stage === "pending" || stage === "resubmitted") return 1;
    if (stage === "paymentPending") return 2;
    if (stage === "needsInfo") return 3;
    if (stage === "rejected") return 4;
    return 5;
  }, [getVisualSubmissionStage]);

  const planSortRank = useCallback((planType?: string) => {
    const normalized = normalizePortalPlanType(planType);
    if (normalized === "monthly") return 0;
    if (normalized === "featured") return 1;
    return 2;
  }, []);

 const isConfirmedPortalPayment = useCallback((submission: PortalSubmission) => {
  return getPortalPaymentView(submission) === "confirmed";
}, [getPortalPaymentView]);

  const planBenefits = useMemo(() => sanitizeVisibleCopy({
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
  const currentPlanCreatedAt = latestApprovedSubmission?.createdAt ?? latestVisiblePublication?.createdAt ?? null;
  const currentPlanExpiresAt = latestApprovedSubmission?.expirationAt ?? latestVisiblePublication?.expiration ?? null;
  const baseCountry = String(
    latestApprovedSubmission?.country ??
    dashboard?.submissions.find((item) => String(item.country ?? "").trim())?.country ??
    selectedCountry ??
    "",
  ).trim();

  const requestKindLabel = useCallback((value?: string) => {
    const normalized = String(value ?? "").trim().toLowerCase();
    if (normalized === "renew_free") return planCopy.requestRenew;
    if (normalized === "renew_featured_120d") return locale === "en" ? "Featured renewal" : locale === "pt" ? "Renovacao de destaque" : locale === "it" ? "Rinnovo in evidenza" : "Renovacion de destacado";
    if (normalized === "renew_featured_monthly") return locale === "en" ? "Monthly plan renewal" : locale === "pt" ? "Renovacao do plano mensal" : locale === "it" ? "Rinnovo piano mensile" : "Renovacion de plan mensual";
    if (normalized === "upgrade_featured_120d") return locale === "en" ? "Free publication to featured change" : locale === "pt" ? "Alteracao de publicacao gratis para destaque" : locale === "it" ? "Cambio da pubblicazione gratis a in evidenza" : "Cambio de publicacion gratis a destacado";
    if (normalized === "upgrade_featured_monthly") return locale === "en" ? "Free publication to monthly plan change" : locale === "pt" ? "Alteracao de publicacao gratis para plano mensal" : locale === "it" ? "Cambio da pubblicazione gratis a piano mensile" : "Cambio de publicacion gratis a plan mensual";
    if (normalized === "downgrade_free") return planCopy.requestDowngrade;
    if (normalized === "edit_publication") return locale === "en" ? "Publication edit" : locale === "pt" ? "Edicao de publicacao" : locale === "it" ? "Modifica pubblicazione" : "Edicion de publicacion";
    if (normalized === "edit_publication") {
      return locale === "en" ? "Publication edit" : locale === "pt" ? "EdiÃ§Ã£o de publicaÃ§Ã£o" : locale === "it" ? "Modifica pubblicazione" : "EdiciÃ³n de publicaciÃ³n";
    }
    return planCopy.requestNew;
  }, [locale, planCopy]);

  const compactHistoryHint = useMemo(() => (
    locale === "en"
      ? "Latest requests first. You can delete cancelled or pending requests from here."
      : locale === "pt"
        ? "Os pedidos mais recentes aparecem primeiro. Daqui você pode excluir os cancelados ou pendentes."
        : locale === "it"
          ? "Le richieste più recenti vengono mostrate per prime. Da qui puoi eliminare quelle annullate o in sospeso."
          : "Las solicitudes más nuevas van primero. Desde acá podés eliminar las canceladas o pendientes."
  ), [locale]);

  const cancelMonthlyLabel = useMemo(() => (
    locale === "en"
      ? "Cancel monthly subscription"
      : locale === "pt"
        ? "Cancelar assinatura mensal"
        : locale === "it"
          ? "Annulla abbonamento mensile"
          : "Cancelar suscripción mensual"
  ), [locale]);

  const sortedSubmissions = useMemo(() => {
    return [...(dashboard?.submissions ?? [])].sort((a, b) => {
      const aTime = new Date(a.updatedAt ?? a.resubmittedAt ?? a.createdAt ?? 0).getTime();
      const bTime = new Date(b.updatedAt ?? b.resubmittedAt ?? b.createdAt ?? 0).getTime();
      return bTime - aTime;
    });
  }, [dashboard?.submissions]);

  const openPlanRequest = useCallback((
    plan: "basic_free" | "featured" | "monthly",
    sourceSubmission?: PortalSubmission | null,
    sourceInitialData?: Record<string, unknown> | null,
  ) => {
    const sourceInitialPlan = normalizePortalPlanType(sourceInitialData?.planType ?? sourceInitialData?.publicationPlan ?? sourceInitialData?.requestedPlan);
    const previous = sourceSubmission?.planType === "featured" || sourceSubmission?.planType === "monthly"
      ? sourceSubmission.planType
      : sourceInitialPlan === "featured" || sourceInitialPlan === "monthly"
        ? sourceInitialPlan
      : currentPlanType === "featured" || currentPlanType === "monthly"
        ? currentPlanType
        : "basic_free";
    let requestKind: "new_publication" | "renew_free" | "renew_featured_120d" | "renew_featured_monthly" | "upgrade_featured_120d" | "upgrade_featured_monthly" | "downgrade_free" = "new_publication";
    if (plan === "basic_free") {
      if (sourceSubmission?.id || latestApprovedSubmission?.id) {
        requestKind = previous === "basic_free" ? "renew_free" : "downgrade_free";
      }
    } else if (plan === "featured") {
      requestKind = previous === "featured" ? "renew_featured_120d" : "upgrade_featured_120d";
    } else {
      requestKind = previous === "monthly" ? "renew_featured_monthly" : "upgrade_featured_monthly";
    }
    setModalPlanIntent(plan);
    setPreferredPaidPlanType(plan === "monthly" ? "featured_monthly" : "featured_120d");
    setModalVisiblePlans([plan]);
    setModalRequestKind(requestKind);
    setModalPreviousPlan(previous);
    setModalSourceServiceId(
      sourceSubmission?.id ||
      String(sourceInitialData?.sourceServiceId ?? "").trim() ||
      latestApprovedSubmission?.id,
    );
    setModalSourcePublicationId(String(sourceInitialData?.sourcePublicationId ?? "").trim() || undefined);
    setModalPublicationChangeMode(false);
    setModalInitialData(sourceInitialData ?? (sourceSubmission?.draftData as Record<string, unknown> | undefined) ?? null);
    setModalResumeMode(false);
    setModalResumeSubmissionId(undefined);
    setModalResumePaymentState("");
    setModalResumeStatusReason("");
    setOpenSubmissionModal(true);
  }, [currentPlanType, latestApprovedSubmission?.id]);

  const openSpecificNewPublicationRequest = useCallback((plan: "basic_free" | "featured" | "monthly") => {
    setModalPlanIntent(plan);
    setPreferredPaidPlanType(plan === "monthly" ? "featured_monthly" : "featured_120d");
    setModalVisiblePlans([plan]);
    setModalRequestKind("new_publication");
    setModalPreviousPlan(undefined);
    setModalSourceServiceId(undefined);
    setModalSourcePublicationId(undefined);
    setModalPublicationChangeMode(false);
    setModalInitialData(null);
    setModalResumeMode(false);
    setModalResumeSubmissionId(undefined);
    setModalResumePaymentState("");
    setModalResumeStatusReason("");
    setOpenSubmissionModal(true);
  }, [latestApprovedSubmission?.draftData]);

  const buildPublicationEditInitialData = useCallback((publication: PortalPublication, relatedSubmission?: PortalSubmission | null) => {
    const fields = (publication.fields && typeof publication.fields === "object" ? publication.fields : {}) as Record<string, unknown>;
    const relatedDraft = relatedSubmission?.draftData && typeof relatedSubmission.draftData === "object"
      ? relatedSubmission.draftData
      : {};
    const textValue = (value: unknown) => String(value ?? "").trim();
    const stringArray = (value: unknown) => Array.isArray(value)
      ? value.map((entry) => String(entry ?? "").trim()).filter(Boolean)
      : [];
    const firstNonEmptyArray = (...values: unknown[]) => {
      for (const value of values) {
        const entries = stringArray(value);
        if (entries.length) return entries;
      }
      return [];
    };
    const objectArray = (value: unknown) => Array.isArray(value)
      ? value.filter((entry) => entry && typeof entry === "object") as Record<string, unknown>[]
      : [];
    const firstNonEmptyObjectArray = (...values: unknown[]) => {
      for (const value of values) {
        const entries = objectArray(value);
        if (entries.length) return entries;
      }
      return [];
    };
    const firstText = (...values: unknown[]) => {
      for (const value of values) {
        const next = textValue(value);
        if (next) return next;
      }
      return "";
    };
    const firstLocation = Array.isArray(fields.headquarterLocations) && fields.headquarterLocations[0] && typeof fields.headquarterLocations[0] === "object"
      ? fields.headquarterLocations[0] as Record<string, unknown>
      : null;
    const categorySelections = firstNonEmptyArray(
      relatedDraft.category,
      fields.categorySelections,
      [publication.category, publication.subcategory],
    );
    const detailedLinksFromData = firstNonEmptyObjectArray(relatedDraft.socialLinksDetailed, fields.socialLinksDetailed);
    const socialLinksDetailed = detailedLinksFromData.length
      ? detailedLinksFromData
      : Array.isArray(publication.socialLinks)
        ? publication.socialLinks.map((url) => ({ kind: "web", url, label: "" }))
        : [];
    const priceByCurrencyFromData = firstNonEmptyObjectArray(relatedDraft.priceByCurrency, fields.priceByCurrency);
    const priceByCurrency = priceByCurrencyFromData.length
      ? priceByCurrencyFromData
      : publication.price || publication.currency
        ? [{ currency: publication.currency || "USD", amount: publication.price || "" }]
        : [];
    return {
      ...relatedDraft,
      name: firstText(relatedDraft.name, relatedDraft.profileName, publication.providerName, fields.publisherName),
      category: categorySelections,
      typeProfile: firstNonEmptyArray(relatedDraft.typeProfile, fields.typeProfile, fields.providerTypes),
      isOfrezco: fields.isOfrezco === true || relatedDraft.isOfrezco === true,
      isIntermediario: fields.isIntermediario === true || relatedDraft.isIntermediario === true,
      destinationCountry: firstText(relatedDraft.destinationCountry, relatedDraft.country, publication.country, Array.isArray(fields.travelDestinations) ? (fields.travelDestinations[0] as Record<string, unknown> | undefined)?.country : ""),
      country: firstText(relatedDraft.country, publication.country),
      city: firstText(relatedDraft.city, publication.city, firstLocation?.city),
      headquarterCountry: firstText(relatedDraft.headquarterCountry, publication.headquarterCountry, firstLocation?.country, publication.country),
      headquarterCity: firstText(relatedDraft.headquarterCity, publication.city, firstLocation?.city),
      headquarterMapUrl: firstText(relatedDraft.headquarterMapUrl, relatedDraft.destinationMapUrl, firstLocation?.mapUrl, fields.locationAddress),
      venues: Array.isArray(relatedDraft.venues) && relatedDraft.venues.length ? relatedDraft.venues : Array.isArray(fields.headquarterLocations) ? fields.headquarterLocations : [],
      receivingCountriesMode: firstText(relatedDraft.receivingCountriesMode, fields.receivingCountriesMode, "all"),
      receivingCountries: firstNonEmptyArray(relatedDraft.receivingCountries, fields.receivingCountries),
      languages: firstNonEmptyArray(relatedDraft.languages, publication.languages, fields.languages),
      contanos: firstText(relatedDraft.contanos, relatedDraft.description, publication.description),
      description: firstText(relatedDraft.description, relatedDraft.contanos, publication.description),
      website: firstText(relatedDraft.website, publication.website),
      images: firstNonEmptyArray(relatedDraft.images, publication.images, fields.images),
      imageAssets: Array.isArray(relatedDraft.imageAssets) && relatedDraft.imageAssets.length ? relatedDraft.imageAssets : Array.isArray(fields.imageAssets) ? fields.imageAssets : [],
      providerLogo: firstText(relatedDraft.providerLogo, fields.providerLogo),
      providerLogoAsset: relatedDraft.providerLogoAsset ?? fields.providerLogoAsset ?? null,
      included: firstText(relatedDraft.included, fields.included),
      notIncluded: firstText(relatedDraft.notIncluded, fields.notIncluded),
      socialLinksDetailed,
      socialLinks: firstNonEmptyArray(relatedDraft.socialLinks, publication.socialLinks),
      price: firstText(relatedDraft.price, publication.price),
      currency: firstText(relatedDraft.currency, publication.currency),
      priceByCurrency,
      priceNegotiable: fields.priceNegotiable === true || relatedDraft.priceNegotiable === true,
      pricePeriod: firstText(relatedDraft.pricePeriod, fields.pricePeriod, "month"),
      planType: normalizePortalPlanType(fields.publicationPlan ?? fields.requestedPlan ?? fields.planType ?? publication.requestedPlan ?? publication.planType),
      publicationPlan: normalizePortalPlanType(fields.publicationPlan ?? fields.requestedPlan ?? fields.planType ?? publication.requestedPlan ?? publication.planType),
      sourcePublicationId: publication.id,
      sourceServiceId: publication.sourceServiceId || relatedSubmission?.id || "",
      requestKind: "edit_publication",
    };
  }, []);

  const openPublicationChangeRequest = useCallback((publication: PortalPublication, relatedSubmission?: PortalSubmission | null) => {
    const fieldPlan = normalizePortalPlanType(
      (publication.fields as Record<string, unknown> | undefined)?.publicationPlan ??
      (publication.fields as Record<string, unknown> | undefined)?.requestedPlan ??
      (publication.fields as Record<string, unknown> | undefined)?.planType ??
      "",
    );
    const submissionPlan = normalizePortalPlanType(relatedSubmission?.requestedPlan ?? relatedSubmission?.planType);
    const publicationPlan = normalizePortalPlanType(publication.requestedPlan ?? publication.planType);
    const plan = publication.featured
      ? (fieldPlan === "monthly" || submissionPlan === "monthly" || publicationPlan === "monthly" ? "monthly" : "featured")
      : fieldPlan !== "basic_free"
        ? fieldPlan
        : submissionPlan !== "basic_free"
          ? submissionPlan
          : publicationPlan;
    setModalPlanIntent(plan);
    setPreferredPaidPlanType(plan === "monthly" ? "featured_monthly" : "featured_120d");
    setModalVisiblePlans([plan]);
    setModalRequestKind("edit_publication");
    setModalPreviousPlan(plan);
    setModalSourceServiceId(publication.sourceServiceId || relatedSubmission?.id || undefined);
    setModalSourcePublicationId(publication.id);
    setModalPublicationChangeMode(true);
    setModalInitialData(buildPublicationEditInitialData(publication, relatedSubmission));
    setModalResumeMode(false);
    setModalResumeSubmissionId(undefined);
    setModalResumePaymentState("");
    setModalResumeStatusReason("");
    setOpenSubmissionModal(true);
  }, [buildPublicationEditInitialData]);

  const deleteSubmission = useCallback(async (submission: PortalSubmission) => {
    if (typeof window !== "undefined" && !window.confirm(copy.submissionDeleteConfirm)) return;
    setDeletingSubmissionId(submission.id);
    try {
      const response = await fetch(`/api/provider-portal/submissions/${encodeURIComponent(submission.id)}`, {
        method: "DELETE",
        cache: "no-store",
        credentials: "include",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) {
        throw new Error(String(data?.error ?? copy.deleteSubmissionError));
      }
      toast.success(copy.submissionDeleted);
      await loadSession();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.deleteSubmissionError);
    } finally {
      setDeletingSubmissionId(null);
    }
  }, [copy.deleteSubmissionError, copy.submissionDeleteConfirm, copy.submissionDeleted, loadSession]);

  const requestRefund = useCallback(async (submission: PortalSubmission) => {
    setRefundingSubmissionId(submission.id);
    try {
      const response = await fetch(`/api/provider-portal/submissions/${encodeURIComponent(submission.id)}`, {
        method: "PUT",
        cache: "no-store",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request_refund" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) {
        throw new Error(String(data?.error ?? copy.refundError));
      }
      toast.success(locale === "en" ? "Refund requested." : locale === "pt" ? "Reembolso solicitado." : locale === "it" ? "Rimborso richiesto." : "Reembolso solicitado.");
      await loadSession();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.refundError);
    } finally {
      setRefundingSubmissionId(null);
    }
  }, [copy.refundError, loadSession, locale]);

  const cancelMonthlySubscription = useCallback(async (submission: PortalSubmission | null | undefined) => {
    const submissionId = String(submission?.id ?? "").trim();
    if (!submissionId) {
      toast.error(locale === "en" ? "We could not find the linked monthly request." : locale === "pt" ? "Nao foi possivel encontrar a solicitacao mensal vinculada." : locale === "it" ? "Non è stato possibile trovare la richiesta mensile collegata." : "No pudimos encontrar la solicitud mensual vinculada.");
      return;
    }
    setCancellingMonthlySubmissionId(submissionId);
    try {
      const response = await fetch(`/api/provider-portal/submissions/${encodeURIComponent(submissionId)}`, {
        method: "PUT",
        cache: "no-store",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cancel_monthly_subscription",
          locale,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) {
        throw new Error(String(data?.error ?? copy.cancelMonthlyError));
      }
      toast.success(locale === "en" ? "Monthly subscription cancelled." : locale === "pt" ? "Assinatura mensal cancelada." : locale === "it" ? "Abbonamento mensile annullato." : "Suscripción mensual cancelada.");
      await loadSession();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.cancelMonthlyError);
    } finally {
      setCancellingMonthlySubmissionId(null);
    }
  }, [copy.cancelMonthlyError, loadSession, locale]);

  const visiblePublicationEntries = useMemo(() => {
    const publications = [...(dashboard?.publications ?? [])];
    const submissions = [...(dashboard?.submissions ?? [])];
    const approvedStatuses = new Set(["aprobado", "approved", "active", "activo", "paid"]);
    const approvedSubmissions = submissions
      .filter((item) => approvedStatuses.has(String(item.status ?? "").trim().toLowerCase()))
      .sort((a, b) => {
        const aTime = new Date(a.updatedAt ?? a.approvedAt ?? a.createdAt ?? 0).getTime();
        const bTime = new Date(b.updatedAt ?? b.approvedAt ?? b.createdAt ?? 0).getTime();
        return bTime - aTime;
      });
    const latestSubmissionsBySourceId = new Map<string, PortalSubmission>();
    [...submissions].sort((a, b) => {
      const aTime = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime();
      const bTime = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime();
      return aTime - bTime; // oldest first so newest overwrites
    }).forEach(sub => {
      if (sub.sourceServiceId) latestSubmissionsBySourceId.set(sub.sourceServiceId, sub);
      const sourcePublicationId = String((sub.draftData as Record<string, unknown> | undefined)?.sourcePublicationId ?? "").trim();
      if (sourcePublicationId) latestSubmissionsBySourceId.set(`publication:${sourcePublicationId}`, sub);
    });
    const usedSubmissionIds = new Set<string>();
    return publications
      .sort((a, b) => {
        const aTime = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime();
        const bTime = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime();
        return bTime - aTime;
      })
      .map((publication) => {
        const explicitId = String(publication.relatedSubmissionId ?? publication.sourceServiceId ?? "").trim();
        const publicationTime = new Date(publication.updatedAt ?? publication.createdAt ?? 0).getTime();
        let relatedSubmission =
          approvedSubmissions.find((item) => item.id === explicitId || item.sourceServiceId === explicitId) ?? null;
        const latestLinkedSubmission = latestSubmissionsBySourceId.get(`publication:${publication.id}`) ?? null;
        if (latestLinkedSubmission && approvedStatuses.has(String(latestLinkedSubmission.status ?? "").trim().toLowerCase())) {
          relatedSubmission = latestLinkedSubmission;
        }
        if (!relatedSubmission) {
          relatedSubmission =
            approvedSubmissions
              .filter((item) => !usedSubmissionIds.has(item.id))
              .sort((a, b) => {
                const aTime = new Date(a.updatedAt ?? a.approvedAt ?? a.createdAt ?? 0).getTime();
                const bTime = new Date(b.updatedAt ?? b.approvedAt ?? b.createdAt ?? 0).getTime();
                const aDistance = Math.abs(publicationTime - aTime);
                const bDistance = Math.abs(publicationTime - bTime);
                return aDistance - bDistance;
              })[0] ?? null;
        }
        if (relatedSubmission?.id) usedSubmissionIds.add(relatedSubmission.id);
        const submissionPlanType = normalizePortalPlanType(
          relatedSubmission?.requestedPlan ??
          relatedSubmission?.planType,
        );
        const publicationPlanType = normalizePortalPlanType(
          publication.requestedPlan ??
          publication.planType ??
          (publication.featured ? "featured" : "basic_free"),
        );
        const effectivePlanType =
          publicationPlanType === "basic_free" && submissionPlanType !== "basic_free"
            ? submissionPlanType
            : publicationPlanType;
        const effectiveExpiration =
          effectivePlanType !== "basic_free" && relatedSubmission?.expirationAt
            ? relatedSubmission.expirationAt
            : publication.expiration;
        const latestInfoSubmission =
          (relatedSubmission?.id ? latestSubmissionsBySourceId.get(relatedSubmission.id) : null)
          ?? latestSubmissionsBySourceId.get(`publication:${publication.id}`)
          ?? null;

        return {
          publication,
          relatedSubmission,
          effectivePlanType,
          effectiveExpiration,
          needsInfoSubmission: latestInfoSubmission?.status === "needs_info" ? latestInfoSubmission : null,
          monthlyCancellationScheduled:
            hasMonthlyCancellationScheduled(relatedSubmission)
            || hasMonthlyCancellationScheduled({
              planType: effectivePlanType,
              monthlyAutoRenew: publication.monthlyAutoRenew,
              monthlySubscriptionStatus: publication.monthlySubscriptionStatus,
            }),
          monthlyCancellationAt:
            String(
              relatedSubmission?.monthlySubscriptionCancelledAt ??
              publication.monthlySubscriptionCancelledAt ??
              "",
            ).trim() || null,
        };
      });
  }, [dashboard?.publications, dashboard?.submissions]);

  const sortedVisiblePublicationEntries = useMemo<VisiblePublicationEntry[]>(() => {
    return [...visiblePublicationEntries].sort((a, b) => {
      const aStatus = String(a.publication.status ?? "").trim().toLowerCase();
      const bStatus = String(b.publication.status ?? "").trim().toLowerCase();
      const aRank = ["approved", "active", "published"].includes(aStatus) ? 0 : 1;
      const bRank = ["approved", "active", "published"].includes(bStatus) ? 0 : 1;
      if (aRank !== bRank) return aRank - bRank;
      const planDiff = planSortRank(a.effectivePlanType) - planSortRank(b.effectivePlanType);
      if (planDiff !== 0) return planDiff;
      const aTime = new Date(a.publication.updatedAt ?? a.publication.createdAt ?? 0).getTime();
      const bTime = new Date(b.publication.updatedAt ?? b.publication.createdAt ?? 0).getTime();
      return bTime - aTime;
    });
  }, [planSortRank, visiblePublicationEntries]);

  const planDistribution = useMemo(() => {
    const groups = new Map<"monthly" | "featured" | "basic_free", {
      planType: "monthly" | "featured" | "basic_free";
      count: number;
      nearestExpiration: string | null;
      statuses: string[];
    }>();
    for (const entry of sortedVisiblePublicationEntries) {
      const planType = entry.effectivePlanType;
      const current = groups.get(planType) ?? { planType, count: 0, nearestExpiration: null, statuses: [] };
      current.count += 1;
      current.statuses.push(String(entry.publication.status ?? ""));
      const nextExpiration = entry.effectiveExpiration ? new Date(entry.effectiveExpiration).getTime() : Number.POSITIVE_INFINITY;
      const savedExpiration = current.nearestExpiration ? new Date(current.nearestExpiration).getTime() : Number.POSITIVE_INFINITY;
      if (nextExpiration < savedExpiration) current.nearestExpiration = entry.effectiveExpiration;
      groups.set(planType, current);
    }
    for (const submission of dashboard?.submissions ?? []) {
      if (!["aprobado", "approved", "active", "activo", "paid"].includes(String(submission.status ?? "").trim().toLowerCase())) continue;
      if (sortedVisiblePublicationEntries.some((entry) => entry.relatedSubmission?.id === submission.id)) continue;
      const planType = normalizePortalPlanType(submission.requestedPlan ?? submission.planType);
      const current = groups.get(planType) ?? { planType, count: 0, nearestExpiration: null, statuses: [] };
      current.count += 1;
      current.statuses.push(String(submission.status ?? ""));
      const nextExpiration = submission.expirationAt ? new Date(submission.expirationAt).getTime() : Number.POSITIVE_INFINITY;
      const savedExpiration = current.nearestExpiration ? new Date(current.nearestExpiration).getTime() : Number.POSITIVE_INFINITY;
      if (nextExpiration < savedExpiration) current.nearestExpiration = submission.expirationAt;
      groups.set(planType, current);
    }
    return Array.from(groups.values()).sort((a, b) => planSortRank(a.planType) - planSortRank(b.planType));
  }, [dashboard?.submissions, planSortRank, sortedVisiblePublicationEntries]);
  const visiblePlanDistribution = useMemo(
    () => planDistribution.filter((group) => group.planType !== "monthly"),
    [planDistribution]
  );

  const planCards = useMemo(() => {
    const featuredReady = Boolean(featured120Price && Number(featured120Price.amount ?? 0) > 0);
    return [
      {
        key: "free",
        kind: "free",
        icon: ShieldCheck,
        title: copy.free,
        description: copy.freeDescription,
        price: locale === "en" ? "Free" : locale === "pt" ? "Gratis" : locale === "it" ? "Gratis" : "Gratis",
        benefits: planBenefits.free,
        current: false,
        disabled: false,
        helper: copy.newSubmissionHint,
        actionLabel: copy.publishFreeAction,
        action: () => openSpecificNewPublicationRequest("basic_free"),
      },
      {
        key: "featured",
        kind: "featured",
        icon: Crown,
        title: copy.featured,
        description: copy.featuredDescription,
        price: featured120Label,
        benefits: planBenefits.featured,
        current: false,
        disabled: !featuredReady,
        helper: featuredReady ? copy.newSubmissionHint : copy.priceUnavailableHint,
        actionLabel: copy.publishFeaturedAction,
        action: () => openSpecificNewPublicationRequest("featured"),
      },
    ];
  }, [copy.featured, copy.featuredDescription, copy.free, copy.freeDescription, copy.newSubmissionHint, copy.priceUnavailableHint, copy.publishFeaturedAction, copy.publishFreeAction, featured120Label, featured120Price, locale, openSpecificNewPublicationRequest, planBenefits.featured, planBenefits.free]);

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
                  disabled={requestingLink || !turnstileToken}
                  className="rounded-2xl bg-[#0B8FA3] px-5 py-3 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
                >
                  {requestingLink ? copy.sending : copy.sendLink}
                </button>
              </div>
              <TurnstileWidget
                resetKey={turnstileResetKey}
                onTokenChange={setTurnstileToken}
                className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-2"
              />
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
                  {!visiblePlanDistribution.length ? (
                  <div className="flex flex-wrap gap-2">
                    {currentPlanCreatedAt ? (
                      <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">
                        {copy.createdAt}: {formatDate(currentPlanCreatedAt, locale)}
                      </span>
                    ) : null}
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeClasses(currentPlanType === "featured" ? "featured" : "free")}`}>
                      {currentPlanType === "featured" ? copy.featured : copy.free}
                    </span>
                    {currentPlanExpiresAt ? (
                      <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">
                        {copy.expiresAt}: {formatDate(currentPlanExpiresAt, locale)}
                      </span>
                    ) : null}
                  </div>
                  ) : null}
                  {visiblePlanDistribution.length ? (
                    <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      {visiblePlanDistribution.map((group) => {
                        const badge = planBadge(group.planType);
                        const topStatus = group.statuses.find(Boolean) ?? "";
                        return (
                          <div key={`plan-distribution-${group.planType}`} className="rounded-xl border border-white bg-white px-3 py-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${badgeClasses(badge.kind)}`}>{badge.label}</span>
                              <span className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{group.count}</span>
                              {topStatus ? (
                                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${badgeClasses(topStatus.toLowerCase() === "approved" ? "approved" : "default")}`}>
                                  {topStatus}
                                </span>
                              ) : null}
                            </div>
                            {group.nearestExpiration ? (
                              <div className="mt-2 text-xs text-slate-500">{copy.expiresAt}: {formatDate(group.nearestExpiration, locale)}</div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs leading-relaxed text-slate-500">{planCopy.currentPlanBody}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => publishCardsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className="rounded-2xl bg-[#0B8FA3] px-5 py-3 text-sm font-semibold text-white hover:opacity-95"
              >
                {copy.jumpToPublishOptions}
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

            <div className="grid gap-6 xl:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">{copy.submissionsTitle}</h3>
                    <p className="mt-1 text-xs text-slate-500">{compactHistoryHint}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {dashboard?.submissions.length ?? 0}
                  </span>
                </div>
                <div className="mt-4 max-h-[420px] space-y-2 overflow-y-auto pr-1">
                  {sortedSubmissions.length ? sortedSubmissions.map((item) => {
                    const plan = planBadge(item.planType);
                    const statusKind = visualSubmissionKind(item);
                    const statusLabel = visualSubmissionLabel(item);
                    const paymentView = getPortalPaymentView(item);
                    const paymentLabel = visualPaymentLabel(item);
                    const requestedPlan = String(item.requestedPlan ?? "").trim().toLowerCase();
                    const isFreeRequest =
                      normalizePortalPlanType(item.planType) === "basic_free" &&
                      !["featured", "featured_120d", "monthly", "featured_monthly"].includes(requestedPlan);
                    const showPaymentInfo = !isFreeRequest;
                    const normalizedStatus = String(item.status ?? "").trim().toLowerCase();
                    const isApproved = ["aprobado", "approved", "active", "activo", "paid"].includes(normalizedStatus);
                    const canDelete = !isApproved && paymentView !== "confirmed" && paymentView !== "review";
                    const refundStatus = String(item.refundStatus ?? "").trim().toLowerCase();
                    const paymentConfirmed = isConfirmedPortalPayment(item);
                    const hasProviderPaymentId = Boolean(getResolvedProviderPaymentId(item));
                    const isResubmitted = Boolean(item.resubmittedAt || item.draftData?.resubmittedAt);
                    const showEditButton = normalizedStatus === "needs_info" && !isResubmitted;
                    const refundActiveOrFinal = ["refund_requested", "refund_reviewing", "refund_processing", "refunded", "refund_failed"].includes(refundStatus);
                    const canRequestRefund =
                      ["rejected", "needs_info"].includes(normalizedStatus) &&
                      paymentConfirmed &&
                      hasProviderPaymentId &&
                      !refundActiveOrFinal &&
                      !(normalizedStatus === "needs_info" && isResubmitted);
                    const isMonthlyPaidRequest =
                      item.planType === "monthly" ||
                      String(item.requestedPlan ?? "").trim().toLowerCase() === "monthly" ||
                      String(item.requestedPlan ?? "").trim().toLowerCase() === "featured_monthly";
                    const monthlyCancellationScheduled = hasMonthlyCancellationScheduled(item);
                    const canCancelMonthlySubscription =
                      isMonthlyPaidRequest &&
                      isApproved &&
                      paymentConfirmed &&
                      !monthlyCancellationScheduled &&
                      !refundActiveOrFinal;

                    const canShowManualRefundReview =
                      ["rejected", "needs_info"].includes(normalizedStatus) &&
                      paymentConfirmed &&
                      !hasProviderPaymentId &&
                      !refundActiveOrFinal &&
                      !(normalizedStatus === "needs_info" && isResubmitted);
                    return (
                      <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-slate-900">{item.profileName || item.email}</span>
                            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${badgeClasses(plan.kind)}`}>{plan.label}</span>
                            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${badgeClasses(statusKind)}`}>{copy.status}: {decodeLikelyMojibake(statusLabel)}</span>
                            {showPaymentInfo ? (
                              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${badgeClasses(visualPaymentKind(item))}`}>{paymentLabel}</span>
                            ) : null}
                            {refundStatus ? (
                              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${badgeClasses(visualRefundKind(item.refundStatus))}`}>{visualRefundLabel(item.refundStatus)}</span>
                            ) : null}
                          </div>
                         {showEditButton || canDelete || canRequestRefund || canCancelMonthlySubscription ? (
                            <div className="flex flex-wrap gap-2">
                              {showEditButton ? (
                                <button
                                  type="button"
                                  onClick={() => openResumeSubmission(item)}
                                  className="rounded-xl border border-cyan-200 bg-white px-3 py-1.5 text-xs font-semibold text-cyan-700 hover:bg-cyan-50"
                                >
                                  {locale === "en" ? "Update information" : locale === "pt" ? "Actualizar informação" : locale === "it" ? "Aggiorna informazioni" : "Actualizar información"}
                                </button>
                              ) : null}
                              {canRequestRefund ? (
                                <button
                                  type="button"
                                  onClick={() => void requestRefund(item)}
                                  disabled={refundingSubmissionId === item.id}
                                  className="rounded-xl border border-amber-200 bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {refundingSubmissionId === item.id
                                    ? (locale === "en" ? "Requesting..." : locale === "pt" ? "Solicitando..." : locale === "it" ? "Richiesta..." : "Solicitando...")
                                    : (locale === "en" ? "Request refund" : locale === "pt" ? "Solicitar reembolso" : locale === "it" ? "Richiedi rimborso" : "Solicitar reembolso")}
                                </button>
                              ) : null}
                              {canCancelMonthlySubscription ? (
                                <button
                                  type="button"
                                  onClick={() => void cancelMonthlySubscription(item)}
                                  disabled={cancellingMonthlySubmissionId === item.id}
                                  className="rounded-xl border border-violet-200 bg-white px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {cancellingMonthlySubmissionId === item.id
                                    ? (locale === "en" ? "Cancelling..." : locale === "pt" ? "Cancelando..." : locale === "it" ? "Annullamento..." : "Cancelando...")
                                    : cancelMonthlyLabel}
                                </button>
                              ) : null}
                              {canDelete ? (
                                <button
                                  type="button"
                                  onClick={() => void deleteSubmission(item)}
                                  disabled={deletingSubmissionId === item.id}
                                  className="rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {deletingSubmissionId === item.id ? copy.deletingSubmission : copy.submissionDelete}
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                        <div className="mt-2 grid gap-x-4 gap-y-1.5 text-sm text-slate-600 sm:grid-cols-2">
                          <div><span className="font-medium text-slate-800">{copy.destination}:</span> {item.destinationCountry || "-"}</div>
                          {showPaymentInfo ? (
                            <div><span className="font-medium text-slate-800">{copy.payment}:</span> {decodeLikelyMojibake(paymentLabel)}</div>
                          ) : null}
                          <div><span className="font-medium text-slate-800">{copy.createdAt}:</span> {formatDate(item.createdAt, locale)}</div>
                          <div><span className="font-medium text-slate-800">{copy.expiresAt}:</span> {formatDate(item.expirationAt, locale)}</div>
                          {item.statusUpdatedAt ? (
                            <div><span className="font-medium text-slate-800">{t("admin.request.updatedAt")}:</span> {formatDate(item.statusUpdatedAt, locale)}</div>
                          ) : null}
                          <div className="sm:col-span-2"><span className="font-medium text-slate-800">{planCopy.requestType}:</span> {requestKindLabel(item.requestKind)}</div>
                          {item.previousPlan ? (
                            <div><span className="font-medium text-slate-800">{locale === "en" ? "Previous plan" : locale === "pt" ? "Plano anterior" : locale === "it" ? "Piano precedente" : "Plan anterior"}:</span> {item.previousPlan === "monthly" ? copy.monthly : item.previousPlan === "featured" ? copy.featured : copy.free}</div>
                          ) : null}
                          {item.requestedPlan ? (
                            <div><span className="font-medium text-slate-800">{locale === "en" ? "Requested plan" : locale === "pt" ? "Plano solicitado" : locale === "it" ? "Piano richiesto" : "Plan solicitado"}:</span> {item.requestedPlan === "featured_monthly" || item.requestedPlan === "monthly" ? copy.monthly : item.requestedPlan === "featured_120d" || item.requestedPlan === "featured" ? copy.featured : copy.free}</div>
                          ) : null}
                          {item.statusReason ? (
                            <div className="sm:col-span-2"><span className="font-medium text-slate-800">{t("admin.request.reason")}:</span> {decodeLikelyMojibake(item.statusReason)}</div>
                          ) : null}
                          {item.resubmittedAt || (item.draftData as Record<string, unknown> | undefined)?.resubmittedAt ? (
                            <div><span className="font-medium text-slate-800">{t("admin.request.resubmittedAt")}:</span> {formatDate(String(item.resubmittedAt ?? (item.draftData as Record<string, unknown> | undefined)?.resubmittedAt ?? ""), locale)}</div>
                          ) : null}
                          {refundStatus ? (
                            <div className="sm:col-span-2">
                              <span className="font-medium text-slate-800">{t("admin.request.refundStatus")}:</span> {visualRefundLabel(item.refundStatus)}
                              {item.refundProviderReference ? ` · ${item.refundProviderReference}` : ""}
                            </div>
                          ) : null}
                          {refundStatus === "refund_processing" ? (
                            <div className="sm:col-span-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                              {t("providerPortal.refund.pendingNotice")}
                            </div>
                          ) : null}
                          {showEditButton ? (
                            <div className="sm:col-span-2 rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs text-cyan-900">
                              <span className="font-semibold">{t("reanudar_solicitud")}:</span> {t("si_ya_pagaste_no_pagas_de_nuevo")}
                            </div>
                          ) : null}
                          {monthlyCancellationScheduled ? (
                            <div className="sm:col-span-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-900">
                              {locale === "en"
                                ? `Monthly subscription cancelled. The publication stays active until ${formatDate(item.expirationAt, locale)} and will not renew again.`
                                : locale === "pt"
                                  ? `A assinatura mensal foi cancelada. A publicaçao continua ativa até ${formatDate(item.expirationAt, locale)} e nao vai renovar novamente.`
                                  : locale === "it"
                                    ? `L'abbonamento mensile e stato annullato. La pubblicazione resta attiva fino al ${formatDate(item.expirationAt, locale)} e non si rinnoverà di nuovo.`
                                    : `La suscripción mensual fue cancelada. La publicación sigue activa hasta ${formatDate(item.expirationAt, locale)} y no volverá a renovarse.`}
                            </div>
                          ) : null}
                          {canRequestRefund ? (
                            <div className="sm:col-span-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                              {locale === "en"
                                ? "If your payment was already confirmed, the admin can review and execute the refund from here."
                                : locale === "pt"
                                  ? "Se o pagamento ja foi confirmado, o admin pode revisar e ejecutar o reembolso daqui."
                                  : locale === "it"
                                    ? "Se il pagamento e gia stato confermato, l'admin puo rivedere ed eseguire il rimborso da qui."
                                    : "Si tu pago ya fue confirmado, el admin puede revisar y ejecutar el reembolso desde aca."}
                            </div>
                          ) : (
                           canShowManualRefundReview ? (
                              <div className="sm:col-span-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
                                {locale === "en"
                                  ? "This payment requires manual review before requesting a refund."
                                  : locale === "pt"
                                    ? "Este pagamento requer revisão manual antes de solicitar un reembolso."
                                    : locale === "it"
                                      ? "Questo pagamento richiede una revisione manuale prima di richiedere un rimborso."
                                      : "Este pago requiere revisión manual antes de solicitar un reembolso."}
                              </div>
                            ) : null
                          )}
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
                  {sortedVisiblePublicationEntries.length ? sortedVisiblePublicationEntries.map(({ publication, relatedSubmission, effectivePlanType, effectiveExpiration, needsInfoSubmission, monthlyCancellationScheduled }) => {
                    const badge = planBadge(effectivePlanType);
                    const canOpenFromHistory = relatedSubmission ?? latestApprovedSubmission;
                    return (
                    <div key={publication.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">{publication.title || publication.id}</span>
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${badgeClasses(badge.kind)}`}>{badge.label}</span>
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${badgeClasses(publication.status?.toLowerCase() === "approved" ? "approved" : "default")}`}>{copy.status}: {publication.status || "-"}</span>
                      </div>
                      <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                        <div><span className="font-medium text-slate-800">{copy.destination}:</span> {[publication.city, publication.country].filter(Boolean).join(", ") || "-"}</div>
                        <div><span className="font-medium text-slate-800">{copy.createdAt}:</span> {formatDate(publication.createdAt, locale)}</div>
                        <div><span className="font-medium text-slate-800">{copy.expiresAt}:</span> {formatDate(effectiveExpiration, locale)}</div>
                        <div><span className="font-medium text-slate-800">{planCopy.linkedRequest}:</span> {relatedSubmission?.id || publication.sourceServiceId || "-"}</div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {monthlyCancellationScheduled ? (
                          <div className="w-full rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-900">
                            {locale === "en"
                              ? `Monthly cancellation scheduled. This publication remains active until ${formatDate(effectiveExpiration, locale)}.`
                              : locale === "pt"
                                ? `Cancelamento mensal agendado. Esta publicaçao continua ativa até ${formatDate(effectiveExpiration, locale)}.`
                                : locale === "it"
                                  ? `Cancellazione mensile programmata. Questa pubblicazione resta attiva fino al ${formatDate(effectiveExpiration, locale)}.`
                                  : `Cancelación mensual programada. Esta publicación sigue activa hasta ${formatDate(effectiveExpiration, locale)}.`}
                          </div>
                        ) : null}
                        {needsInfoSubmission ? (
                          <button
                            type="button"
                            onClick={() => openResumeSubmission(needsInfoSubmission)}
                            className="rounded-xl border border-orange-200 bg-white px-3 py-2 text-xs font-semibold text-orange-700 hover:bg-orange-50"
                          >
                            {locale === "en" ? "Update information" : locale === "pt" ? "Atualizar informação" : locale === "it" ? "Aggiorna informazioni" : "Actualizar información"}
                          </button>
                        ) : null}
                        <a
                          href={`/publicacion/${encodeURIComponent(publication.id)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-xl border border-cyan-200 bg-white px-3 py-2 text-xs font-semibold text-cyan-700 hover:bg-cyan-50"
                        >
                          {locale === "en" ? "View publication" : locale === "pt" ? "Ver publicação" : locale === "it" ? "Vedi pubblicazione" : "Ver publicación"}
                        </a>
                        <button
                          type="button"
                          onClick={() => openPublicationChangeRequest(publication, relatedSubmission)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          {locale === "en" ? "Request changes" : locale === "pt" ? "Solicitar alterações" : locale === "it" ? "Richiedi modifiche" : "Solicitar cambios"}
                        </button>
                        {effectivePlanType === "basic_free" ? (
                          <>
                            <button
                              type="button"
                              onClick={() => openPlanRequest("featured", canOpenFromHistory, buildPublicationEditInitialData(publication, relatedSubmission))}
                              className="rounded-xl bg-[#0B8FA3] px-3 py-2 text-xs font-semibold text-white hover:opacity-95"
                            >
                              {planCopy.upgradeToFeatured}
                            </button>
                          </>
                        ) : null}
                        {effectivePlanType === "featured" ? (
                          <>
                            <button
                              type="button"
                              onClick={() => openPlanRequest("featured", canOpenFromHistory, buildPublicationEditInitialData(publication, relatedSubmission))}
                              className="rounded-xl bg-[#0B8FA3] px-3 py-2 text-xs font-semibold text-white hover:opacity-95"
                            >
                              {planCopy.renewFeatured}
                            </button>
                            <button
                              type="button"
                              onClick={() => openPlanRequest("basic_free", canOpenFromHistory, buildPublicationEditInitialData(publication, relatedSubmission))}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                            >
                              {planCopy.downgradeThisPublication}
                            </button>
                          </>
                        ) : null}
                        {false ? (
                          <button
                            type="button"
                            onClick={() => void cancelMonthlySubscription(relatedSubmission)}
                            disabled={monthlyCancellationScheduled || !relatedSubmission?.id || cancellingMonthlySubmissionId === (relatedSubmission?.id ?? "")}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {monthlyCancellationScheduled
                              ? (locale === "en" ? "Monthly cancellation scheduled" : locale === "pt" ? "Cancelamento mensal agendado" : locale === "it" ? "Cancellazione mensile programmata" : "Cancelación mensual programada")
                              : cancellingMonthlySubmissionId === (relatedSubmission?.id ?? "")
                                ? (locale === "en" ? "Cancelling..." : locale === "pt" ? "Cancelando..." : locale === "it" ? "Annullamento..." : "Cancelando...")
                                : cancelMonthlyLabel}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  )}) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                      {copy.emptyPublications}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div
              ref={publishCardsRef}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="mx-auto max-w-3xl text-center">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{copy.publishOptionsTitle}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">{copy.publishOptionsBody}</p>
                </div>
              </div>
              <div className="mx-auto mt-6 grid max-w-[720px] gap-5 sm:grid-cols-2">
                {planCards.map((card) => (
                  <article
                    key={card.key}
                    className={`rounded-3xl border p-5 shadow-sm transition ${
                      card.disabled
                        ? "border-slate-200 bg-slate-50"
                        : "border-slate-200 bg-white hover:-translate-y-0.5 hover:shadow-md"
                    }`}
                  >
                    <div className="flex items-center gap-3 text-slate-700">
                      <div className={`rounded-2xl p-3 ${card.kind === "free" ? "bg-emerald-50 text-emerald-600" : card.kind === "monthly" ? "bg-violet-50 text-violet-600" : "bg-cyan-50 text-cyan-600"}`}>
                        <card.icon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-lg font-semibold text-slate-900">{card.title}</div>
                        <div className="text-sm text-slate-500">{card.price}</div>
                      </div>
                    </div>
                    <p className="mt-4 text-sm leading-relaxed text-slate-600">{card.description}</p>
                    <ul className="mt-4 space-y-2 text-sm text-slate-700">
                      {card.benefits.map((benefit) => (
                        <li key={`${card.key}-${benefit}`} className="flex items-start gap-2">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-emerald-500" />
                          <span>{benefit}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-4 text-xs leading-relaxed text-slate-500">{card.helper}</p>
                    <button
                      type="button"
                      onClick={card.action}
                      disabled={card.disabled}
                      className={`mt-5 w-full rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                        card.disabled
                          ? "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400"
                          : "bg-[#0B8FA3] text-white hover:opacity-95"
                      }`}
                    >
                      {card.actionLabel}
                    </button>
                  </article>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {openSubmissionModal && sessionEmail ? (
        <ModalOferente
          onClose={() => {
            setOpenSubmissionModal(false);
            setModalResumeMode(false);
            setModalResumeSubmissionId(undefined);
            setModalResumePaymentState("");
            setModalResumeStatusReason("");
            setModalSourcePublicationId(undefined);
            setModalPublicationChangeMode(false);
          }}
          initialEmail={sessionEmail}
          lockEmail
          visiblePlans={modalVisiblePlans}
          fixedCountry={baseCountry}
          initialPlan={modalPlanIntent}
          preferredPaidPlanType={preferredPaidPlanType}
          requestKind={modalRequestKind}
          previousPlan={modalPreviousPlan}
          sourceServiceId={modalSourceServiceId}
          sourcePublicationId={modalSourcePublicationId}
          publicationChangeMode={modalPublicationChangeMode}
          initialData={modalInitialData}
          resumeMode={modalResumeMode}
          resumeSubmissionId={modalResumeSubmissionId}
          resumePaymentState={modalResumePaymentState}
          resumeStatusReason={modalResumeStatusReason}
          onSubmitted={() => {
            setOpenSubmissionModal(false);
            setModalResumeMode(false);
            setModalSourcePublicationId(undefined);
            setModalPublicationChangeMode(false);
            void loadSession();
          }}
          onPaymentResolved={() => {
            setOpenSubmissionModal(false);
            setModalResumeMode(false);
            setModalSourcePublicationId(undefined);
            setModalPublicationChangeMode(false);
            void loadSession();
          }}
        />
      ) : null}
    </>
  );
}
