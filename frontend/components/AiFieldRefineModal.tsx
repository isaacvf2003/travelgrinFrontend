"use client";

import React, { useState } from "react";
import { Bot, Sparkles, X, Check, ArrowRight, RefreshCw, Languages, HelpCircle } from "lucide-react";

export type RefineFieldType = "title" | "description" | "provider_info" | "extra_block" | "new_extra_block";

export interface AiFieldRefineModalProps {
  isOpen: boolean;
  onClose: () => void;
  fieldType: RefineFieldType;
  currentValue?: string;
  currentTitleValue?: string;
  blockIndex?: number;
  metadata?: {
    title?: string;
    publisherName?: string;
    category?: string;
    city?: string;
    country?: string;
    url?: string;
  };
  onApply: (data: {
    resultText: string;
    resultTitle?: string;
    translations?: {
      es?: string;
      en?: string;
      pt?: string;
      it?: string;
      titleI18n?: Record<string, string>;
      bodyI18n?: Record<string, string>;
    };
    blockIndex?: number;
  }) => void;
}

const FIELD_LABELS: Record<RefineFieldType, { title: string; subtitle: string; placeholder: string; suggestions: string[] }> = {
  title: {
    title: "Mejorar Título con IA",
    subtitle: "Podés pedirle a la IA que acorte, haga más atractivo o personalice el título oficial.",
    placeholder: "Ej: Hacelo más corto broh, sacale la palabra X, ponele solo el nombre y la ciudad...",
    suggestions: [
      "Hacerlo más corto y directo",
      "Más atractivo y comercial",
      "Solo nombre oficial y ciudad",
      "Enfocar en carreras y postgrados",
      "Enfocar en atención médica y guardia",
    ],
  },
  description: {
    title: "Mejorar Descripción con IA",
    subtitle: "Podés modificar la propuesta de valor, requisitos o diferenciales manteniendo el formato oficial.",
    placeholder: "Ej: Enfocalo en turnos online y postgrados, ponele que la guardia es 24hs, hacelo más formal...",
    suggestions: [
      "Más persuasivo y comercial",
      "Más formal e institucional",
      "Enfocar en modalidades virtuales y becas",
      "Destacar atención de emergencias 24/7",
      "Reducir texto y hacerlo más conciso",
    ],
  },
  provider_info: {
    title: "Mejorar Descripción del Oferente con IA",
    subtitle: "Personalizá la síntesis institucional y trayectoria del oferente.",
    placeholder: "Ej: Ponele que tiene 50 años de experiencia en Mendoza, hacelo más profesional...",
    suggestions: [
      "Destacar años de trayectoria y liderazgo",
      "Enfocar en cobertura regional",
      "Resaltar atención personalizada",
      "Hacerlo en 1 frase concisa",
    ],
  },
  extra_block: {
    title: "Mejorar Bloque Adicional con IA",
    subtitle: "Reescribí o ajustá el contenido de este bloque o Score Scout según lo que necesites.",
    placeholder: "Ej: Agregale los requisitos para extranjeros, ajustá los datos de contacto, hacelo más claro...",
    suggestions: [
      "Añadir requisitos y documentación",
      "Destacar convenios y acreditaciones",
      "Hacerlo en formato de puntos clave",
      "Ajustar evidencia de contacto y ubicación",
    ],
  },
  new_extra_block: {
    title: "Crear Nuevo Bloque con IA",
    subtitle: "Indicá qué sección querés crear y la IA generará el título y contenido correspondiente.",
    placeholder: "Ej: Creame un bloque de Requisitos de Admisión, o uno de Medios de Pago y Financiación...",
    suggestions: [
      "Bloque de Requisitos de Inscripción",
      "Bloque de Formas de Pago y Financiación",
      "Bloque de Especialidades y Servicios",
      "Bloque de Horarios de Atención y Guardia",
    ],
  },
};

export default function AiFieldRefineModal({
  isOpen,
  onClose,
  fieldType,
  currentValue = "",
  currentTitleValue = "",
  blockIndex,
  metadata = {},
  onApply,
}: AiFieldRefineModalProps) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [autoTranslate, setAutoTranslate] = useState(true);
  const [previewResult, setPreviewResult] = useState<any | null>(null);

  if (!isOpen) return null;

  const config = FIELD_LABELS[fieldType] || FIELD_LABELS.description;

  const handleGenerate = async (customPrompt?: string) => {
    const textPrompt = (customPrompt ?? prompt).trim();
    if (!textPrompt) {
      setErrorMsg("Escribí o seleccioná una instrucción para que la IA sepa qué modificar.");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    setPreviewResult(null);

    try {
      const customKey = (typeof window !== "undefined" ? window.localStorage.getItem("tgn_ai_custom_api_key") : null) || undefined;
      const res = await fetch("/api/admin/ai-refine-field", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fieldType,
          currentText: currentValue,
          currentTitle: currentTitleValue || metadata.title,
          prompt: textPrompt,
          publisherName: metadata.publisherName,
          category: metadata.category,
          city: metadata.city,
          country: metadata.country,
          url: metadata.url,
          autoTranslate,
          apiKey: customKey,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "No se pudo generar la mejora.");
      }

      setPreviewResult(data);
    } catch (err: any) {
      setErrorMsg(err?.message || "Error al procesar con IA. Intentá nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmApply = () => {
    if (!previewResult) return;

    let resultText = "";
    let resultTitle = "";

    if (fieldType === "title") {
      resultText = previewResult.result?.title || currentValue;
    } else if (fieldType === "description") {
      resultText = previewResult.result?.description || currentValue;
    } else if (fieldType === "provider_info") {
      resultText = previewResult.result?.providerInfo || currentValue;
    } else if (fieldType === "extra_block" || fieldType === "new_extra_block") {
      resultText = previewResult.result?.body || currentValue;
      resultTitle = previewResult.result?.title || currentTitleValue;
    }

    onApply({
      resultText,
      resultTitle,
      translations: previewResult.translations,
      blockIndex,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Robot Icon */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-slate-900 via-[#1e293b] to-[#0f172a] px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 to-[#00A9C6] text-white shadow-lg shadow-cyan-500/30">
              <Bot className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                {config.title}
                <span className="rounded-md bg-cyan-400/20 px-2 py-0.5 text-[10px] font-semibold text-cyan-300">
                  IA Copilot
                </span>
              </h3>
              <p className="text-xs text-slate-300">{config.subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-xl text-slate-400 hover:bg-white/10 hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Current Text Snippet (if modifying) */}
          {currentValue && fieldType !== "new_extra_block" ? (
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3.5 text-xs text-slate-600">
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Texto actual:
              </div>
              <div
                className="max-h-24 overflow-y-auto line-clamp-3 text-slate-700 select-text"
                dangerouslySetInnerHTML={{ __html: currentValue }}
              />
            </div>
          ) : null}

          {/* Prompt input */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
              <span>¿Cómo querés que lo modifique o cree la IA?</span>
              <span className="text-[11px] font-normal text-slate-400">
                Podés hablarle formal o coloquial
              </span>
            </label>
            <div className="relative">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={config.placeholder}
                rows={3}
                className="w-full rounded-2xl border border-slate-200 p-3.5 text-sm text-slate-800 outline-none transition focus:border-[#00A9C6] focus:ring-4 focus:ring-[#00A9C6]/15"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleGenerate();
                  }
                }}
              />
            </div>
          </div>

          {/* Quick suggestions pills */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-cyan-600" />
              Sugerencias rápidas (hacé clic para usar):
            </div>
            <div className="flex flex-wrap gap-1.5">
              {config.suggestions.map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => {
                    setPrompt(sug);
                    handleGenerate(sug);
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 transition hover:border-[#00A9C6] hover:bg-cyan-50/50 hover:text-[#007D92] active:scale-95"
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>

          {/* Auto-translate Checkbox */}
          <div className="flex items-center gap-2 rounded-xl border border-cyan-100 bg-cyan-50/50 p-3 text-xs text-cyan-950">
            <input
              id="ai-auto-translate-toggle"
              type="checkbox"
              checked={autoTranslate}
              onChange={(e) => setAutoTranslate(e.target.checked)}
              className="h-4 w-4 rounded border-cyan-300 text-[#00A9C6] focus:ring-[#00A9C6]"
            />
            <label htmlFor="ai-auto-translate-toggle" className="cursor-pointer font-medium flex items-center gap-1.5">
              <Languages className="h-3.5 w-3.5 text-cyan-600" />
              Sincronizar y traducir automáticamente a EN, PT e IT al aplicar
            </label>
          </div>

          {/* Error display */}
          {errorMsg ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">
              {errorMsg}
            </div>
          ) : null}

          {/* Live Preview Box */}
          {previewResult ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-2 animate-in fade-in duration-300">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  Propuesta generada por la IA:
                </div>
                <button
                  type="button"
                  onClick={() => handleGenerate()}
                  className="text-[11px] font-semibold text-cyan-700 hover:underline flex items-center gap-1"
                >
                  <RefreshCw className="h-3 w-3" /> Regenerar
                </button>
              </div>

              {previewResult.result?.title && (fieldType === "extra_block" || fieldType === "new_extra_block") ? (
                <div className="text-sm font-bold text-slate-900">
                  {previewResult.result.title}
                </div>
              ) : null}

              <div
                className="max-h-48 overflow-y-auto rounded-xl border border-emerald-200/60 bg-white p-3 text-xs leading-relaxed text-slate-800 select-text"
                dangerouslySetInnerHTML={{
                  __html:
                    previewResult.result?.description ||
                    previewResult.result?.title ||
                    previewResult.result?.providerInfo ||
                    previewResult.result?.body ||
                    JSON.stringify(previewResult.result),
                }}
              />

              {autoTranslate && previewResult.translations?.en ? (
                <div className="text-[11px] text-emerald-700 font-medium">
                  ✓ Traducciones listas para Inglés, Portugués e Italiano.
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
          >
            Cancelar
          </button>

          <div className="flex items-center gap-2">
            {!previewResult ? (
              <button
                type="button"
                disabled={loading || !prompt.trim()}
                onClick={() => handleGenerate()}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-slate-900 to-[#00A9C6] px-5 py-2 text-xs font-bold text-white shadow-lg shadow-cyan-900/20 hover:opacity-95 disabled:opacity-50 transition"
              >
                <Bot className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                {loading ? "Generando con IA..." : "Generar con IA"}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConfirmApply}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-700/20 hover:opacity-95 transition"
              >
                <Check className="h-4 w-4" />
                Aplicar al formulario
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
