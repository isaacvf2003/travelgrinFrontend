"use client";

import { useState } from "react";

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
  const [singleUrl, setSingleUrl] = useState("");
  const [bulkUrlsText, setBulkUrlsText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [draftsQueue, setDraftsQueue] = useState<ScrapedPublicationDraft[]>([]);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [successNotice, setSuccessNotice] = useState("");

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
        body: JSON.stringify({ urls: urlsToProcess }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Error al procesar el scraping web con IA.");
      }

      const generatedDrafts: ScrapedPublicationDraft[] = data.publications || [];
      setDraftsQueue((prev) => [...prev, ...generatedDrafts]);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Extracción y Generación Masiva con IA</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Genera automáticamente publicaciones en 4 idiomas (ES, EN, PT, IT) y bloques de descripción a partir de URLs web.
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
                placeholder={"https://www.uba.ar\nhttps://www.hospitalitaliano.org.ar\nhttps://estudiojuridico.com"}
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

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isProcessing}
              className="h-10 rounded-xl bg-[#00A9C6] px-5 text-sm font-semibold text-white hover:bg-[#0095AE] disabled:opacity-50"
            >
              {isProcessing ? "Extrayendo y generando..." : "Generar con IA"}
            </button>
          </div>
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
                  Revisa cada publicación generada antes de cargarla en el editor o aprobarla directamente.
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
                    <div>
                      <div className="text-xs font-bold text-[#00A9C6] uppercase tracking-wider">
                        {draft.category || "General"} {draft.subcategory ? `· ${draft.subcategory}` : ""}
                      </div>
                      <h4 className="text-base font-semibold text-slate-900 mt-0.5">{draft.title}</h4>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Oferente: <span className="font-medium text-slate-700">{draft.publisherName}</span> · País: <span className="font-medium text-slate-700">{draft.country || "No especificado"}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectDraftToEdit(draft);
                          handleRemoveDraft(index);
                          onClose();
                        }}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Cargar en Editor
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

                  {/* Summary Badges */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-600">
                    <div className="rounded-xl border border-slate-200 bg-white p-2">
                      <span className="font-semibold block text-slate-800">Precio / Moneda</span>
                      {draft.price} {draft.currency}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-2">
                      <span className="font-semibold block text-slate-800">Valoración</span>
                      {draft.providerRating} / 5.0 ({draft.providerReviewCount} reseñas)
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-2">
                      <span className="font-semibold block text-slate-800">Bloques Extra</span>
                      {draft.extraDescriptions?.length || 0} bloque(s)
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
