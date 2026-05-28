"use client";

import { MessageSquareMore, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function FeedbackFloatingButton() {
  const { locale } = useTranslation();
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [error, setError] = useState("");

  const labels =
    locale === "en"
      ? {
          floating: "Feedback",
          title: "Send us your feedback",
          subtitle: "Your message helps us improve Travelgrin.",
          fullName: "Full name",
          fullNamePlaceholder: "Enter your full name",
          email: "Email",
          emailPlaceholder: "Enter your email",
          phone: "Phone number",
          phonePlaceholder: "Enter your phone number",
          details: "Message",
          detailsPlaceholder: "Write your feedback",
          cancel: "Close",
          send: "Send feedback",
          sending: "Sending...",
          success: "Thanks! We received your feedback.",
          required: "Please complete name, phone and message.",
          invalidEmail: "Please enter a valid email.",
          fail: "Could not send feedback.",
        }
      : locale === "pt"
        ? {
            floating: "Feedback",
            title: "Envie seu feedback",
            subtitle: "Sua mensagem nos ajuda a melhorar o Travelgrin.",
            fullName: "Nome e sobrenome",
            fullNamePlaceholder: "Digite seu nome e sobrenome",
            email: "Email",
            emailPlaceholder: "Digite seu email",
            phone: "Numero de telefone",
            phonePlaceholder: "Digite seu numero de telefone",
            details: "Mensagem",
            detailsPlaceholder: "Escreva seu feedback",
            cancel: "Fechar",
            send: "Enviar feedback",
            sending: "Enviando...",
            success: "Obrigado! Recebemos seu feedback.",
            required: "Complete nome, telefone e mensagem.",
            invalidEmail: "Digite um email valido.",
            fail: "Nao foi possivel enviar o feedback.",
          }
        : locale === "it"
          ? {
              floating: "Feedback",
              title: "Inviaci il tuo feedback",
              subtitle: "Il tuo messaggio ci aiuta a migliorare Travelgrin.",
              fullName: "Nome e cognome",
              fullNamePlaceholder: "Inserisci nome e cognome",
              email: "Email",
              emailPlaceholder: "Inserisci la tua email",
              phone: "Numero di telefono",
              phonePlaceholder: "Inserisci il numero di telefono",
              details: "Messaggio",
              detailsPlaceholder: "Scrivi il tuo feedback",
              cancel: "Chiudi",
              send: "Invia feedback",
              sending: "Invio...",
              success: "Grazie! Abbiamo ricevuto il tuo feedback.",
              required: "Compila nome, telefono e messaggio.",
              invalidEmail: "Inserisci un'email valida.",
              fail: "Impossibile inviare il feedback.",
            }
          : {
              floating: "Feedback",
              title: "Envíanos tu feedback",
              subtitle: "Tu mensaje nos ayuda a mejorar Travelgrin.",
              fullName: "Nombre y apellido",
              fullNamePlaceholder: "Ingresa tu nombre y apellido",
              email: "Email",
              emailPlaceholder: "Ingresa tu email",
              phone: "Numero de telefono",
              phonePlaceholder: "Ingresa tu numero de telefono",
              details: "Mensaje",
              detailsPlaceholder: "Escribe tu feedback",
              cancel: "Cerrar",
              send: "Enviar feedback",
              sending: "Enviando...",
              success: "Gracias. Recibimos tu feedback.",
              required: "Completa nombre, telefono y mensaje.",
              invalidEmail: "Ingresa un email valido.",
              fail: "No se pudo enviar el feedback.",
            };

  async function submitFeedback() {
    if (!fullName.trim() || !phone.trim() || !details.trim()) {
      setError(labels.required);
      return;
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError(labels.invalidEmail);
      return;
    }

    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          publicationId: "feedback-general",
          publicationTitle: "Feedback general",
          reason: "Feedback",
          details,
          fullName,
          contact: phone,
          email,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const message = typeof body?.error === "string" && body.error.trim() ? body.error : labels.fail;
        throw new Error(message);
      }

      setSuccessMessage(labels.success);
      setFullName("");
      setPhone("");
      setEmail("");
      setDetails("");
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error && err.message.trim() ? err.message : labels.fail);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 left-6 z-[401] inline-flex items-center gap-2 rounded-full bg-[#0D9488] px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-[#0f766e]"
      >
        <MessageSquareMore size={16} />
        <span>{labels.floating}</span>
      </button>

      {successMessage ? (
        <div className="fixed bottom-20 left-6 z-[401] rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-lg">
          {successMessage}
        </div>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-xl rounded-2xl bg-white p-5" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{labels.title}</h3>
                <p className="text-sm text-slate-500">{labels.subtitle}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium text-black">{labels.fullName}</label>
              <input value={fullName} onChange={(event) => setFullName(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900" placeholder={labels.fullNamePlaceholder} />
              <label className="text-sm font-medium text-black">{labels.email}</label>
              <input value={email} onChange={(event) => setEmail(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900" placeholder={labels.emailPlaceholder} />
              <label className="text-sm font-medium text-black">{labels.phone}</label>
              <input value={phone} onChange={(event) => setPhone(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900" placeholder={labels.phonePlaceholder} />
              <label className="text-sm font-medium text-black">{labels.details}</label>
              <textarea value={details} onChange={(event) => setDetails(event.target.value)} className="min-h-[110px] rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900" placeholder={labels.detailsPlaceholder} />

              <div className="mt-1 flex flex-wrap gap-2">
                <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  {labels.cancel}
                </button>
                <button
                  type="button"
                  disabled={sending}
                  onClick={submitFeedback}
                  className="rounded-lg bg-[#0D9488] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {sending ? labels.sending : labels.send}
                </button>
              </div>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

