"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import TranslatedText from "@/components/TranslatedText";
import { PlanProvider, usePlan } from "@/app/buscar/_components/PlanStore";
import { useTranslation } from "@/app/hooks/useTranslation";
import { getDisplayPrice, type PriceOverride } from "@/app/lib/currency";
import { Facebook, Globe, Instagram, Linkedin, Link as LinkIcon, Mail, MessageCircle, Youtube } from "lucide-react";

const FALLBACK_IMAGE = "https://i.ibb.co/VmrmGrx/sin-foto.jpg";
const PLAN_NOTES_KEY = "tg_plan_notes";

const ICONS = {
  web: Globe,
  linkedin: Linkedin,
  facebook: Facebook,
  instagram: Instagram,
  tiktok: MessageCircle,
  youtube: Youtube,
  whatsapp: MessageCircle,
  email: Mail,
  other: LinkIcon,
};

type ContactEntry = { label: string; href: string; icon: keyof typeof ICONS };
type PublicationInfo = { basePath: "publicacion" | "prestaciones"; contacts: ContactEntry[] };
type SocialLinkDetail = { kind?: string; label?: string; url?: string };

function normalizeContactKey(href: string) {
  return String(href ?? "").trim().replace(/\/+$/, "").toLowerCase();
}

function isPhoneLike(value: string) {
  const raw = String(value ?? "").trim();
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 6 && /^[+()\-\s.\d]+$/.test(raw);
}

function extractEmailAddress(rawHref: string): string {
  const raw = String(rawHref ?? "").trim();
  if (!raw) return "";

  if (/^mailto:/i.test(raw)) {
    return raw.replace(/^mailto:/i, "").split("?")[0].trim();
  }

  if (raw.includes("@") && !/^https?:\/\//i.test(raw)) {
    return raw.trim();
  }

  try {
    const url = new URL(raw);
    const toParam = url.searchParams.get("to") ?? "";
    if (toParam) {
      const decodedTo = decodeURIComponent(toParam);
      if (/^https?:\/\/mail\.google\.com\/mail\//i.test(decodedTo) || /^mailto:/i.test(decodedTo)) {
        return extractEmailAddress(decodedTo);
      }
      if (decodedTo.includes("@")) {
        return decodedTo.split("?")[0].trim();
      }
    }

    const pathname = decodeURIComponent(url.pathname);
    const maybeMail = pathname.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
    if (maybeMail) return maybeMail;
  } catch {
    // ignore parse errors
  }

  const fallbackMatch = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return fallbackMatch?.[0] ?? "";
}

function normalizeContactHref(kind: string, rawHref: string) {
  const raw = String(rawHref ?? "").trim();
  if (!raw) return "#";
  const normalizedKind = String(kind ?? "").toLowerCase();

  if (normalizedKind === "email") {
    const email = extractEmailAddress(raw);
    return email
      ? `https://mail.google.com/mail/u/0/?view=cm&fs=1&tf=1&to=${encodeURIComponent(email)}`
      : "#";
  }

  if (normalizedKind === "whatsapp") {
    try {
      if (/^https?:\/\//i.test(raw)) {
        const url = new URL(raw);
        const phoneParam = url.searchParams.get("phone");
        const textParam = url.searchParams.get("text");
        const digitsFromPhone = String(phoneParam ?? "").replace(/\D/g, "");
        if (digitsFromPhone) {
          return `https://api.whatsapp.com/send?phone=${digitsFromPhone}${textParam ? `&text=${encodeURIComponent(textParam)}` : ""}`;
        }
        const digitsFromUrl = `${url.hostname}${url.pathname}`.replace(/\D/g, "");
        if (digitsFromUrl) return `https://api.whatsapp.com/send?phone=${digitsFromUrl}`;
      }
    } catch {
      // ignore
    }

    const digits = raw.replace(/\D/g, "");
    return digits ? `https://api.whatsapp.com/send?phone=${digits}` : "#";
  }

  if (/^(https?:|mailto:|tel:)/i.test(raw)) return raw;
  if (isPhoneLike(raw)) {
    return `tel:${raw.replace(/[^\d+]/g, "")}`;
  }
  return `https://${raw.replace(/^\/+/, "")}`;
}

function addUniqueContact(target: ContactEntry[], entry: ContactEntry | null) {
  if (!entry?.href) return;
  const key = `${entry.icon}:${normalizeContactKey(entry.href)}`;
  const exists = target.some((current) => `${current.icon}:${normalizeContactKey(current.href)}` === key);
  if (!exists) target.push(entry);
}

function PlanContent() {
  const { items, toggle, totalLabel } = usePlan();
  const { t, locale } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const [expandedNotesById, setExpandedNotesById] = useState<Record<string, boolean>>({});
  const [publicationInfoById, setPublicationInfoById] = useState<Record<string, PublicationInfo>>({});
  const copy = {
    planDescription:
      locale === "en"
        ? "Save your favorite opportunities, add notes and contact providers quickly."
        : locale === "pt"
          ? "Salve suas oportunidades favoritas, adicione notas e conecte-se rapidamente."
          : locale === "it"
            ? "Salva le opportunità preferite, aggiungi note e contatta rapidamente i fornitori."
            : "Guardá tus oportunidades favoritas, agregá notas y conectate rápido con los oferentes.",
    total: locale === "en" ? "Total" : locale === "pt" ? "Total" : locale === "it" ? "Totale" : "Total",
    items: locale === "en" ? "items" : locale === "pt" ? "itens" : locale === "it" ? "elementi" : "elementos",
    details: locale === "en" ? "View details" : locale === "pt" ? "Ver detalhes" : locale === "it" ? "Vedi dettagli" : "Ver detalles",
    note: locale === "en" ? "Note" : locale === "pt" ? "Nota" : locale === "it" ? "Nota" : "Nota",
    notePlaceholder:
      locale === "en"
        ? "Add a note for this publication..."
        : locale === "pt"
          ? "Adicione uma nota para esta publicação..."
          : locale === "it"
            ? "Aggiungi una nota per questa pubblicazione..."
            : "Agregá una nota para esta publicación...",
    connect: locale === "en" ? "Connect" : locale === "pt" ? "Conectar" : locale === "it" ? "Connetti" : "Conectar",
    noLinks:
      locale === "en"
        ? "No links available yet."
        : locale === "pt"
          ? "Sem links disponíveis por enquanto."
          : locale === "it"
            ? "Nessun link disponibile al momento."
            : "Sin enlaces disponibles por ahora.",
    remove: locale === "en" ? "Remove" : locale === "pt" ? "Remover" : locale === "it" ? "Rimuovi" : "Quitar",
    emptyPlan:
      locale === "en"
        ? "Your first step toward a world of opportunities."
        : locale === "pt"
          ? "Seu primeiro passo para um mundo de oportunidades."
          : locale === "it"
            ? "Il tuo primo passo verso un mondo di opportunità."
            : "Tu primer paso hacia un mundo de oportunidades.",
    promoCode:
      locale === "en"
        ? "Add promo code"
        : locale === "pt"
          ? "Adicionar código promocional"
          : locale === "it"
            ? "Aggiungi codice promozionale"
            : "Agregar código promocional",
    addNote:
      locale === "en"
        ? "Add note"
        : locale === "pt"
          ? "Adicionar nota"
          : locale === "it"
            ? "Aggiungi nota"
            : "Agregar nota",
    sendByEmail:
      locale === "en"
        ? "Send plan by email"
        : locale === "pt"
          ? "Enviar plano por e-mail"
          : locale === "it"
            ? "Invia piano via email"
            : "Enviar plan por correo",
    resendHelp:
      locale === "en"
        ? "We'll resend this plan with all selected publications."
        : locale === "pt"
          ? "Reenviaremos este plano com todas as publicações selecionadas."
          : locale === "it"
            ? "Ti reinvieremo questo piano con tutte le pubblicazioni selezionate."
            : "Te reenviamos este plan con todas las publicaciones seleccionadas.",
    emailPlaceholder:
      locale === "en"
        ? "Your email"
        : locale === "pt"
          ? "Seu e-mail"
          : locale === "it"
            ? "La tua email"
            : "Tu correo",
    sending:
      locale === "en"
        ? "Sending..."
        : locale === "pt"
          ? "Enviando..."
          : locale === "it"
            ? "Invio..."
            : "Enviando...",
    resendButton:
      locale === "en"
        ? "Resend plan to my email"
        : locale === "pt"
          ? "Reenviar plano para meu e-mail"
          : locale === "it"
            ? "Reinvia piano alla mia email"
            : "Reenviar plan a mi correo",
    sentPlan:
      locale === "en"
        ? "Done! We sent your plan."
        : locale === "pt"
          ? "Pronto! Enviamos seu plano."
          : locale === "it"
            ? "Fatto! Ti abbiamo inviato il piano."
            : "¡Listo! Te enviamos el plan.",
    noPayment:
      locale === "en"
        ? "No payment needed for now: build your plan, connect with opportunities, and save notes."
        : locale === "pt"
          ? "Por enquanto não é necessário pagar: monte seu plano, conecte-se com oportunidades e salve notas."
          : locale === "it"
            ? "Per ora non serve pagare: crea il tuo piano, connettiti con opportunità e salva note."
            : "Por ahora no hace falta pagar: armá tu plan, conectá con oportunidades y guardá notas.",
    goBack:
      locale === "en"
        ? "Go back"
        : locale === "pt"
          ? "Voltar"
          : locale === "it"
            ? "Torna indietro"
            : "Volver atrás",
    hideNote:
      locale === "en"
        ? "Hide note"
        : locale === "pt"
          ? "Ocultar nota"
          : locale === "it"
            ? "Nascondi nota"
            : "Ocultar nota",
    invalidEmail:
      locale === "en"
        ? "Enter a valid email address."
        : locale === "pt"
          ? "Ingresá un correo válido."
          : locale === "it"
            ? "Inserisci un'email valida."
            : "Ingresá un correo válido.",
  };

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PLAN_NOTES_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        setNotesById(parsed);
        const expanded = Object.fromEntries(
          Object.entries(parsed).filter(([, value]) => String(value ?? "").trim()).map(([id]) => [id, true])
        );
        setExpandedNotesById(expanded);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(PLAN_NOTES_KEY, JSON.stringify(notesById));
    } catch {
      // ignore
    }
  }, [notesById]);

  useEffect(() => {
    let active = true;
    const loadPublicationInfo = async () => {
      const pairs = await Promise.all(
        items.map(async (item) => {
          try {
            const res = await fetch(`/api/publications/${item.publicationId}`, { cache: "no-store" });
            if (!res.ok) return [item.publicationId, null] as const;
            const payload = await res.json();
            const pub = payload?.item ?? payload;
            const socialLinks = (pub?.socialLinks ?? {}) as Record<string, string>;
            const detailedLinks = Array.isArray(pub?.fields?.socialLinksDetailed)
              ? pub.fields.socialLinksDetailed
                  .map((entry: SocialLinkDetail) => ({
                    kind: String(entry?.kind ?? ""),
                    label: String(entry?.label ?? ""),
                    url: String(entry?.url ?? ""),
                  }))
                  .filter((entry: { kind: string; label: string; url: string }) => entry.kind && entry.url)
              : [];
            const contacts: ContactEntry[] = [];
            detailedLinks.forEach((entry: { kind: string; label: string; url: string }) => {
              const icon = (entry.kind === "web" ? "web" : entry.kind) as keyof typeof ICONS;
              addUniqueContact(contacts, {
                label: entry.label || entry.kind || "Enlace",
                href: normalizeContactHref(entry.kind, entry.url),
                icon: ICONS[icon] ? icon : "other",
              });
            });
            addUniqueContact(contacts, socialLinks.whatsapp ? { label: "WhatsApp", href: normalizeContactHref("whatsapp", socialLinks.whatsapp), icon: "whatsapp" } : null);
            addUniqueContact(contacts, socialLinks.facebook ? { label: "Facebook", href: normalizeContactHref("facebook", socialLinks.facebook), icon: "facebook" } : null);
            addUniqueContact(contacts, socialLinks.instagram ? { label: "Instagram", href: normalizeContactHref("instagram", socialLinks.instagram), icon: "instagram" } : null);
            addUniqueContact(contacts, socialLinks.linkedin ? { label: "LinkedIn", href: normalizeContactHref("linkedin", socialLinks.linkedin), icon: "linkedin" } : null);
            addUniqueContact(
              contacts,
              socialLinks.email
                ? { label: "Email", href: normalizeContactHref("email", socialLinks.email), icon: "email" }
                : null
            );
            addUniqueContact(contacts, socialLinks.website ? { label: "Web", href: normalizeContactHref("web", socialLinks.website), icon: "web" } : null);

            const basePath = pub?.primaryGroupKey === "prestacion" ? "prestaciones" : "publicacion";
            return [item.publicationId, { basePath, contacts }] as const;
          } catch {
            return [item.publicationId, null] as const;
          }
        })
      );

      if (!active) return;
      const next: Record<string, PublicationInfo> = {};
      pairs.forEach(([id, info]) => {
        if (info) next[id] = info;
      });
      setPublicationInfoById(next);
    };

    if (items.length) loadPublicationInfo();
    else setPublicationInfoById({});

    return () => {
      active = false;
    };
  }, [items]);

  const planSummary = useMemo(
    () => items.map((item) => `• ${item.title} (${formatItemPrice(item)})`).join("\n"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items]
  );

  const handleSendPlan = async () => {
    const trimmedEmail = email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      setEmailError(copy.invalidEmail);
      return;
    }
    setEmailError("");
    setSendingEmail(true);
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      setEmailSent(false);
      const response = await fetch("/api/save-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: trimmedEmail,
          locale,
          source: "mi_plan",
          plan: planSummary,
          items: items.map((item) => {
            const info = publicationInfoById[item.publicationId];
            const basePath = info?.basePath ?? "publicacion";
            const detailUrl = origin ? `${origin}/${basePath}/${item.publicationId}` : "";
            return {
              title: item.title,
              priceLabel: formatItemPrice(item),
              note: notesById[item.publicationId] ?? "",
              detailUrl,
              imageUrl: item.imageUrl ?? "",
              contacts: (info?.contacts ?? []).map((contact) => ({
                label: contact.label,
                href: contact.href,
              })),
            };
            }),
          }),
        });
      if (!response.ok) {
        throw new Error("No se pudo enviar el plan");
      }
      setEmailSent(true);
      setEmail("");
    } catch {
      setEmailError(
        locale === "en"
          ? "We couldn't send the plan."
          : locale === "pt"
            ? "Nao conseguimos enviar o plano."
            : locale === "it"
              ? "Non siamo riusciti a inviare il piano."
              : "No pudimos enviar el plan."
      );
    } finally {
      setSendingEmail(false);
    }
  };

  function formatItemPrice(item: (typeof items)[number]) {
    if (!item.price) return t("precio_convenir");
    const display = getDisplayPrice(item.price, item.currency ?? null, null, "es-AR", [] as PriceOverride[]);
    const formatted = display?.formatted ?? t("precio_convenir");
    const periodLabel =
      item.pricePeriod === "day"
        ? t("precio_periodo_dia")
        : item.pricePeriod === "week"
          ? t("precio_periodo_semana")
          : item.pricePeriod === "year"
            ? t("precio_periodo_ano")
            : item.pricePeriod === "once"
              ? ""
              : t("precio_periodo_mes");
    return `${formatted}${periodLabel ? ` ${periodLabel}` : ""}`;
  }
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  return (
    <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              <TranslatedText id="mi_plan" />
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              {copy.planDescription}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-center">
            <div className="text-xs text-slate-500">{copy.total}</div>
            <div className="text-xl font-semibold text-slate-900">${totalLabel()}</div>
            <div className="text-xs text-slate-500">{items.length} {copy.items}</div>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {items.length ? (
            items.map((item) => (
              <div
                key={item.publicationId}
                className="flex flex-wrap items-start gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex w-20 shrink-0 flex-col gap-2">
                  <div className="h-20 w-20 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.imageUrl ?? FALLBACK_IMAGE}
                      alt={item.title}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <Link
                    href={`/${publicationInfoById[item.publicationId]?.basePath ?? "publicacion"}/${item.publicationId}`}
                    className="w-full rounded-xl border border-[#0B8FA3]/30 bg-[#EAF9FB] px-2 py-1.5 text-center text-[11px] font-semibold text-[#0B6B7A]"
                  >
                    {copy.details}
                  </Link>
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-gray-900">{item.title}</div>
                  <div className="mt-1 text-xs text-gray-500">{formatItemPrice(item)}</div>
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedNotesById((prev) => ({ ...prev, [item.publicationId]: !prev[item.publicationId] }))
                      }
                      className="rounded-xl border border-[#0B8FA3]/30 bg-[#EAF9FB] px-3 py-1.5 text-xs font-semibold text-[#0B6B7A]"
                    >
                      {expandedNotesById[item.publicationId] ? copy.hideNote : copy.addNote}
                    </button>
                    {expandedNotesById[item.publicationId] ? (
                      <div className="mt-2">
                        <label className="text-xs font-semibold text-slate-600">{copy.note}</label>
                        <textarea
                          value={notesById[item.publicationId] ?? ""}
                          onChange={(e) => setNotesById((prev) => ({ ...prev, [item.publicationId]: e.target.value }))}
                          placeholder={copy.notePlaceholder}
                          className="mt-1 min-h-[70px] w-full rounded-xl border border-slate-200 bg-white p-2 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#0B8FA3] dark:bg-white dark:text-slate-900"
                          style={{ colorScheme: "light" }}
                        />
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-3 rounded-xl border border-[#0B8FA3]/25 bg-[#EAF9FB] p-2.5">
                    <p className="text-xs font-semibold text-[#0B6B7A]">{copy.connect}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(publicationInfoById[item.publicationId]?.contacts ?? []).length ? (
                        publicationInfoById[item.publicationId].contacts.map((entry) => {
                          const Icon = ICONS[entry.icon];
                          const opensInNewTab = !/^(mailto:|tel:)/i.test(entry.href);
                          return (
                            <a
                              key={`${item.publicationId}-${entry.label}-${entry.href}`}
                              href={entry.href}
                              target={opensInNewTab ? "_blank" : undefined}
                              rel={opensInNewTab ? "noreferrer" : undefined}
                              className="inline-flex items-center gap-1 rounded-lg border border-[#0B8FA3]/30 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#0B6B7A]"
                            >
                              <Icon className="h-3.5 w-3.5" />
                              {entry.label}
                            </a>
                          );
                        })
                      ) : (
                        <span className="text-[11px] text-[#0B6B7A]/70">{copy.noLinks}</span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => toggle(item)}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  {copy.remove}
                </button>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
              {copy.emptyPlan}
            </div>
          )}
        </div>

      </div>

      <div className="space-y-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-semibold text-slate-900">{copy.sendByEmail}</div>
          <p className="mt-2 text-xs text-slate-500">{copy.resendHelp}</p>
          <div className="mt-4 space-y-2">
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError("");
              }}
              placeholder={copy.emailPlaceholder}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-[#0B8FA3]/25"
            />
            <button
              type="button"
              onClick={handleSendPlan}
              disabled={sendingEmail || !email.trim() || !isEmailValid}
              className="w-full rounded-2xl bg-[#0B8FA3] px-4 py-3 text-sm font-semibold text-white shadow hover:opacity-95 disabled:opacity-60"
            >
              {sendingEmail ? copy.sending : copy.resendButton}
            </button>
            {emailError ? <p className="text-xs text-red-600">{emailError}</p> : null}
            {emailSent ? <p className="text-xs text-emerald-600">{copy.sentPlan}</p> : null}
          </div>
        </div>

        <div className="rounded-2xl border border-dashed border-teal-200 bg-teal-50/40 px-4 py-5 text-sm text-teal-700">
          {copy.noPayment}
        </div>

        <button
          type="button"
          onClick={() => router.back()}
          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          {copy.goBack}
        </button>
      </div>
    </div>
  );
}

export default function MiPlanPage() {
  return (
    <div className="min-h-screen bg-[#F3F5F7]">
      <NavBar />
      <main className="mx-auto max-w-6xl px-4 py-12">
        <PlanProvider>
          <PlanContent />
        </PlanProvider>
      </main>
      <Footer />
    </div>
  );
}
