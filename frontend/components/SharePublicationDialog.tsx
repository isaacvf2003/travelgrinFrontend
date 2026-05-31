"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Mail, Send, Share2, Smartphone, X } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";

type SharePublicationDialogProps = {
  open: boolean;
  onClose: () => void;
  shareTitle: string;
  shareUrl: string;
};

export default function SharePublicationDialog({
  open,
  onClose,
  shareTitle,
  shareUrl,
}: SharePublicationDialogProps) {
  const { locale } = useTranslation();
  const [copyNotice, setCopyNotice] = useState("");

  const copy = useMemo(() => {
    const dict = {
      es: {
        title: "Compartir",
        subtitle: "Elegí cómo querés compartir esta oportunidad.",
        close: "Cerrar",
        apps: "Compartir con apps del dispositivo",
        appsHint: "Usa el menú nativo de tu navegador o teléfono.",
        whatsapp: "Compartir por WhatsApp",
        whatsappHint: "Abrí una conversación con el enlace listo para enviar.",
        email: "Compartir por correo",
        emailHint: "Prepará un correo con el título y el enlace.",
        copy: "Copiar enlace",
        copyHint: "Guardá el enlace para pegarlo donde quieras.",
        copied: "Enlace copiado",
      },
      en: {
        title: "Share",
        subtitle: "Choose how you want to share this opportunity.",
        close: "Close",
        apps: "Share with your device apps",
        appsHint: "Use your browser or phone native share sheet.",
        whatsapp: "Share on WhatsApp",
        whatsappHint: "Open a chat with the link ready to send.",
        email: "Share by email",
        emailHint: "Prepare an email with the title and link.",
        copy: "Copy link",
        copyHint: "Keep the link ready to paste anywhere.",
        copied: "Link copied",
      },
      pt: {
        title: "Compartilhar",
        subtitle: "Escolha como deseja compartilhar esta oportunidade.",
        close: "Fechar",
        apps: "Compartilhar com apps do dispositivo",
        appsHint: "Use o menu nativo do navegador ou do celular.",
        whatsapp: "Compartilhar por WhatsApp",
        whatsappHint: "Abra uma conversa com o link pronto para enviar.",
        email: "Compartilhar por e-mail",
        emailHint: "Prepare um e-mail com o título e o link.",
        copy: "Copiar link",
        copyHint: "Deixe o link pronto para colar onde quiser.",
        copied: "Link copiado",
      },
      it: {
        title: "Condividi",
        subtitle: "Scegli come vuoi condividere questa opportunità.",
        close: "Chiudi",
        apps: "Condividi con le app del dispositivo",
        appsHint: "Usa il menu nativo del browser o del telefono.",
        whatsapp: "Condividi su WhatsApp",
        whatsappHint: "Apri una chat con il link pronto da inviare.",
        email: "Condividi via email",
        emailHint: "Prepara una mail con il titolo e il link.",
        copy: "Copia link",
        copyHint: "Tieni il link pronto da incollare dove vuoi.",
        copied: "Link copiato",
      },
    } as const;
    return dict[locale] ?? dict.es;
  }, [locale]);

  const shareEncoded = useMemo(
    () => encodeURIComponent(`${shareTitle}\n${shareUrl}`),
    [shareTitle, shareUrl],
  );
  const gmailShareUrl = useMemo(
    () =>
      shareUrl
        ? `https://mail.google.com/mail/?view=cm&fs=1&tf=1&su=${encodeURIComponent(shareTitle)}&body=${shareEncoded}`
        : "#",
    [shareEncoded, shareTitle, shareUrl],
  );
  const whatsappShareUrl = useMemo(
    () => (shareUrl ? `https://wa.me/?text=${shareEncoded}` : "#"),
    [shareEncoded, shareUrl],
  );

  useEffect(() => {
    if (!open) {
      setCopyNotice("");
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    if (!copyNotice) return;
    const timeout = window.setTimeout(() => setCopyNotice(""), 2200);
    return () => window.clearTimeout(timeout);
  }, [copyNotice]);

  if (!open) return null;

  const canNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-[28px] border border-white/60 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.28)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-slate-100 bg-[linear-gradient(135deg,#0fb7c4_0%,#2164d8_100%)] px-6 py-5 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/16 ring-1 ring-white/20">
                <Share2 className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-[1.35rem] font-semibold leading-none">{copy.title}</h3>
              <p className="mt-2 max-w-[28rem] text-sm text-white/85">{copy.subtitle}</p>
            </div>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/12 text-white transition hover:bg-white/20"
              aria-label={copy.close}
              onClick={onClose}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="px-6 py-5">
          {copyNotice ? (
            <div className="mb-4 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
              <Check className="h-4 w-4" />
              <span>{copyNotice}</span>
            </div>
          ) : null}

          <div className="grid gap-3">
            {canNativeShare ? (
              <button
                type="button"
                className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left transition hover:border-[#0B8FA3]/35 hover:bg-[#F3FCFD]"
                onClick={async () => {
                  try {
                    await navigator.share({ title: shareTitle, url: shareUrl });
                    onClose();
                  } catch {
                    // noop
                  }
                }}
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EAF9FB] text-[#0B8FA3]">
                  <Smartphone className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-900">{copy.apps}</span>
                  <span className="mt-1 block text-xs text-slate-500">{copy.appsHint}</span>
                </span>
              </button>
            ) : null}

            <a
              className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left transition hover:border-[#0B8FA3]/35 hover:bg-[#F3FCFD]"
              href={whatsappShareUrl}
              target="_blank"
              rel="noreferrer"
              onClick={onClose}
            >
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E9FBF0] text-[#16A34A]">
                <Send className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-900">{copy.whatsapp}</span>
                <span className="mt-1 block text-xs text-slate-500">{copy.whatsappHint}</span>
              </span>
            </a>

            <a
              className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left transition hover:border-[#0B8FA3]/35 hover:bg-[#F3FCFD]"
              href={gmailShareUrl}
              target="_blank"
              rel="noreferrer"
              onClick={onClose}
            >
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EEF5FF] text-[#2164D8]">
                <Mail className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-900">{copy.email}</span>
                <span className="mt-1 block text-xs text-slate-500">{copy.emailHint}</span>
              </span>
            </a>

            <button
              type="button"
              className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left transition hover:border-[#0B8FA3]/35 hover:bg-[#F3FCFD]"
              onClick={async () => {
                if (!shareUrl || typeof navigator === "undefined" || !navigator.clipboard) return;
                try {
                  await navigator.clipboard.writeText(shareUrl);
                  setCopyNotice(copy.copied);
                } catch {
                  // noop
                }
              }}
            >
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FFF7E8] text-[#D97706]">
                <Copy className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-900">{copy.copy}</span>
                <span className="mt-1 block text-xs text-slate-500">{copy.copyHint}</span>
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
