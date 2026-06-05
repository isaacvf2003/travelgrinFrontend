"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
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
  country: string;
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
  draftData?: Record<string, unknown>;
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
  providerEmail?: string;
  providerName?: string;
  planType?: "basic_free" | "featured" | "monthly";
  sourceServiceId?: string;
  requestKind?: string;
  previousPlan?: string;
  requestedPlan?: string;
  relatedSubmissionId?: string;
  relatedProfileName?: string;
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

function normalizePortalPlanType(value: unknown): "basic_free" | "featured" | "monthly" {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "featured" || raw === "featured_120d") return "featured";
  if (raw === "monthly" || raw === "featured_monthly") return "monthly";
  return "basic_free";
}

function fixMojibake(value: string) {
  if (!/[ÃƒÃ‚]/.test(value)) return value;
  try {
    const bytes = Uint8Array.from(value, (char) => char.charCodeAt(0));
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return value;
  }
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

function sanitizeCopy<T>(value: T): T {
  if (typeof value === "string") {
    const text = String(value);
    if (/[ÃÂâð�]/.test(text)) return fixMojibake(text) as T;
    return normalizeBrokenLatinText(text) as T;
  }
  if (Array.isArray(value)) return value.map((entry) => sanitizeCopy(entry)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, sanitizeCopy(entry as unknown)]),
    ) as T;
  }
  return value;
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

function forcePortalDisplayText(value: string) {
  return String(value ?? "")
    .replace(/Acced.+mismo lugar seguro\./gi, "Accedé a tus envíos, publicaciones y pedí una nueva publicación desde el mismo lugar seguro.")
    .replace(/Us.+Travelgrin\..+solo uso\./gi, "Usá el mismo email que dejaste en tu formulario de Travelgrin. Te vamos a enviar un enlace de acceso de un solo uso.")
    .replace(/Ingres.+email v.+lido\./gi, "Ingresá un email válido.")
    .replace(/El enlace vence en 20 minutos y la sesi.+n queda activa por 15 d.+as en este dispositivo\./gi, "El enlace vence en 20 minutos y la sesión queda activa por 15 días en este dispositivo.")
    .replace(/Ese enlace de acceso ya no es v.+lido\..+nuevo\./gi, "Ese enlace de acceso ya no es válido. Pedí uno nuevo.")
    .replace(/Sesi.+n activa/gi, "Sesión activa")
    .replace(/Cerrar sesi.+n/gi, "Cerrar sesión")
    .replace(/Us.+solicitud de publicaci.+n totalmente nueva sin cambiar tu plan actual\./gi, "Usá esto cuando quieras iniciar una solicitud de publicación totalmente nueva sin cambiar tu plan actual.")
    .replace(/Pedir otra publicaci.+n/gi, "Pedir otra publicación")
    .replace(/Crear una nueva publicaci.+n/gi, "Crear una nueva publicación")
    .replace(/Eleg.+el tipo de nueva publicaci.+n que quer.+s crear con esta misma cuenta de oferente\./gi, "Elegí el tipo de nueva publicación que querés crear con esta misma cuenta de oferente.")
    .replace(/Publicar publicaci.+n b.+sica/gi, "Publicar publicación básica")
    .replace(/Pendiente de revisi.+n/gi, "Pendiente de revisión")
    .replace(/Todav.+a no ten.+s env.+os con este email\./gi, "Todavía no tenés envíos con este email.")
    .replace(/El admin todav.+a no arm.+ publicaciones a partir de tus solicitudes\./gi, "El admin todavía no armó publicaciones a partir de tus solicitudes.")
    .replace(/Pago .nico\./gi, "Pago único.")
    .replace(/publicaci.+n impulsionada/gi, "publicación impulsionada")
    .replace(/Pasar esta publicaci.+n a mensual/gi, "Pasar esta publicación a mensual")
    .replace(/Volver esta publicaci.+n al gratis/gi, "Volver esta publicación al gratis")
    .replace(/Pasar esta publicaci.+n a destacado/gi, "Pasar esta publicación a destacado")
    .replace(/Crear otra publicaci.+n/gi, "Crear otra publicación")
    .replace(/publicaci.?.?n/gi, "publicación")
    .replace(/descripci.?.?n/gi, "descripción")
    .replace(/revisi.?.?n/gi, "revisión")
    .replace(/secci.?.?n/gi, "sección")
    .replace(/envi.?.?$/gi, "envió")
    .replace(/quer.?.?s/gi, "querés")
    .replace(/pod.?.?s/gi, "podés")
    .replace(/d.?.?as/gi, "días")
    .replace(/.nico/gi, "único")
    .replace(/galer.?.?a/gi, "galería")
    .replace(/im.?.?genes/gi, "imágenes")
    .replace(/sesi.?.?n/gi, "sesión")
    .replace(/categor.?.?a/gi, "categoría")
    .replace(/pa.?.?s/gi, "país");
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

function finalizePortalText(value: string) {
  return String(value ?? "")
    .replace(/AccedÃ©/g, "Accedé")
    .replace(/envÃ­os/g, "envíos")
    .replace(/pedÃ­/g, "pedí")
    .replace(/publicaciÃ³n/g, "publicación")
    .replace(/UsÃ¡/g, "Usá")
    .replace(/vÃ¡lido/g, "válido")
    .replace(/sesiÃ³n/g, "sesión")
    .replace(/dÃ­as/g, "días")
    .replace(/PedÃ­/g, "Pedí")
    .replace(/ElegÃ­/g, "Elegí")
    .replace(/querÃ©s/g, "querés")
    .replace(/bÃ¡sica/g, "básica")
    .replace(/revisiÃ³n/g, "revisión")
    .replace(/TodavÃ­a/g, "Todavía")
    .replace(/tenÃ©s/g, "tenés")
    .replace(/armÃ³/g, "armó")
    .replace(/Ãºnico/g, "único")
    .replace(/descripciÃ³n/g, "descripción")
    .replace(/galerÃ­a/g, "galería")
    .replace(/imÃ¡genes/g, "imágenes")
    .replace(/categorÃ­a/g, "categoría")
    .replace(/paÃ­s/g, "país")
    .replace(/acÃ¡/g, "acá")
    .replace(/podÃ©s/g, "podés")
    .replace(/enviÃ³/g, "envió")
    .replace(/distribuciÃ³n/g, "distribución")
    .replace(/secciÃ³n/g, "sección");
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
  const [modalVisiblePlans, setModalVisiblePlans] = useState<Array<"basic_free" | "featured" | "monthly">>(["basic_free", "featured", "monthly"]);
  const [modalRequestKind, setModalRequestKind] = useState<"new_publication" | "renew_free" | "upgrade_featured_120d" | "upgrade_featured_monthly" | "downgrade_free">("new_publication");
  const [modalPreviousPlan, setModalPreviousPlan] = useState<"basic_free" | "featured" | "monthly" | undefined>(undefined);
  const [modalSourceServiceId, setModalSourceServiceId] = useState<string | undefined>(undefined);
  const [modalInitialData, setModalInitialData] = useState<Record<string, unknown> | null>(null);
  const [featured120Price, setFeatured120Price] = useState<PlanPriceResponseItem | null>(null);
  const [monthlyPrice, setMonthlyPrice] = useState<PlanPriceResponseItem | null>(null);
  const [deletingSubmissionId, setDeletingSubmissionId] = useState<string | null>(null);
  const publishCardsRef = useRef<HTMLDivElement | null>(null);

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
      locale === "pt" ? "Criar uma nova publicaÃƒÂ§ÃƒÂ£o" :
      locale === "it" ? "Crea una nuova pubblicazione" :
      "Crear una nueva publicaciÃƒÂ³n",
    publishOptionsBody:
      locale === "en" ? "Choose the type of new publication you want to create with this same provider account." :
      locale === "pt" ? "Escolha o tipo de nova publicaÃƒÂ§ÃƒÂ£o que vocÃƒÂª quer criar com esta mesma conta de oferente." :
      locale === "it" ? "Scegli il tipo di nuova pubblicazione che vuoi creare con questo stesso account fornitore." :
      "ElegÃƒÂ­ el tipo de nueva publicaciÃƒÂ³n que querÃƒÂ©s crear con esta misma cuenta de oferente.",
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
  const featuredPaymentStatus = String(searchParams.get("featuredPayment") ?? "").trim().toLowerCase();

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
      locale === "en" ? "Cancel monthly / go back to free" :
      locale === "pt" ? "Cancelar mensal / voltar ao gratuito" :
      locale === "it" ? "Annulla mensile / torna al gratuito" :
      "Cancelar mensual / volver al gratis",
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
    if (!featuredPaymentStatus) return;
    if (featuredPaymentStatus === "success") {
      toast.success(locale === "en" ? "Your payment was accepted." : locale === "pt" ? "Seu pagamento foi aceito." : locale === "it" ? "Il tuo pagamento e stato accettato." : "Tu pago fue aceptado.", { duration: 7000 });
      void loadSession();
      return;
    }
    if (featuredPaymentStatus === "cancel") {
      toast(locale === "en" ? "The payment window was closed without completing the payment." : locale === "pt" ? "A janela de pagamento foi fechada sem concluir o pagamento." : locale === "it" ? "La finestra di pagamento e stata chiusa senza completare il pagamento." : "La ventana de pago se cerro sin completar el pago.", { duration: 7000 });
      void loadSession();
    }
  }, [featuredPaymentStatus, loadSession, locale]);

  useEffect(() => {
    if (!featuredPaymentStatus) return;
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.delete("featuredPayment");
    nextUrl.searchParams.delete("serviceId");
    window.history.replaceState({}, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
  }, [featuredPaymentStatus]);

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

  const readableSubmissionStatus = useCallback((value?: string) => {
    const normalized = String(value ?? "").trim().toLowerCase();
    if (["approved", "aprobado", "active", "activo"].includes(normalized)) {
      return locale === "en" ? "Approved" : locale === "pt" ? "Aprovado" : locale === "it" ? "Approvato" : "Aprobado";
    }
    if (["pendiente_pago", "payment_pending"].includes(normalized)) {
      return locale === "en" ? "Waiting for payment" : locale === "pt" ? "Aguardando pagamento" : locale === "it" ? "In attesa di pagamento" : "Esperando pago";
    }
    if (["pago_cancelado", "cancelled", "canceled"].includes(normalized)) {
      return locale === "en" ? "Payment cancelled" : locale === "pt" ? "Pagamento cancelado" : locale === "it" ? "Pagamento annullato" : "Pago cancelado";
    }
    if (["pago_fallido", "failed", "rejected"].includes(normalized)) {
      return locale === "en" ? "Payment failed" : locale === "pt" ? "Pagamento falhou" : locale === "it" ? "Pagamento fallito" : "Pago fallido";
    }
    if (["pendiente", "pending"].includes(normalized)) {
      return locale === "en" ? "Pending review" : locale === "pt" ? "Pendente de revisÃ£o" : locale === "it" ? "In attesa di revisione" : "Pendiente de revisiÃ³n";
    }
    return value || "-";
  }, [locale]);

  const readablePaymentStatus = useCallback((value?: string) => {
    const normalized = String(value ?? "").trim().toLowerCase();
    if (["paid", "approved", "success"].includes(normalized)) {
      return locale === "en" ? "Paid" : locale === "pt" ? "Pago" : locale === "it" ? "Pagato" : "Pagado";
    }
    if (["processing"].includes(normalized)) {
      return locale === "en" ? "Processing" : locale === "pt" ? "Em processamento" : locale === "it" ? "In elaborazione" : "Procesando";
    }
    if (["pending"].includes(normalized)) {
      return locale === "en" ? "Pending" : locale === "pt" ? "Pendente" : locale === "it" ? "In attesa" : "Pendiente";
    }
    if (["cancelled", "canceled"].includes(normalized)) {
      return locale === "en" ? "Cancelled" : locale === "pt" ? "Cancelado" : locale === "it" ? "Annullato" : "Cancelado";
    }
    if (["failed", "rejected"].includes(normalized)) {
      return locale === "en" ? "Failed" : locale === "pt" ? "Falhou" : locale === "it" ? "Fallito" : "Fallido";
    }
    return value || "-";
  }, [locale]);

  const planBenefits = useMemo(() => sanitizeVisibleCopy({
    featured: [
      locale === "en" ? "Appears first in results" : locale === "pt" ? "Aparece primeiro nos resultados" : locale === "it" ? "Appare per prima nei risultati" : "Aparece primero en resultados",
      locale === "en" ? "Expanded description" : locale === "pt" ? "DescriÃƒÂ§ÃƒÂ£o ampliada" : locale === "it" ? "Descrizione ampliata" : "DescripciÃƒÂ³n ampliada",
      locale === "en" ? "Multiple contact links" : locale === "pt" ? "VÃƒÂ¡rios links de contato" : locale === "it" ? "PiÃƒÂ¹ link di contatto" : "Varios links de contacto",
      locale === "en" ? "Available in 4 languages" : locale === "pt" ? "DisponÃƒÂ­vel em 4 idiomas" : locale === "it" ? "Disponibile in 4 lingue" : "Disponible en 4 idiomas",
      locale === "en" ? "Gallery up to 5 images" : locale === "pt" ? "Galeria de atÃƒÂ© 5 imagens" : locale === "it" ? "Galleria fino a 5 immagini" : "GalerÃƒÂ­a hasta 5 imÃƒÂ¡genes",
    ],
    free: [
      locale === "en" ? "Visible in the general listing" : locale === "pt" ? "VisÃƒÂ­vel na listagem geral" : locale === "it" ? "Visibile nell'elenco generale" : "Visible en el listado general",
      locale === "en" ? "Brief description" : locale === "pt" ? "DescriÃƒÂ§ÃƒÂ£o breve" : locale === "it" ? "Descrizione breve" : "DescripciÃƒÂ³n breve",
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
    if (normalized === "upgrade_featured_120d") return planCopy.requestUpgrade120;
    if (normalized === "upgrade_featured_monthly") return planCopy.requestUpgradeMonthly;
    if (normalized === "downgrade_free") return planCopy.requestDowngrade;
    return planCopy.requestNew;
  }, [planCopy]);

  const openPlanRequest = useCallback((
    plan: "basic_free" | "featured" | "monthly",
    sourceSubmission?: PortalSubmission | null,
  ) => {
    const previous = sourceSubmission?.planType === "featured" || sourceSubmission?.planType === "monthly"
      ? sourceSubmission.planType
      : currentPlanType === "featured" || currentPlanType === "monthly"
        ? currentPlanType
        : "basic_free";
    let requestKind: "new_publication" | "renew_free" | "upgrade_featured_120d" | "upgrade_featured_monthly" | "downgrade_free" = "new_publication";
    if (plan === "basic_free") {
      if (sourceSubmission?.id || latestApprovedSubmission?.id) {
        requestKind = previous === "basic_free" ? "renew_free" : "downgrade_free";
      }
    } else if (plan === "featured") {
      requestKind = "upgrade_featured_120d";
    } else {
      requestKind = "upgrade_featured_monthly";
    }
    setModalPlanIntent(plan);
    setPreferredPaidPlanType(plan === "monthly" ? "featured_monthly" : "featured_120d");
    setModalVisiblePlans([plan]);
    setModalRequestKind(requestKind);
    setModalPreviousPlan(previous);
    setModalSourceServiceId(sourceSubmission?.id || latestApprovedSubmission?.id);
    setModalInitialData((sourceSubmission?.draftData as Record<string, unknown> | undefined) ?? null);
    setOpenSubmissionModal(true);
  }, [currentPlanType, latestApprovedSubmission?.id]);

  const openNewPublicationRequest = useCallback(() => {
    setModalPlanIntent("basic_free");
    setPreferredPaidPlanType("featured_120d");
    setModalVisiblePlans(["basic_free", "featured", "monthly"]);
    setModalRequestKind("new_publication");
    setModalPreviousPlan(undefined);
    setModalSourceServiceId(undefined);
    setModalInitialData((latestApprovedSubmission?.draftData as Record<string, unknown> | undefined) ?? null);
    setOpenSubmissionModal(true);
  }, [latestApprovedSubmission?.draftData]);

  const openSpecificNewPublicationRequest = useCallback((plan: "basic_free" | "featured" | "monthly") => {
    setModalPlanIntent(plan);
    setPreferredPaidPlanType(plan === "monthly" ? "featured_monthly" : "featured_120d");
    setModalVisiblePlans([plan]);
    setModalRequestKind("new_publication");
    setModalPreviousPlan(undefined);
    setModalSourceServiceId(undefined);
    setModalInitialData((latestApprovedSubmission?.draftData as Record<string, unknown> | undefined) ?? null);
    setOpenSubmissionModal(true);
  }, [latestApprovedSubmission?.draftData]);

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
        throw new Error(String(data?.error ?? "No se pudo eliminar la solicitud."));
      }
      toast.success(copy.submissionDeleted);
      await loadSession();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar la solicitud.");
    } finally {
      setDeletingSubmissionId(null);
    }
  }, [copy.submissionDeleteConfirm, copy.submissionDeleted, loadSession]);

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
        return {
          publication,
          relatedSubmission,
          effectivePlanType,
          effectiveExpiration,
        };
      });
  }, [dashboard?.publications, dashboard?.submissions]);

  const planCards = useMemo(() => {
    const featuredReady = Boolean(featured120Price && Number(featured120Price.amount ?? 0) > 0);
    const monthlyReady = Boolean(monthlyPrice && Number(monthlyPrice.amount ?? 0) > 0);
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
      {
        key: "monthly",
        kind: "monthly",
        icon: Sparkles,
        title: copy.monthly,
        description: copy.monthlyDescription,
        price: monthlyLabel,
        benefits: planBenefits.featured,
        current: false,
        disabled: !monthlyReady,
        helper: monthlyReady ? copy.newSubmissionHint : copy.priceUnavailableHint,
        actionLabel: copy.publishMonthlyAction,
        action: () => openSpecificNewPublicationRequest("monthly"),
      },
    ];
  }, [copy.featured, copy.featuredDescription, copy.free, copy.freeDescription, copy.monthly, copy.monthlyDescription, copy.newSubmissionHint, copy.priceUnavailableHint, copy.publishFeaturedAction, copy.publishFreeAction, copy.publishMonthlyAction, featured120Label, featured120Price, locale, monthlyLabel, monthlyPrice, openSpecificNewPublicationRequest, planBenefits.featured, planBenefits.free]);

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
                    <p className="mt-1 text-xs text-slate-500">{copy.compactHistoryHint}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {dashboard?.submissions.length ?? 0}
                  </span>
                </div>
                <div className="mt-4 max-h-[420px] space-y-2 overflow-y-auto pr-1">
                  {dashboard?.submissions.length ? dashboard.submissions.map((item) => {
                    const plan = planBadge(item.planType);
                    const statusKind = ["aprobado", "approved", "active", "paid"].includes(String(item.status).toLowerCase()) ? "approved" : "pending";
                    const canDelete = !["aprobado", "approved", "active", "paid"].includes(String(item.status).toLowerCase()) && String(item.paymentStatus || "").toLowerCase() !== "paid";
                    return (
                      <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-slate-900">{item.profileName || item.email}</span>
                            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${badgeClasses(plan.kind)}`}>{plan.label}</span>
                            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${badgeClasses(statusKind)}`}>{copy.status}: {decodeLikelyMojibake(readableSubmissionStatus(item.status))}</span>
                          </div>
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
                        <div className="mt-2 grid gap-x-4 gap-y-1.5 text-sm text-slate-600 sm:grid-cols-2">
                          <div><span className="font-medium text-slate-800">{copy.destination}:</span> {item.destinationCountry || "-"}</div>
                          <div><span className="font-medium text-slate-800">{copy.payment}:</span> {decodeLikelyMojibake(readablePaymentStatus(item.paymentStatus))}</div>
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
                  {visiblePublicationEntries.length ? visiblePublicationEntries.map(({ publication, relatedSubmission, effectivePlanType, effectiveExpiration }) => {
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
                        {effectivePlanType === "basic_free" ? (
                          <>
                            <button
                              type="button"
                              onClick={() => openPlanRequest("featured", canOpenFromHistory)}
                              className="rounded-xl bg-[#0B8FA3] px-3 py-2 text-xs font-semibold text-white hover:opacity-95"
                            >
                              {planCopy.upgradeToFeatured}
                            </button>
                            <button
                              type="button"
                              onClick={() => openPlanRequest("monthly", canOpenFromHistory)}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                            >
                              {planCopy.upgradeToMonthly}
                            </button>
                          </>
                        ) : null}
                        {effectivePlanType === "featured" ? (
                          <>
                            <button
                              type="button"
                              onClick={() => openPlanRequest("featured", canOpenFromHistory)}
                              className="rounded-xl bg-[#0B8FA3] px-3 py-2 text-xs font-semibold text-white hover:opacity-95"
                            >
                              {planCopy.renewFeatured}
                            </button>
                            <button
                              type="button"
                              onClick={() => openPlanRequest("monthly", canOpenFromHistory)}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                            >
                              {planCopy.switchMonthly}
                            </button>
                            <button
                              type="button"
                              onClick={() => openPlanRequest("basic_free", canOpenFromHistory)}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                            >
                              {planCopy.downgradeThisPublication}
                            </button>
                          </>
                        ) : null}
                        {effectivePlanType === "monthly" ? (
                          <button
                            type="button"
                            onClick={() => openPlanRequest("basic_free", canOpenFromHistory)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            {planCopy.cancelMonthly}
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
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{copy.publishOptionsTitle}</h3>
                  <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-600">{copy.publishOptionsBody}</p>
                </div>
              </div>
              <div className="mx-auto mt-5 grid max-w-[980px] gap-5 lg:grid-cols-3">
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
          onClose={() => setOpenSubmissionModal(false)}
          initialEmail={sessionEmail}
          lockEmail
          showMonthlyPlanOption
          visiblePlans={modalVisiblePlans}
          fixedCountry={baseCountry}
          initialPlan={modalPlanIntent}
          preferredPaidPlanType={preferredPaidPlanType}
          requestKind={modalRequestKind}
          previousPlan={modalPreviousPlan}
          sourceServiceId={modalSourceServiceId}
          initialData={modalInitialData}
          onSubmitted={() => {
            setOpenSubmissionModal(false);
            void loadSession();
          }}
          onPaymentResolved={() => {
            setOpenSubmissionModal(false);
            void loadSession();
          }}
        />
      ) : null}
    </>
  );
}


