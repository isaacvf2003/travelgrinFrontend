"use client";

import { useState } from "react";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function ReportPublicationCard({ publicationId, publicationTitle }: { publicationId: string; publicationTitle: string }) {
  const { locale } = useTranslation();
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [error, setError] = useState("");

  const invalidEmailMessage =
    locale === "en"
      ? "Please enter a valid email."
      : locale === "pt"
        ? "Digite um email valido."
        : locale === "it"
          ? "Inserisci un'email valida."
          : "Ingresa un email valido.";
  const submitErrorMessage =
    locale === "en"
      ? "The report could not be sent."
      : locale === "pt"
        ? "Nao foi possivel enviar a denuncia."
        : locale === "it"
          ? "Non e stato possibile inviare la segnalazione."
          : "No se pudo enviar la denuncia.";

  const submit = async () => {
    if (!fullName.trim() || !phone.trim() || !details.trim()) {
      setError(
        locale === "en"
          ? "Please complete name, phone and details."
          : locale === "pt"
            ? "Complete nome, telefone e detalhes."
            : locale === "it"
              ? "Completa nome, telefono e dettaglio."
              : "Completa nombre, telefono y detalle."
      );
      return;
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError(invalidEmailMessage);
      return;
    }
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ publicationId, publicationTitle, reason: "Denuncia", details, fullName, contact: phone, email }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const message = typeof body?.error === "string" && body.error.trim() ? body.error : submitErrorMessage;
        throw new Error(message);
      }
      setSent(true);
      setSuccessMessage(
        locale === "en"
          ? "Thanks for your warning."
          : locale === "pt"
            ? "Obrigado pelo aviso."
            : locale === "it"
              ? "Grazie per il tuo avviso."
              : "Gracias por tu aviso."
      );
      setDetails("");
      setFullName("");
      setPhone("");
      setEmail("");
      setOpen(false);
    } catch (err) {
      const message = err instanceof Error && err.message.trim() ? err.message : submitErrorMessage;
      setError(message);
    } finally {
      setSending(false);
    }
  };

  const labels = locale === "en"
    ? {
        report: "Report",
        suspicious: "Something seems off",
        title: "Thanks for notifying us",
        fullName: "Full name",
        fullNamePlaceholder: "Enter your full name",
        email: "Email",
        phone: "Phone number",
        phonePlaceholder: "Enter your phone number",
        detailsLabel: "Details",
        emailPlaceholder: "Enter your email",
        details: "Write your complaint or indicate what information is incorrect",
        send: "Send report",
        sent: "Report sent",
        publication: "Publication:",
      }
    : locale === "pt"
      ? {
          report: "Denunciar",
          suspicious: "Parece estranho",
          title: "Obrigado por notificar",
          fullName: "Nome e sobrenome",
          fullNamePlaceholder: "Digite seu nome e sobrenome",
          email: "Email",
          phone: "Numero de telefone",
          phonePlaceholder: "Digite seu numero de telefone",
          detailsLabel: "Detalhes",
          emailPlaceholder: "Digite seu email",
          details: "Escreva sua reclamacao ou indique qual informacao esta incorreta",
          send: "Enviar denuncia",
          sent: "Denuncia enviada",
          publication: "Publicacao:",
        }
      : locale === "it"
        ? {
            report: "Segnala",
            suspicious: "Sembra strano",
            title: "Grazie per la segnalazione",
            fullName: "Nome e cognome",
            fullNamePlaceholder: "Inserisci nome e cognome",
            email: "Email",
            phone: "Numero di telefono",
            phonePlaceholder: "Inserisci il numero di telefono",
            detailsLabel: "Dettagli",
            emailPlaceholder: "Inserisci la tua email",
            details: "Scrivi il tuo reclamo o indica quali informazioni sono errate",
            send: "Invia segnalazione",
            sent: "Segnalazione inviata",
            publication: "Pubblicazione:",
          }
        : {
            report: "Denunciar",
            suspicious: "Se ve algo raro",
            title: "Gracias por notificar",
            fullName: "Nombre y apellido",
            fullNamePlaceholder: "Ingresa tu nombre y apellido",
            email: "Email",
            phone: "Numero de telefono",
            phonePlaceholder: "Ingresa tu numero de telefono",
            detailsLabel: "Detalle",
            emailPlaceholder: "Ingresa tu email",
            details: "Escribe tu queja o indica que informacion es incorrecta",
            send: "Enviar denuncia",
            sent: "Denuncia enviada",
            publication: "Publicacion:",
          };

  return (
    <>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button type="button" onClick={() => setOpen(true)} className="rounded-xl border border-red-600 bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
          {labels.report}
        </button>
        <button type="button" onClick={() => setOpen(true)} className="rounded-xl border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50">
          {labels.suspicious}
        </button>
      </div>
      {successMessage ? <p className="mt-2 text-sm font-medium text-emerald-600">{successMessage}</p> : null}
      {open ? (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-lg font-semibold text-slate-900">{labels.title}</h3>
            <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700">
              {labels.publication} {publicationTitle || publicationId}
            </p>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-black">{labels.fullName}</label>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 dark:bg-white dark:text-slate-900" style={{ colorScheme: "light" }} placeholder={labels.fullNamePlaceholder} />
              <label className="text-sm font-medium text-black">{labels.email}</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 dark:bg-white dark:text-slate-900" style={{ colorScheme: "light" }} placeholder={labels.emailPlaceholder} />
              <label className="text-sm font-medium text-black">{labels.phone}</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 dark:bg-white dark:text-slate-900" style={{ colorScheme: "light" }} placeholder={labels.phonePlaceholder} />
              <label className="text-sm font-medium text-black">{labels.detailsLabel}</label>
              <textarea value={details} onChange={(e) => setDetails(e.target.value)} className="min-h-[110px] rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 placeholder:text-slate-400 dark:bg-white dark:text-slate-900" style={{ colorScheme: "light" }} placeholder={labels.details} />
              <button disabled={sending || sent} onClick={submit} className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {sent ? labels.sent : sending ? "..." : labels.send}
              </button>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
