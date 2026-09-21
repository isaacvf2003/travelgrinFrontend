"use client";

import { useState, useEffect } from "react";

export type I18nRecord = Record<string, string>;

export interface ExtraDescriptionBlock {
  title: string;
  titleI18n: I18nRecord;
  body: string;
  bodyI18n: I18nRecord;
  visibleInCard: boolean;
}

export interface SocialLinkDetail {
  kind: string;
  label: string;
  url: string;
}

export interface ScrapedPublicationDraft {
  url: string;
  title: string;
  titleI18n: I18nRecord;
  description: string;
  descriptionI18n: I18nRecord;
  extraDescriptions: ExtraDescriptionBlock[];
  publisherName: string;
  providerInfoI18n: I18nRecord;
  providerStartYear: string;
  providerRating: string;
  providerReviewCount: string;
  providerCommentsUrl: string;
  providerLogo: string;
  country: string;
  city: string;
  locationAddress: string;
  currency: string;
  price: string;
  pricePeriod: string;
  languages: string;
  website: string;
  socialLinksDetailed: SocialLinkDetail[];
  images: string[];
  category: string;
  subcategory: string;
  headquarterCountry?: string;
  headquarterCity?: string;
  headquarterLocations?: Array<{ country: string; city: string; address?: string; mapUrl: string }>;
  categorySelections?: string[];
  subcategorySelections?: string[];
  providerActivities?: string[];
  providerTypes?: string[];
  providerModalities?: string[];
  status?: "active" | "draft" | "paused";
}

interface AiScraperModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDraftToEdit: (draft: ScrapedPublicationDraft) => void;
  onApproveDirectly?: (draft: ScrapedPublicationDraft) => Promise<boolean>;
}

export default function AiScraperModal({
  isOpen,
  onClose,
  onSelectDraftToEdit,
  onApproveDirectly,
}: AiScraperModalProps) {
  const [tab, setTab] = useState<"single" | "bulk">("single");
  const [aiProvider, setAiProvider] = useState<"auto" | "gemini" | "openai">("auto");
  const [customApiKey, setCustomApiKey] = useState("");
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [singleUrl, setSingleUrl] = useState("");
  const [bulkUrlsText, setBulkUrlsText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [draftsQueue, setDraftsQueue] = useState<ScrapedPublicationDraft[]>([]);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [successNotice, setSuccessNotice] = useState("");

  // Accordion Inline Form State for active draft inspection directly in the queue card
  const [expandedDraftIndex, setExpandedDraftIndex] = useState<number | null>(null);
  const [draftForm, setDraftForm] = useState<ScrapedPublicationDraft | null>(null);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [customLogoInput, setCustomLogoInput] = useState("");

  // Restore queue from sessionStorage and customApiKey from localStorage on load if available (Client-side only)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const savedKey = window.localStorage.getItem("tgn_ai_custom_api_key");
      if (savedKey) setCustomApiKey(savedKey);

      const saved = window.sessionStorage.getItem("tgn_ai_drafts_queue");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setDraftsQueue(parsed);
        }
      }
    } catch {}
  }, []);

  const handleSaveApiKey = (keyVal: string) => {
    setCustomApiKey(keyVal);
    try {
      if (typeof window !== "undefined") {
        if (keyVal.trim()) {
          window.localStorage.setItem("tgn_ai_custom_api_key", keyVal.trim());
        } else {
          window.localStorage.removeItem("tgn_ai_custom_api_key");
        }
      }
    } catch {}
  };

  // Sync draftsQueue with sessionStorage on any change
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (draftsQueue.length > 0) {
        window.sessionStorage.setItem("tgn_ai_drafts_queue", JSON.stringify(draftsQueue));
      } else {
        window.sessionStorage.removeItem("tgn_ai_drafts_queue");
      }
    } catch {}
  }, [draftsQueue]);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setErrorMessage("");
    setSuccessNotice("");
    let urlsToProcess: string[] = [];

    if (tab === "single") {
      const trimmed = singleUrl.trim();
      if (!trimmed) {
        setErrorMessage("Por favor ingrese una URL válida.");
        return;
      }
      urlsToProcess = [trimmed];
    } else {
      urlsToProcess = bulkUrlsText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      if (!urlsToProcess.length) {
        setErrorMessage("Por favor ingrese al menos una URL (una por línea).");
        return;
      }
    }

    setIsProcessing(true);

    try {
      const res = await fetch("/api/admin/ai-scrape-publications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          urls: urlsToProcess,
          provider: aiProvider,
          apiKey: customApiKey.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Error al procesar el scraping web con IA.");
      }

      // Strictly exclude tracking pixels, tiny spacers, generic UI widgets
      const BAD_GFX = /(?:^|\/|[._-])(?:megafono|widget|button|avatar|bullet|star|check|arrow|spinner|loader|receipt|placeholder|flaticon|fontawesome|1x1|spacer|pixel)\b/i;

      const generatedDrafts: ScrapedPublicationDraft[] = (data.publications || []).map(
        (pub: ScrapedPublicationDraft) => ({
          ...pub,
          providerLogo: pub.providerLogo && !BAD_GFX.test(pub.providerLogo) ? pub.providerLogo : "",
          images: (pub.images || []).filter((img) => img && !BAD_GFX.test(img)),
          status: pub.status || "active",
        })
      );

      setDraftsQueue((prev) => {
        const updated = [...prev, ...generatedDrafts];
        try {
          if (typeof window !== "undefined") {
            window.sessionStorage.setItem("tgn_ai_drafts_queue", JSON.stringify(updated));
          }
        } catch {}
        return updated;
      });

      if (tab === "single" && generatedDrafts.length === 1) {
        setSuccessNotice("Publicación generada exitosamente.");
      } else {
        setSuccessNotice(`Se generaron ${generatedDrafts.length} borrador(es) en la cola de revisión.`);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "No se pudo completar la extracción web.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveDraft = (index: number) => {
    setDraftsQueue((prev) => prev.filter((_, i) => i !== index));
    if (expandedDraftIndex === index) {
      setExpandedDraftIndex(null);
      setDraftForm(null);
    }
  };

  const handleApproveDraft = async (draft: ScrapedPublicationDraft, index: number) => {
    if (!onApproveDirectly) {
      onSelectDraftToEdit(draft);
      handleRemoveDraft(index);
      onClose();
      return;
    }

    setSavingIndex(index);
    try {
      const success = await onApproveDirectly(draft);
      if (success) {
        handleRemoveDraft(index);
      } else {
        setErrorMessage("Error al guardar la publicación aprobada.");
      }
    } catch {
      setErrorMessage("Excepción al guardar la publicación.");
    } finally {
      setSavingIndex(null);
    }
  };

  const handleApproveAll = async () => {
    if (!onApproveDirectly || !draftsQueue.length) return;
    setSavingAll(true);
    setErrorMessage("");

    try {
      const remaining: ScrapedPublicationDraft[] = [];
      for (const draft of draftsQueue) {
        const ok = await onApproveDirectly(draft);
        if (!ok) {
          remaining.push(draft);
        }
      }
      setDraftsQueue(remaining);
      if (remaining.length === 0) {
        setSuccessNotice("Todas las publicaciones fueron aprobadas y guardadas.");
      } else {
        setErrorMessage(`Se guardaron algunas publicaciones, pero ${remaining.length} fallaron.`);
      }
    } catch {
      setErrorMessage("Error al procesar el guardado masivo.");
    } finally {
      setSavingAll(false);
    }
  };

  const toggleDraftAccordion = (index: number) => {
    if (expandedDraftIndex === index) {
      setExpandedDraftIndex(null);
      setDraftForm(null);
    } else {
      const target = draftsQueue[index];
      if (!target) return;
      setExpandedDraftIndex(index);
      setDraftForm(JSON.parse(JSON.stringify(target)));
      setCustomLogoInput(target.providerLogo || "");
      setNewImageUrl("");
    }
  };

  const closeInspector = () => {
    setExpandedDraftIndex(null);
    setDraftForm(null);
  };

  const saveInspectorChangesToQueue = () => {
    if (expandedDraftIndex === null || !draftForm) return;
    setDraftsQueue((prev) => {
      const updated = prev.map((d, i) => (i === expandedDraftIndex ? { ...draftForm } : d));
      try {
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem("tgn_ai_drafts_queue", JSON.stringify(updated));
        }
      } catch {}
      return updated;
    });
    setSuccessNotice("Cambios guardados en el borrador de la cola.");
    window.setTimeout(() => setSuccessNotice(""), 3000);
  };

  const approveFromInspector = async () => {
    if (expandedDraftIndex === null || !draftForm) return;
    const currentIdx = expandedDraftIndex;
    const updatedDraft = { ...draftForm };
    setDraftsQueue((prev) => {
      const updated = prev.map((d, i) => (i === currentIdx ? updatedDraft : d));
      try {
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem("tgn_ai_drafts_queue", JSON.stringify(updated));
        }
      } catch {}
      return updated;
    });
    await handleApproveDraft(updatedDraft, currentIdx);
  };

  const handleFileUploadAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  const handleLogoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !draftForm) return;
    try {
      const base64 = await handleFileUploadAsBase64(file);
      setDraftForm({ ...draftForm, providerLogo: base64 });
      setCustomLogoInput(base64);
    } catch (err) {
      console.error("Logo upload error:", err);
    }
  };

  const handleAddImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !files.length || !draftForm) return;
    try {
      const uploadedUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const b64 = await handleFileUploadAsBase64(files[i]);
        uploadedUrls.push(b64);
      }
      setDraftForm({
        ...draftForm,
        images: [...(draftForm.images || []), ...uploadedUrls],
      });
    } catch (err) {
      console.error("Images upload error:", err);
    }
  };

  const handleAddImageUrl = () => {
    if (!newImageUrl.trim() || !draftForm) return;
    setDraftForm({
      ...draftForm,
      images: [...(draftForm.images || []), newImageUrl.trim()],
    });
    setNewImageUrl("");
  };

  const handleRemoveImageIndex = (imgIdx: number) => {
    if (!draftForm) return;
    setDraftForm({
      ...draftForm,
      images: (draftForm.images || []).filter((_, i) => i !== imgIdx),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Extracción y Generación Masiva con IA</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Genera automáticamente publicaciones en 4 idiomas (ES, EN, PT, IT) e inspecciona o edita los borradores antes de guardar.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
          >
            Cerrar
          </button>
        </div>

        {/* Tab Selection */}
        <div className="mt-4 flex gap-2 border-b border-slate-200">
          <button
            type="button"
            onClick={() => setTab("single")}
            className={`pb-2 px-4 text-sm font-semibold transition border-b-2 ${
              tab === "single"
                ? "border-[#00A9C6] text-[#00A9C6]"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Generación Individual
          </button>
          <button
            type="button"
            onClick={() => setTab("bulk")}
            className={`pb-2 px-4 text-sm font-semibold transition border-b-2 ${
              tab === "bulk"
                ? "border-[#00A9C6] text-[#00A9C6]"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Generación Masiva (Lote de URLs)
          </button>
        </div>

        {/* Input Controls */}
        <div className="mt-4 space-y-4">
          {tab === "single" ? (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                URL del sitio web a escrapear
              </label>
              <input
                type="url"
                value={singleUrl}
                onChange={(e) => setSingleUrl(e.target.value)}
                placeholder="Ej: https://www.uba.ar o https://www.hospitalitaliano.org.ar"
                className="w-full h-11 rounded-xl border border-slate-200 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00A9C6]/30"
                disabled={isProcessing}
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                URLs a escrapear (una por línea, máx. 10)
              </label>
              <textarea
                value={bulkUrlsText}
                onChange={(e) => setBulkUrlsText(e.target.value)}
                rows={5}
                placeholder={"https://osepmendoza.com.ar/web/\nhttps://hospitalitaliano.org.ar\nhttps://estudiojuridico.com"}
                className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:ring-2 focus:ring-[#00A9C6]/30"
                disabled={isProcessing}
              />
            </div>
          )}

          {errorMessage && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">
              {errorMessage}
            </div>
          )}

          {successNotice && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-700">
              {successNotice}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs font-semibold text-slate-700">Motor de IA:</label>
              <select
                value={aiProvider}
                onChange={(e) => setAiProvider(e.target.value as any)}
                disabled={isProcessing}
                className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-[#00A9C6]/30 cursor-pointer"
              >
                <option value="auto">Automático (Recomendado)</option>
                <option value="gemini">Google Gemini (Pruebas)</option>
                <option value="openai">OpenAI GPT-4o (Producción)</option>
              </select>

              <button
                type="button"
                onClick={() => setShowApiKeyInput(!showApiKeyInput)}
                className="text-xs text-[#00A9C6] hover:underline font-medium ml-1"
              >
                {showApiKeyInput ? "Ocultar clave de API" : "Configurar API Key (Opcional)"}
              </button>
            </div>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={isProcessing}
              className="h-10 rounded-xl bg-[#00A9C6] px-5 text-sm font-semibold text-white hover:bg-[#0095AE] disabled:opacity-50 transition shadow-sm"
            >
              {isProcessing ? "Extrayendo y generando..." : "Generar con IA"}
            </button>
          </div>

          {showApiKeyInput && (
            <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-3 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sky-900">Clave de API propia (Google Gemini o OpenAI):</span>
                {customApiKey && (
                  <button
                    type="button"
                    onClick={() => handleSaveApiKey("")}
                    className="text-rose-600 hover:underline text-[11px]"
                  >
                    Borrar clave guardada
                  </button>
                )}
              </div>
              <input
                type="password"
                value={customApiKey}
                onChange={(e) => handleSaveApiKey(e.target.value)}
                placeholder="Pega aquí tu clave AIza... o sk-..."
                className="w-full rounded-lg border border-sky-200 bg-white px-3 py-1.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-[#00A9C6]/30"
              />
              <p className="text-[11px] text-sky-700">
                Opcional: Si tu servidor Vercel no tiene <code className="font-mono bg-white px-1 rounded">GEMINI_API_KEY</code> o <code className="font-mono bg-white px-1 rounded">OPENAI_API_KEY</code> configurada, puedes ingresarla aquí directamente. Se guardará de manera privada en tu navegador.
              </p>
            </div>
          )}
        </div>

        {/* Review Queue (Cola de Revisión) */}
        {draftsQueue.length > 0 && (
          <div className="mt-8 border-t border-slate-200 pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Cola de Revisión ({draftsQueue.length} borrador{draftsQueue.length > 1 ? "es" : ""})
                </h3>
                <p className="text-xs text-slate-500">
                  Inspecciona, edita imágenes/logos o cambia el estado antes de publicar.
                </p>
              </div>

              {onApproveDirectly && draftsQueue.length > 1 && (
                <button
                  type="button"
                  onClick={handleApproveAll}
                  disabled={savingAll}
                  className="h-9 rounded-xl border border-emerald-600 bg-emerald-50 px-4 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                >
                  {savingAll ? "Guardando lote..." : "Aprobar y guardar todas"}
                </button>
              )}
            </div>

            <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
              {draftsQueue.map((draft, index) => (
                <div
                  key={`draft-${index}-${draft.url}`}
                  className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-200/60 pb-3">
                    <div className="flex items-start gap-3">
                      {draft.providerLogo ? (
                        <div
                          className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl border border-slate-300 bg-slate-100 p-1 flex items-center justify-center shadow-xs"
                          style={{
                            backgroundImage:
                              "linear-gradient(45deg, #cbd5e1 25%, transparent 25%), linear-gradient(-45deg, #cbd5e1 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #cbd5e1 75%), linear-gradient(-45deg, transparent 75%, #cbd5e1 75%)",
                            backgroundSize: "8px 8px",
                            backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0px",
                          }}
                        >
                          <img
                            src={draft.providerLogo}
                            alt="Logo"
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-contain drop-shadow-[0_1px_1.5px_rgba(0,0,0,0.7)]"
                            onError={(e) => {
                              try {
                                const host = new URL(draft.website || draft.url || draft.providerLogo).hostname;
                                if (host && !e.currentTarget.src.includes("google.com/s2/favicons")) {
                                  e.currentTarget.src = `https://www.google.com/s2/favicons?domain=${host}&sz=128`;
                                }
                              } catch {}
                            }}
                          />
                        </div>
                      ) : null}
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-[#00A9C6] uppercase tracking-wider">
                            {draft.category || "General"} {draft.subcategory ? `· ${draft.subcategory}` : ""}
                          </span>
                          {(() => {
                            const scoreBlock = (draft.extraDescriptions || []).find((d) => /score scout/i.test(d.title || d.titleI18n?.es || ""));
                            if (scoreBlock) {
                              return (
                                <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-bold text-[#007D92] border border-cyan-200">
                                  {scoreBlock.title || scoreBlock.titleI18n?.es}
                                </span>
                              );
                            }
                            return null;
                          })()}
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              draft.status === "draft"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {draft.status === "draft" ? "Borrador" : "Activo"}
                          </span>
                        </div>
                        <h4 className="text-base font-semibold text-slate-900 mt-0.5">{draft.title}</h4>
                        <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span>Oferente: <strong className="text-slate-700">{draft.publisherName}</strong></span>
                          <span>·</span>
                          <span>Ubicación: <strong className="text-slate-700">{draft.city}, {draft.country}</strong></span>
                          {draft.providerRating ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 border border-amber-200">
                              ⭐ {draft.providerRating} ({draft.providerReviewCount || "0"} reseñas)
                            </span>
                          ) : null}
                          {draft.headquarterLocations && draft.headquarterLocations.length > 1 && (
                            <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 border border-indigo-200">
                              📍 {draft.headquarterLocations.length} sedes
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectDraftToEdit(draft);
                          onClose();
                        }}
                        className="rounded-lg border border-[#00A9C6] bg-cyan-50 px-3.5 py-1.5 text-xs font-bold text-[#007D92] hover:bg-cyan-100 shadow-sm"
                      >
                        📝 Pasar a Formulario Principal
                      </button>

                      {onApproveDirectly && (
                        <button
                          type="button"
                          onClick={() => handleApproveDraft(draft, index)}
                          disabled={savingIndex === index}
                          className="rounded-lg bg-[#00A9C6] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0095AE] disabled:opacity-50"
                        >
                          {savingIndex === index ? "Guardando..." : "Aprobar y Guardar"}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleRemoveDraft(index)}
                        className="rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                      >
                        Descartar
                      </button>
                    </div>
                  </div>

                  {/* Multi-Sedes summary pills if more than 1 sede */}
                  {draft.headquarterLocations && draft.headquarterLocations.length > 1 && (
                    <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-2.5 text-xs">
                      <span className="font-semibold text-indigo-900 block mb-1">
                        Sedes / Facultades / Centros Detectados ({draft.headquarterLocations.length}):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {draft.headquarterLocations.map((hq, hqIdx) => (
                          <a
                            key={`sede-${hqIdx}-${hq.city}`}
                            href={hq.mapUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-white px-2 py-1 text-[11px] text-indigo-800 hover:bg-indigo-50 transition"
                            title={hq.address || hq.city}
                          >
                            <span>📍 {hq.city}</span>
                            {hq.address && <span className="text-slate-500 max-w-[200px] truncate">({hq.address})</span>}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Summary Badges */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-600">
                    <div className="rounded-xl border border-slate-200 bg-white p-2">
                      <span className="font-semibold block text-slate-800">Categoría</span>
                      {draft.category || "General"}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-2">
                      <span className="font-semibold block text-slate-800">Subcategoría</span>
                      {draft.subcategory || "General"}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-2">
                      <span className="font-semibold block text-slate-800">Tipo de Perfil / Sector</span>
                      {draft.providerActivities?.[0] || draft.providerTypes?.[0] || "Institución"}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-2">
                      <span className="font-semibold block text-slate-800">Imágenes</span>
                      {draft.images?.length || 0} imagen(es)
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
