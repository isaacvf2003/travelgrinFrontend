"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import ModalOferente from "@/components/ModalOferente";
import { useTranslation } from "@/app/hooks/useTranslation";
import { Briefcase, CalendarClock, CheckCircle2, CircleDollarSign, FilePlus2, LogOut, Mail, RefreshCcw, ShieldCheck } from "lucide-react";

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

export default function ProviderPortalPanel() {
  const { locale } = useTranslation();
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
  }), [locale]);

  const portalStatus = String(searchParams.get("portal_status") ?? "").trim().toLowerCase();

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
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeClasses("free")}`}>{copy.free}: {dashboard?.stats.freePlan ?? 0}</span>
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeClasses("featured")}`}>{copy.featured}: {dashboard?.stats.featuredPlan ?? 0}</span>
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeClasses("monthly")}`}>{copy.monthly}: {dashboard?.stats.monthlyPlan ?? 0}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setOpenSubmissionModal(true)}
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
          onSubmitted={() => {
            setOpenSubmissionModal(false);
            void loadSession();
          }}
        />
      ) : null}
    </>
  );
}
