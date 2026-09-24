"use client";

import React, { useEffect, useState } from "react";
import { Bot, Sparkles, X, Check, RefreshCw, Languages, Key, SendHorizontal, MessageSquarePlus, ChevronRight } from "lucide-react";

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
    title: "Asistente IA para Título",
    subtitle: "Podés darle una web o nombre del local para investigar, o pedirle que sea más corto, invitacional o llamativo.",
    placeholder: "Ej: https://misitio.com o Parrilla Don Julio, hacelo llamativo, o 'Vení a la mejor opción...', más corto...",
    suggestions: [
      "¡Vení a la mejor universidad / opción destacada!",
      "¡Contratá la mejor obra social / servicio!",
      "Hacerlo más trabajado que impacte y llame la atención",
      "Hacerlo más corto y directo",
      "Más atractivo y comercial",
      "Enfocar en carreras y postgrados",
      "Solo nombre oficial y ciudad",
    ],
  },
  description: {
    title: "Asistente IA para Descripción",
    subtitle: "Podés pasarle una web o nombre de local para que investigue, o pedirle redactar con iconos, beneficios y persuasión.",
    placeholder: "Ej: https://misitio.com haceme una propuesta atractiva, o 'Gimnasio SportClub en Belgrano', sacale precios, agregale iconos...",
    suggestions: [
      "Crear descripción atractiva y persuasiva con iconos",
      "Más trabajado y persuasivo",
      "Hacerlo más formal e institucional",
      "Hacerlo más corto y conciso con puntos clave",
      "Enfocar en modalidades virtuales y becas",
      "Destacar atención de emergencias 24/7",
      "Quitar precios y poner que es gratuito",
    ],
  },
  provider_info: {
    title: "Asistente IA para Descripción del Oferente",
    subtitle: "Explicále a la IA cómo querés resumir la trayectoria, liderazgo y rol institucional del oferente.",
    placeholder: "Ej: Ponele que tiene 50 años de experiencia en Mendoza, hacelo más profesional y confiable...",
    suggestions: [
      "Destacar años de trayectoria y liderazgo",
      "Enfocar en cobertura regional",
      "Resaltar atención personalizada",
      "Hacerlo en 1 frase concisa",
    ],
  },
  extra_block: {
    title: "Asistente IA para Bloque / Score Scout",
    subtitle: "Pedile a la IA que modifique el contenido de este bloque o ajuste el puntaje y auditoría del Score Scout.",
    placeholder: "Ej: Ajustá el Score Scout a 95 porque verificamos el CUIT y WhatsApp, o agregale requisitos y horarios...",
    suggestions: [
      "Ajustar Score Scout a 95/100 y validar contacto",
      "Añadir requisitos y documentación",
      "Destacar convenios y acreditaciones oficiales",
      "Añadir horarios y canales de atención",
    ],
  },
  new_extra_block: {
    title: "Asistente IA para Crear Nuevo Bloque",
    subtitle: "Explicále qué sección o bloque querés crear y la IA generará el título y contenido enriquecido.",
    placeholder: "Ej: Creame un bloque de Preguntas Frecuentes (FAQ), o uno de Medios de Pago y Financiación en cuotas...",
    suggestions: [
      "Bloque de Requisitos de Inscripción",
      "Bloque de Formas de Pago y Financiación",
      "Bloque de Preguntas Frecuentes (FAQ)",
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
  const [customKey, setCustomKey] = useState("");
  const [showKeyConfig, setShowKeyConfig] = useState(false);
  const [followUpPrompt, setFollowUpPrompt] = useState("");
  const [conversationHistory, setConversationHistory] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [variationCount, setVariationCount] = useState(0);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem("tgn_ai_custom_api_key") || "";
      setCustomKey(saved);
    }
  }, [isOpen]);

  // Reset all state when modal opens or when target field changes so each field is 100% isolated
  useEffect(() => {
    if (isOpen) {
      setPrompt("");
      setPreviewResult(null);
      setErrorMsg("");
      setConversationHistory([]);
      setVariationCount(0);
      setFollowUpPrompt("");
    }
  }, [isOpen, fieldType, blockIndex]);

  const handleSaveKey = (val: string) => {
    setCustomKey(val);
    if (typeof window !== "undefined") {
      if (val.trim()) {
        window.localStorage.setItem("tgn_ai_custom_api_key", val.trim());
      } else {
        window.localStorage.removeItem("tgn_ai_custom_api_key");
      }
    }
  };

  if (!isOpen) return null;

  const config = FIELD_LABELS[fieldType] || FIELD_LABELS.description;

  const handleGenerate = async (customInstruction?: string, isRefinement = false, isRegenerate = false) => {
    const nextVariationIndex = variationCount + 1;
    const textPrompt = (
      customInstruction ??
      (isRefinement ? followUpPrompt : isRegenerate ? (prompt || "Generá otra propuesta alternativa diferente") : prompt)
    ).trim();

    if (!textPrompt) {
      setErrorMsg("Escribí o seleccioná una instrucción para que la IA sepa qué hacer.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    // If refining existing preview, send the previewed content as base
    let baseText = currentValue;
    let baseTitle = currentTitleValue;

    if (isRefinement && previewResult) {
      if (fieldType === "title") baseText = previewResult.result?.title || currentValue;
      else if (fieldType === "description") baseText = previewResult.result?.description || currentValue;
      else if (fieldType === "provider_info") baseText = previewResult.result?.providerInfo || currentValue;
      else if (fieldType === "extra_block" || fieldType === "new_extra_block") {
        baseText = previewResult.result?.body || currentValue;
        baseTitle = previewResult.result?.title || currentTitleValue;
      }
    }

    const updatedHistory = [...conversationHistory];
    if (textPrompt) {
      updatedHistory.push({ role: "user", content: textPrompt });
    }

    try {
      const activeKey = customKey.trim() || (typeof window !== "undefined" ? window.localStorage.getItem("tgn_ai_custom_api_key") || "" : "");
      const res = await fetch("/api/admin/ai-refine-field", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fieldType,
          currentText: baseText,
          currentTitle: baseTitle || metadata.title,
          prompt: textPrompt,
          publisherName: metadata.publisherName,
          category: metadata.category,
          city: metadata.city,
          country: metadata.country,
          url: metadata.url,
          autoTranslate,
          apiKey: activeKey || undefined,
          conversationHistory: updatedHistory,
          variationIndex: nextVariationIndex,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "No se pudo procesar la solicitud con IA.");
      }

      setPreviewResult(data);
      setVariationCount(nextVariationIndex);

      const assistantOutputText =
        data.result?.title ||
        data.result?.description ||
        data.result?.providerInfo ||
        data.result?.body ||
        "";

      if (assistantOutputText) {
        updatedHistory.push({ role: "assistant", content: assistantOutputText });
      }
      setConversationHistory(updatedHistory);

      if (isRefinement) {
        setFollowUpPrompt("");
      }
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
      resultText = previewResult.result?.body || previewResult.result?.description || currentValue;
      resultTitle = previewResult.result?.title || currentTitleValue || "Información adicional";
    }

    // Persist new block schema in localStorage so future AI Scraping will automatically extract and populate it
    if (fieldType === "new_extra_block" && typeof window !== "undefined") {
      try {
        const savedRaw = window.localStorage.getItem("tgn_custom_scraper_blocks");
        const list: Array<{ title: string; prompt?: string }> = savedRaw ? JSON.parse(savedRaw) : [];
        const finalTitle = resultTitle || previewResult.result?.title || "Información adicional";
        const exists = list.some((b) => b.title?.toLowerCase() === finalTitle.toLowerCase());
        if (!exists && finalTitle) {
          list.push({ title: finalTitle, prompt: prompt.trim() || finalTitle });
          window.localStorage.setItem("tgn_custom_scraper_blocks", JSON.stringify(list));
        }
      } catch {}
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
                  Asistente Virtual
                </span>
                {customKey ? (
                  <span className="rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-300">
                    ⚡ Key Activa
                  </span>
                ) : null}
              </h3>
              <p className="text-xs text-slate-300">{config.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowKeyConfig((prev) => !prev)}
              title="Configurar clave propia de Gemini o OpenAI"
              className={`p-1.5 rounded-lg text-xs transition ${
                showKeyConfig ? "bg-cyan-500 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Key className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-xl text-slate-400 hover:bg-white/10 hover:text-white transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Optional Key Config Dropdown */}
        {showKeyConfig && (
          <div className="bg-slate-900 border-b border-slate-800 p-4 text-xs text-white space-y-2 animate-in slide-in-from-top duration-200">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-cyan-300 flex items-center gap-1.5">
                <Key className="h-3.5 w-3.5" /> Clave de API propia (Google Gemini o OpenAI):
              </span>
              {customKey && (
                <button
                  type="button"
                  onClick={() => handleSaveKey("")}
                  className="text-rose-400 hover:underline text-[11px]"
                >
                  Borrar clave
                </button>
              )}
            </div>
            <input
              type="password"
              value={customKey}
              onChange={(e) => handleSaveKey(e.target.value)}
              placeholder="Pega tu clave AIza... (Gemini) o sk-... (OpenAI)"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-400"
            />
            <p className="text-[11px] text-slate-400 leading-normal">
              Se guarda localmente en tu navegador. Si no ingresás ninguna clave, el sistema utiliza el motor de IA configurado en el servidor.
            </p>
          </div>
        )}

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
              <span>¿Qué le querés pedir a tu asistente?</span>
              <span className="text-[11px] font-normal text-slate-400">
                Explicálo libremente como en ChatGPT o Gemini
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
              Sugerencias rápidas (hacé clic para pedirle a la IA):
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

          {/* Live Preview & Interactive Conversation Box */}
          {previewResult ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3 animate-in fade-in duration-300">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  Propuesta generada por tu Asistente IA:
                </div>
                <button
                  type="button"
                  onClick={() => handleGenerate(undefined, false, true)}
                  className="text-[11px] font-semibold text-cyan-700 hover:underline flex items-center gap-1"
                >
                  <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Regenerar
                </button>
              </div>

              {(fieldType === "extra_block" || fieldType === "new_extra_block") ? (
                <div className="space-y-2">
                  <div className="rounded-xl border border-emerald-300/80 bg-white p-3 shadow-sm space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                        Título del bloque:
                      </div>
                      <span className="text-[10px] text-slate-400">Podés editarlo directamente o pedirle a la IA que lo ajuste</span>
                    </div>
                    <input
                      type="text"
                      value={previewResult.result?.title || ""}
                      onChange={(e) =>
                        setPreviewResult((prev: any) => ({
                          ...prev,
                          result: { ...(prev?.result || {}), title: e.target.value },
                        }))
                      }
                      placeholder="Ej: Requisitos de Admisión / Medios de Pago / Preguntas Frecuentes..."
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 transition"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                      Contenido / Descripción del bloque:
                    </div>
                    <div
                      className="max-h-48 overflow-y-auto rounded-xl border border-emerald-200/60 bg-white p-3.5 text-xs leading-relaxed text-slate-800 select-text font-normal shadow-inner"
                      dangerouslySetInnerHTML={{
                        __html:
                          previewResult.result?.body ||
                          previewResult.result?.description ||
                          JSON.stringify(previewResult.result),
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div
                  className="max-h-48 overflow-y-auto rounded-xl border border-emerald-200/60 bg-white p-3.5 text-xs leading-relaxed text-slate-800 select-text font-normal shadow-inner"
                  dangerouslySetInnerHTML={{
                    __html:
                      previewResult.result?.description ||
                      previewResult.result?.title ||
                      previewResult.result?.providerInfo ||
                      previewResult.result?.body ||
                      JSON.stringify(previewResult.result),
                  }}
                />
              )}

              {/* Follow-up adjustment chat input */}
              <div className="border-t border-emerald-200/60 pt-2.5 space-y-1.5">
                <label className="text-[11px] font-semibold text-emerald-900 flex items-center gap-1">
                  <MessageSquarePlus className="h-3 w-3 text-emerald-700" />
                  ¿Querés hacerle otro ajuste a esta propuesta? (opcional)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={followUpPrompt}
                    onChange={(e) => setFollowUpPrompt(e.target.value)}
                    disabled={loading}
                    placeholder={
                      fieldType === "new_extra_block" || fieldType === "extra_block"
                        ? "Ej: Cambia el título a Requisitos, o agrega más opciones de pago y horarios..."
                        : "Ej: Ahora hacelo más largo y persuasivo, o agregale que hay 20% de descuento..."
                    }
                    className="flex-1 rounded-xl border border-emerald-300 bg-white px-3 py-1.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !loading && followUpPrompt.trim()) {
                        e.preventDefault();
                        handleGenerate(undefined, true);
                      }
                    }}
                  />
                  <button
                    type="button"
                    disabled={loading || !followUpPrompt.trim()}
                    onClick={() => handleGenerate(undefined, true)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition shadow-sm"
                  >
                    {loading ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <SendHorizontal className="h-3.5 w-3.5" />
                    )}
                    {loading ? "Ajustando..." : "Ajustar"}
                  </button>
                </div>
              </div>

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
                {loading ? "El Asistente está escribiendo..." : "Generar con Asistente IA"}
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
