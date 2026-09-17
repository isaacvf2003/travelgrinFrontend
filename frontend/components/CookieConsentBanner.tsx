"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { Settings, ShieldCheck, X } from "lucide-react";

export default function CookieConsentBanner() {
  const { locale } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [analyticsConsent, setAnalyticsConsent] = useState(true);
  const [marketingConsent, setMarketingConsent] = useState(true);

  const texts = {
    es: {
      title: "Valoramos tu privacidad",
      description: "Utilizamos cookies propias y de terceros para analizar el tráfico del sitio y personalizar anuncios. Puedes aceptar todas, rechazarlas o configurar tus preferencias.",
      acceptAll: "Aceptar todas",
      rejectAll: "Solo necesarias",
      configure: "Personalizar",
      save: "Guardar preferencias",
      analytics: "Análisis y Estadísticas",
      analyticsDesc: "Permite medir las visitas y fuentes de tráfico para mejorar el funcionamiento de la web.",
      marketing: "Publicidad y Anuncios",
      marketingDesc: "Permite personalizar anuncios relevantes según tus intereses de navegación.",
    },
    en: {
      title: "We value your privacy",
      description: "We use first and third-party cookies to analyze site traffic and personalize ads. You can accept all, reject non-essential ones, or customize your preferences.",
      acceptAll: "Accept all",
      rejectAll: "Necessary only",
      configure: "Customize",
      save: "Save preferences",
      analytics: "Analytics & Statistics",
      analyticsDesc: "Allows us to measure visits and traffic sources to improve website performance.",
      marketing: "Marketing & Ads",
      marketingDesc: "Allows us to show you relevant and personalized ads based on your interests.",
    },
    pt: {
      title: "Valoramos sua privacidade",
      description: "Utilizamos cookies próprios e de terceiros para analisar o tráfego do site e personalizar anúncios. Você pode aceitar todos, rejeitar ou configurar suas preferências.",
      acceptAll: "Aceitar todos",
      rejectAll: "Apenas necessárias",
      configure: "Personalizar",
      save: "Salvar preferências",
      analytics: "Análise e Estatísticas",
      analyticsDesc: "Permite medir visitas e fontes de tráfego para melhorar o funcionamento do site.",
      marketing: "Marketing e Anúncios",
      marketingDesc: "Permite personalizar anúncios relevantes de acordo com seus interesses.",
    },
    it: {
      title: "Valorizziamo la tua privacy",
      description: "Utilizziamo cookie proprietari e di terze parti per analizzare il traffico del sito e personalizzare gli annunci. Puoi accettare tutti, rifiutare o configurare le tue preferenze.",
      acceptAll: "Accetta tutti",
      rejectAll: "Solo necessari",
      configure: "Personalizza",
      save: "Salva preferenze",
      analytics: "Analisi e Statistiche",
      analyticsDesc: "Consente di misurare visite e fonti di traffico per migliorare il funzionamento del sito web.",
      marketing: "Marketing e Annunci",
      marketingDesc: "Consente di mostrare annunci pertinenti e personalizzati in base ai tuoi interessi.",
    },
  };

  const currentText = texts[locale as keyof typeof texts] || texts.es;

  useEffect(() => {
    // Verificar si el usuario ya decidió anteriormente
    const consent = localStorage.getItem("tg_cookie_consent");
    if (!consent) {
      // Retrasar levemente la visualización para dar un efecto premium
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const updateGoogleConsent = (analytics: boolean, marketing: boolean) => {
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("consent", "update", {
        analytics_storage: analytics ? "granted" : "denied",
        ad_storage: marketing ? "granted" : "denied",
        ad_user_data: marketing ? "granted" : "denied",
        ad_personalization: marketing ? "granted" : "denied",
      });
    }
  };

  const handleAcceptAll = () => {
    localStorage.setItem("tg_cookie_consent", "accepted");
    updateGoogleConsent(true, true);
    setIsVisible(false);
  };

  const handleRejectAll = () => {
    localStorage.setItem("tg_cookie_consent", "rejected");
    updateGoogleConsent(false, false);
    setIsVisible(false);
  };

  const handleSaveSelection = () => {
    localStorage.setItem(
      "tg_cookie_consent",
      analyticsConsent && marketingConsent ? "accepted" : "custom"
    );
    // Guardar detalles de customización local por si acaso
    localStorage.setItem("tg_cookie_analytics", String(analyticsConsent));
    localStorage.setItem("tg_cookie_marketing", String(marketingConsent));
    updateGoogleConsent(analyticsConsent, marketingConsent);
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-6 right-6 left-6 md:left-auto md:max-w-md z-[9999] animate-fade-in-up">
      <div className="relative overflow-hidden rounded-2xl border border-white/20 bg-slate-900/95 p-5 text-white shadow-2xl backdrop-blur-md">
        
        {/* Top Accent Gradient Line */}
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#08D9BD] via-[#04B5BD] to-[#009ABC]" />

        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-[#08D9BD]">
            <ShieldCheck size={20} />
            <h3 className="font-semibold text-sm tracking-wide uppercase">{currentText.title}</h3>
          </div>
          <button 
            onClick={handleRejectAll}
            className="text-slate-400 hover:text-white transition"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {!showConfig ? (
          <>
            <p className="mt-3 text-xs leading-relaxed text-slate-300">
              {currentText.description}
            </p>

            <div className="mt-4 flex flex-wrap gap-2 justify-end">
              <button
                onClick={() => setShowConfig(true)}
                className="flex items-center gap-1 rounded-xl bg-slate-800 hover:bg-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 transition"
              >
                <Settings size={12} />
                <span>{currentText.configure}</span>
              </button>
              <button
                onClick={handleRejectAll}
                className="rounded-xl border border-slate-700 hover:border-slate-600 hover:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-300 transition"
              >
                {currentText.rejectAll}
              </button>
              <button
                onClick={handleAcceptAll}
                className="rounded-xl bg-gradient-to-r from-[#08D9BD] to-[#009ABC] hover:opacity-90 px-4 py-2 text-xs font-bold text-slate-950 shadow-md transition"
              >
                {currentText.acceptAll}
              </button>
            </div>
          </>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="rounded-xl bg-slate-800/50 border border-slate-800 p-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-200 cursor-pointer select-none" htmlFor="analytics-check">
                  {currentText.analytics}
                </label>
                <input
                  id="analytics-check"
                  type="checkbox"
                  checked={analyticsConsent}
                  onChange={(e) => setAnalyticsConsent(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-[#009ABC] focus:ring-[#009ABC] focus:ring-offset-slate-900"
                />
              </div>
              <p className="mt-1 text-[10px] text-slate-400 leading-normal">
                {currentText.analyticsDesc}
              </p>
            </div>

            <div className="rounded-xl bg-slate-800/50 border border-slate-800 p-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-200 cursor-pointer select-none" htmlFor="marketing-check">
                  {currentText.marketing}
                </label>
                <input
                  id="marketing-check"
                  type="checkbox"
                  checked={marketingConsent}
                  onChange={(e) => setMarketingConsent(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-[#009ABC] focus:ring-[#009ABC] focus:ring-offset-slate-900"
                />
              </div>
              <p className="mt-1 text-[10px] text-slate-400 leading-normal">
                {currentText.marketingDesc}
              </p>
            </div>

            <div className="flex gap-2 justify-between items-center pt-2">
              <button
                onClick={() => setShowConfig(false)}
                className="text-xs text-slate-400 hover:text-white transition font-medium"
              >
                &larr; Volver
              </button>
              <button
                onClick={handleSaveSelection}
                className="rounded-xl bg-gradient-to-r from-[#08D9BD] to-[#009ABC] hover:opacity-90 px-4 py-2 text-xs font-bold text-slate-950 shadow-md transition"
              >
                {currentText.save}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
