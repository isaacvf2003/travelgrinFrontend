"use client";

import { type MouseEvent, useId, useMemo, useState } from "react";
import {
  ChevronDown,
  Facebook,
  Globe,
  Instagram,
  Linkedin,
  Link as LinkIcon,
  Mail,
  MessageCircle,
  Phone,
  Youtube,
} from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { trackPublicationMetric } from "./PublicationMetricsTracker";
import SafetyAdvisoryModal from "./SafetyAdvisoryModal";

const ICONS = {
  web: Globe,
  linkedin: Linkedin,
  facebook: Facebook,
  instagram: Instagram,
  tiktok: MessageCircle,
  youtube: Youtube,
  whatsapp: MessageCircle,
  email: Mail,
  phone: Phone,
  other: LinkIcon,
};

export type ContactEntry = {
  label: string;
  labelI18n?: Record<string, string> | null;
  href: string;
  icon: keyof typeof ICONS;
};

type ContactAccordionProps = {
  entries: ContactEntry[];
  publicationId?: string;
  className?: string;
};

const COMMON_LABEL_TRANSLATIONS: Record<string, Record<string, string>> = {
  "página oficial": { es: "Página Oficial", en: "Official Website", pt: "Página Oficial", it: "Sito Ufficiale" },
  "pagina oficial": { es: "Página Oficial", en: "Official Website", pt: "Página Oficial", it: "Sito Ufficiale" },
  "sitio oficial": { es: "Sitio Oficial", en: "Official Website", pt: "Site Oficial", it: "Sito Ufficiale" },
  "sitio web": { es: "Sitio Web", en: "Website", pt: "Site", it: "Sito Web" },
  "web": { es: "Web", en: "Website", pt: "Web", it: "Web" },
  "teléfono de contacto": { es: "Teléfono de contacto", en: "Contact Phone", pt: "Telefone de contato", it: "Telefono di contatto" },
  "telefono de contacto": { es: "Teléfono de contacto", en: "Contact Phone", pt: "Telefone de contato", it: "Telefono di contacto" },
  "central telefónica": { es: "Central Telefónica", en: "Switchboard / Main Phone", pt: "Central Telefônica", it: "Centralino Telefonico" },
  "central telefonica": { es: "Central Telefónica", en: "Switchboard / Main Phone", pt: "Central Telefônica", it: "Centralino Telefonico" },
  "línea gratuita (0800)": { es: "Línea gratuita (0800)", en: "Toll-free line (0800)", pt: "Linha gratuita (0800)", it: "Numero verde (0800)" },
  "linea gratuita (0800)": { es: "Línea gratuita (0800)", en: "Toll-free line (0800)", pt: "Linha gratuita (0800)", it: "Numero verde (0800)" },
  "email de contacto": { es: "Email de contacto", en: "Contact Email", pt: "E-mail de contato", it: "Email di contatto" },
  "correo de contacto": { es: "Correo de contacto", en: "Contact Email", pt: "E-mail de contato", it: "Email di contatto" },
  "guardia": { es: "Guardia", en: "Emergency / 24h Duty", pt: "Plantão", it: "Pronto Soccorso" },
};

function resolveLocalizedContactLabel(entry: ContactEntry, locale: "es" | "en" | "pt" | "it"): string {
  if (entry.labelI18n && typeof entry.labelI18n === "object") {
    const direct = entry.labelI18n[locale] || entry.labelI18n.es;
    if (direct) return direct;
  }
  const raw = String(entry.label ?? "").trim();
  const lower = raw.toLowerCase();
  const mapped = COMMON_LABEL_TRANSLATIONS[lower];
  if (mapped && mapped[locale]) {
    return mapped[locale];
  }
  return raw;
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

function buildSafeContactHref(icon: keyof typeof ICONS, href: string) {
  const raw = String(href ?? "").trim();
  if (!raw) return "#";

  if (icon === "email") {
    const email = extractEmailAddress(raw);
    return email
      ? `https://mail.google.com/mail/u/0/?view=cm&fs=1&tf=1&to=${encodeURIComponent(email)}`
      : "#";
  }

  if (icon === "whatsapp") {
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
      // ignore parse errors
    }

    const digits = raw.replace(/\D/g, "");
    return digits ? `https://api.whatsapp.com/send?phone=${digits}` : "#";
  }

  if (/^(mailto:|tel:)/i.test(raw)) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;

  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 6 && /^[+()\-\s.\d]+$/.test(raw)) {
    return `tel:${raw.replace(/[^\d+]/g, "")}`;
  }

  return `https://${raw.replace(/^\/+/, "")}`;
}

export default function ContactAccordion({ entries, publicationId = "", className = "" }: ContactAccordionProps) {
  const { t, locale } = useTranslation();
  const contentId = useId();
  const labelId = useMemo(() => `contact-toggle-${contentId}`, [contentId]);
  const [pendingContact, setPendingContact] = useState<{ href: string; icon: keyof typeof ICONS } | null>(null);
  const [warningOpen, setWarningOpen] = useState(false);

  const CONTACT_WARNING_COUNT_KEY = "publicationContactWarningCount_v1";
  const CONTACT_WARNING_PUBLICATIONS_KEY = "publicationContactWarningPublications_v1";

  const readWarningState = () => {
    const count = Number(window.localStorage.getItem(CONTACT_WARNING_COUNT_KEY) ?? "0");
    const rawSeen = window.localStorage.getItem(CONTACT_WARNING_PUBLICATIONS_KEY) ?? "[]";
    let seenPublications: string[] = [];
    try {
      const parsed = JSON.parse(rawSeen);
      seenPublications = Array.isArray(parsed) ? parsed.map((entry) => String(entry)) : [];
    } catch {
      seenPublications = [];
    }
    return {
      count: Number.isFinite(count) ? count : 0,
      seenPublications,
    };
  };

  const openHref = (href: string, icon: keyof typeof ICONS) => {
    const safeHref = buildSafeContactHref(icon, href);
    if (!safeHref || safeHref === "#") return;
    if (/^(mailto:|tel:)/i.test(safeHref)) {
      window.location.href = safeHref;
      return;
    }
    window.open(safeHref, "_blank", "noopener,noreferrer");
  };

  const handleAcknowledgeAndContinue = () => {
    const current = pendingContact;
    setWarningOpen(false);
    setPendingContact(null);
    if (!current?.href) return;

    const { count, seenPublications } = readWarningState();
    const nextCount = Math.min(2, count + 1);
    const nextSeen = publicationId && !seenPublications.includes(publicationId)
      ? [...seenPublications, publicationId]
      : seenPublications;
    window.localStorage.setItem(CONTACT_WARNING_COUNT_KEY, String(nextCount));
    window.localStorage.setItem(CONTACT_WARNING_PUBLICATIONS_KEY, JSON.stringify(nextSeen));
    openHref(current.href, current.icon);
  };

  const onContactClick = (event: MouseEvent<HTMLAnchorElement>, href: string, icon: keyof typeof ICONS) => {
    event.preventDefault();
    trackPublicationMetric(publicationId, "lead");

    const { count, seenPublications } = readWarningState();
    const alreadyShownInPublication = publicationId ? seenPublications.includes(publicationId) : false;
    const shouldShowWarning = count < 2 && !alreadyShownInPublication;
    if (!shouldShowWarning) {
      openHref(href, icon);
      return;
    }

    setPendingContact({ href, icon });
    setWarningOpen(true);
  };

  const [expanded, setExpanded] = useState(false);
  const visibleEntries = expanded || entries.length <= 4 ? entries : entries.slice(0, 4);

  const moreTextMap: Record<"es" | "en" | "pt" | "it", { more: string; less: string; moreSuffix: string }> = {
    es: { more: "Ver más", less: "Ver menos", moreSuffix: "más" },
    en: { more: "See more", less: "See less", moreSuffix: "more" },
    pt: { more: "Ver mais", less: "Ver menos", moreSuffix: "mais" },
    it: { more: "Vedi altro", less: "Vedi meno", moreSuffix: "altri" },
  };
  const activeLang = (["es", "en", "pt", "it"].includes(locale as any) ? locale : "es") as "es" | "en" | "pt" | "it";
  const { more: lblMore, less: lblLess, moreSuffix: lblMoreSuffix } = moreTextMap[activeLang] || moreTextMap.es;

  return (
    <>
    <div id="contacto" className={`rounded-3xl border border-[#1A4DA1]/35 bg-gradient-to-r from-[#17BEB7] to-[#1A4DA1] p-5 shadow-[0_12px_34px_rgba(26,77,161,0.28)] ${className}`}>
      <div
        id={labelId}
        className="flex w-full items-center justify-between text-left text-lg font-semibold text-white md:text-xl"
      >
        {t("conectar") || "Conectar"}
      </div>

      <div
        id={contentId}
        role="region"
        aria-labelledby={labelId}
        className="mt-3"
      >
        {entries.length ? (
          <div className="grid gap-2.5 text-sm text-gray-700">
            {visibleEntries.map((entry) => {
              const Icon = ICONS[entry.icon] || ICONS.other || LinkIcon;
              const safeHref = buildSafeContactHref(entry.icon, entry.href);
              const opensInNewTab = !/^(mailto:|tel:)/i.test(safeHref);
              const labelText = resolveLocalizedContactLabel(entry, activeLang);
              return (
                <a
                  key={`${entry.label}-${entry.href}`}
                  className="relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl border border-white/50 bg-white/95 px-3 py-2 text-sm font-semibold text-[#114B8D] transition before:absolute before:inset-y-0 before:-left-1/2 before:w-1/3 before:-skew-x-12 before:bg-white/70 before:opacity-0 before:blur-sm before:transition-all before:duration-700 hover:bg-white hover:before:left-[120%] hover:before:opacity-100"
                  href={safeHref}
                  target={opensInNewTab ? "_blank" : undefined}
                  rel={opensInNewTab ? "noreferrer" : undefined}
                  onClick={(event) => onContactClick(event, entry.href, entry.icon)}
                >
                  <Icon className="h-4 w-4" />
                  {labelText}
                </a>
              );
            })}
            {entries.length > 4 ? (
              <button
                type="button"
                onClick={() => setExpanded((prev) => !prev)}
                className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/40 bg-white/20 px-3 py-2 text-xs font-semibold text-white backdrop-blur-xs transition hover:bg-white/30 cursor-pointer"
              >
                <span>{expanded ? lblLess : `${lblMore} (${entries.length - 4} ${lblMoreSuffix})`}</span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
              </button>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-white/90">Todavía no hay enlaces de contacto disponibles.</p>
        )}
      </div>
    </div>
    <SafetyAdvisoryModal open={warningOpen} onAcknowledge={handleAcknowledgeAndContinue} />
    </>
  );
}
