"use client";

import { type MouseEvent, useId, useMemo, useState } from "react";
import {
  Facebook,
  Globe,
  Instagram,
  Linkedin,
  Link as LinkIcon,
  Mail,
  MessageCircle,
  Youtube,
} from "lucide-react";

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
  other: LinkIcon,
};

export type ContactEntry = {
  label: string;
  href: string;
  icon: keyof typeof ICONS;
};

type ContactAccordionProps = {
  entries: ContactEntry[];
  publicationId?: string;
  className?: string;
};

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

  return (
    <>
    <div id="contacto" className={`rounded-3xl border border-[#1A4DA1]/35 bg-gradient-to-r from-[#17BEB7] to-[#1A4DA1] p-5 shadow-[0_12px_34px_rgba(26,77,161,0.28)] ${className}`}>
      <div
        id={labelId}
        className="flex w-full items-center justify-between text-left text-lg font-semibold text-white md:text-xl"
      >
        Conectar
      </div>

      <div
        id={contentId}
        role="region"
        aria-labelledby={labelId}
        className="mt-3"
      >
        {entries.length ? (
          <div className="grid gap-2.5 text-sm text-gray-700">
            {entries.map((entry) => {
              const Icon = ICONS[entry.icon];
              const safeHref = buildSafeContactHref(entry.icon, entry.href);
              const opensInNewTab = !/^(mailto:|tel:)/i.test(safeHref);
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
                  {entry.label}
                </a>
              );
            })}
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
