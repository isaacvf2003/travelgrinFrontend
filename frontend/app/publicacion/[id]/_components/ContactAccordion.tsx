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

export default function ContactAccordion({ entries, publicationId = "", className = "" }: ContactAccordionProps) {
  const contentId = useId();
  const labelId = useMemo(() => `contact-toggle-${contentId}`, [contentId]);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
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

  const openHref = (href: string) => {
    if (/^(mailto:|tel:)/i.test(href)) {
      window.location.href = href;
      return;
    }
    window.open(href, "_blank", "noopener,noreferrer");
  };

  const handleAcknowledgeAndContinue = () => {
    const href = pendingHref;
    setWarningOpen(false);
    setPendingHref(null);
    if (!href) return;

    const { count, seenPublications } = readWarningState();
    const nextCount = Math.min(2, count + 1);
    const nextSeen = publicationId && !seenPublications.includes(publicationId)
      ? [...seenPublications, publicationId]
      : seenPublications;
    window.localStorage.setItem(CONTACT_WARNING_COUNT_KEY, String(nextCount));
    window.localStorage.setItem(CONTACT_WARNING_PUBLICATIONS_KEY, JSON.stringify(nextSeen));
    openHref(href);
  };

  const onContactClick = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    event.preventDefault();
    trackPublicationMetric(publicationId, "lead");

    const { count, seenPublications } = readWarningState();
    const alreadyShownInPublication = publicationId ? seenPublications.includes(publicationId) : false;
    const shouldShowWarning = count < 2 && !alreadyShownInPublication;
    if (!shouldShowWarning) {
      openHref(href);
      return;
    }

    setPendingHref(href);
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
              const opensInNewTab = !/^(mailto:|tel:)/i.test(entry.href);
              return (
                <a
                  key={`${entry.label}-${entry.href}`}
                  className="relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl border border-white/50 bg-white/95 px-3 py-2 text-sm font-semibold text-[#114B8D] transition before:absolute before:inset-y-0 before:-left-1/2 before:w-1/3 before:-skew-x-12 before:bg-white/70 before:opacity-0 before:blur-sm before:transition-all before:duration-700 hover:bg-white hover:before:left-[120%] hover:before:opacity-100"
                  href={entry.href}
                  target={opensInNewTab ? "_blank" : undefined}
                  rel={opensInNewTab ? "noreferrer" : undefined}
                  onClick={(event) => onContactClick(event, entry.href)}
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
