"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  Search,
  Eye,
  Sparkles,
  Layers,
  FileText,
  Check,
  ShieldCheck,
  Database,
  ArrowRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

export interface PublicationItem {
  id: string;
  title: string;
  publisherName?: string | null;
  country?: string | null;
  city?: string | null;
  category?: string | null;
  subcategory?: string | null;
  fields?: any;
}

interface BulkBlockUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  publications: PublicationItem[];
  onPublicationsUpdated?: () => void | Promise<void>;
  initialSelectedBlock?: string;
  initialSelectedPublicationId?: string;
}

interface PreviewResultItem {
  publicationId: string;
  publicationTitle: string;
  publisherName?: string;
  country?: string;
  originalBody?: string;
  updatedBodyHtml?: string;
  blockTitle: string;
  evidencias?: string[];
  providerUsed?: string;
  success: boolean;
  error?: string;
  selectedForSave: boolean;
}

export default function BulkBlockUpdateModal({
  isOpen,
  onClose,
  publications,
  onPublicationsUpdated,
  initialSelectedBlock = "",
  initialSelectedPublicationId,
}: BulkBlockUpdateModalProps) {
  // --- STATE ---
  const [targetBlockTitle, setTargetBlockTitle] = useState(initialSelectedBlock);
  const [selectedPubIds, setSelectedPubIds] = useState<Set<string>>(new Set());
  const [searchFilter, setSearchFilter] = useState("");
  const [onlyWithBlock, setOnlyWithBlock] = useState(true);
  const [updatePrompt, setUpdatePrompt] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [customDocumentText, setCustomDocumentText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState<"configure" | "preview" | "complete">("configure");
  const [previewResults, setPreviewResults] = useState<PreviewResultItem[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [saveSuccessMsg, setSaveSuccessMsg] = useState("");
  const [expandedPreviewIds, setExpandedPreviewIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"file" | "text">("file");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync initial props
  useEffect(() => {
    if (isOpen) {
      if (initialSelectedBlock) {
        setTargetBlockTitle(initialSelectedBlock);
      }
      if (initialSelectedPublicationId) {
        setSelectedPubIds(new Set([initialSelectedPublicationId]));
        setOnlyWithBlock(false);
      }
    }
  }, [isOpen, initialSelectedBlock, initialSelectedPublicationId]);

  // Extract all distinct extraDescription titles existing across publications
  const existingBlocksCatalog = useMemo(() => {
    const map = new Map<string, number>();
    for (const pub of publications) {
      const extraDesc = Array.isArray(pub?.fields?.extraDescriptions) ? pub.fields.extraDescriptions : [];
      for (const d of extraDesc) {
        const title = String(d?.title || "").trim();
        if (title) {
          map.set(title, (map.get(title) || 0) + 1);
        }
      }
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [publications]);

  // Helper to check if a publication has the target block
  const pubHasTargetBlock = (pub: PublicationItem, blockName: string): boolean => {
    if (!blockName) return false;
    const extraDesc = Array.isArray(pub?.fields?.extraDescriptions) ? pub.fields.extraDescriptions : [];
    return extraDesc.some((d: any) => String(d?.title || "").trim().toLowerCase() === blockName.trim().toLowerCase());
  };

  // Helper to get current block text
  const getPubCurrentBlockBody = (pub: PublicationItem, blockName: string): string => {
    if (!blockName) return "";
    const extraDesc = Array.isArray(pub?.fields?.extraDescriptions) ? pub.fields.extraDescriptions : [];
    const found = extraDesc.find((d: any) => String(d?.title || "").trim().toLowerCase() === blockName.trim().toLowerCase());
    return found?.body || "";
  };

  // Filtered publications according to selected block, search query, and toggle
  const filteredPublications = useMemo(() => {
    const q = searchFilter.toLowerCase().trim();
    return publications.filter((pub) => {
      if (onlyWithBlock && targetBlockTitle) {
        if (!pubHasTargetBlock(pub, targetBlockTitle)) return false;
      }
      if (!q) return true;
      const titleMatch = (pub.title || "").toLowerCase().includes(q);
      const pubNameMatch = (pub.publisherName || "").toLowerCase().includes(q);
      const countryMatch = (pub.country || "").toLowerCase().includes(q);
      const catMatch = (pub.category || "").toLowerCase().includes(q);
      return titleMatch || pubNameMatch || countryMatch || catMatch;
    });
  }, [publications, targetBlockTitle, onlyWithBlock, searchFilter]);

  // Select all / Deselect all
  const handleToggleSelectAll = () => {
    if (selectedPubIds.size === filteredPublications.length && filteredPublications.length > 0) {
      setSelectedPubIds(new Set());
    } else {
      setSelectedPubIds(new Set(filteredPublications.map((p) => p.id)));
    }
  };

  const handleTogglePub = (id: string) => {
    const next = new Set(selectedPubIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedPubIds(next);
  };

  // Handle file select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      setErrorMsg("");
    }
  };

  // Handle Drag & Drop
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setUploadedFile(file);
      setErrorMsg("");
    }
  };

  // Trigger preview generation
  const handleGeneratePreviews = async () => {
    setErrorMsg("");
    if (!targetBlockTitle.trim()) {
      setErrorMsg("Debes especificar el título del bloque que deseas actualizar.");
      return;
    }
    if (selectedPubIds.size === 0) {
      setErrorMsg("Debes seleccionar al menos una publicación para actualizar.");
      return;
    }
    if (!uploadedFile && !customDocumentText.trim() && !updatePrompt.trim()) {
      setErrorMsg("Debes subir un archivo Excel/CSV/Documento o ingresar texto/instrucciones de actualización.");
      return;
    }

    setIsProcessing(true);

    try {
      const formData = new FormData();
      formData.append("targetBlockTitle", targetBlockTitle.trim());
      formData.append("updatePrompt", updatePrompt.trim());
      formData.append("action", "preview");
      formData.append("publicationIds", JSON.stringify(Array.from(selectedPubIds)));

      if (uploadedFile) {
        formData.append("file", uploadedFile);
      } else if (customDocumentText.trim()) {
        formData.append("documentText", customDocumentText.trim());
      }

      const res = await fetch("/api/admin/document-block-update", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Error al procesar la actualización con el agente IA.");
      }

      const initialPreviews: PreviewResultItem[] = (data.results || []).map((r: any) => ({
        ...r,
        selectedForSave: r.success,
      }));

      setPreviewResults(initialPreviews);
      setCurrentStep("preview");
    } catch (err: any) {
      setErrorMsg(err.message || "Ocurrió un error inesperado al procesar con el agente.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Toggle selection for saving a preview
  const handleTogglePreviewSelect = (pubId: string) => {
    setPreviewResults((prev) =>
      prev.map((item) =>
        item.publicationId === pubId ? { ...item, selectedForSave: !item.selectedForSave } : item
      )
    );
  };

  const handleToggleAllPreviews = (selected: boolean) => {
    setPreviewResults((prev) =>
      prev.map((item) => (item.success ? { ...item, selectedForSave: selected } : item))
    );
  };

  // Apply approved previews to database
  const handleSaveApprovedChanges = async () => {
    const toSave = previewResults.filter((p) => p.selectedForSave && p.success && p.updatedBodyHtml);
    if (toSave.length === 0) {
      setErrorMsg("No hay publicaciones seleccionadas para guardar.");
      return;
    }

    setIsSaving(true);
    setErrorMsg("");

    try {
      const payload = {
        action: "save-approved",
        approvedUpdates: toSave.map((p) => ({
          publicationId: p.publicationId,
          blockTitle: p.blockTitle,
          updatedBodyHtml: p.updatedBodyHtml,
        })),
      };

      const res = await fetch("/api/admin/document-block-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Error al guardar los cambios en la base de datos.");
      }

      setSaveSuccessMsg(`¡Éxito! Se actualizaron correctamente ${data.succeeded} publicaciones en Travelgrin.`);
      setCurrentStep("complete");
      if (onPublicationsUpdated) {
        await onPublicationsUpdated();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Error al aplicar los cambios.");
    } finally {
      setIsSaving(false);
    }
  };

  // Reset modal state
  const handleReset = () => {
    setCurrentStep("configure");
    setPreviewResults([]);
    setErrorMsg("");
    setSaveSuccessMsg("");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-5xl rounded-3xl bg-white shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-emerald-50/70 via-teal-50/50 to-white px-6 py-4.5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-600/20">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">
                  Actualizador de Bloques con Excel / Documentos
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  Agente Oficial Grounded
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Sube resoluciones, leyes o tablas Excel para actualizar bloques descriptivos sin plantillas ni alucinaciones.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Step Breadcrumbs */}
        <div className="flex items-center border-b border-slate-100 bg-slate-50/60 px-6 py-2.5 text-xs text-slate-600">
          <button
            type="button"
            onClick={() => setCurrentStep("configure")}
            className={`flex items-center gap-1.5 font-semibold ${
              currentStep === "configure" ? "text-emerald-700" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[10px] text-white">
              1
            </span>
            Configuración y Selección
          </button>
          <ArrowRight className="mx-3 h-3.5 w-3.5 text-slate-300" />
          <span
            className={`flex items-center gap-1.5 font-semibold ${
              currentStep === "preview" ? "text-emerald-700" : "text-slate-400"
            }`}
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                currentStep === "preview"
                  ? "bg-emerald-600 text-white"
                  : currentStep === "complete"
                  ? "bg-emerald-200 text-emerald-800"
                  : "bg-slate-200 text-slate-500"
              }`}
            >
              2
            </span>
            Previsualización & Aprobación IA
          </span>
          <ArrowRight className="mx-3 h-3.5 w-3.5 text-slate-300" />
          <span
            className={`flex items-center gap-1.5 font-semibold ${
              currentStep === "complete" ? "text-emerald-700" : "text-slate-400"
            }`}
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                currentStep === "complete" ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-500"
              }`}
            >
              3
            </span>
            Confirmado y Aplicado
          </span>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg ? (
            <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-800">
              <AlertCircle className="h-5 w-5 flex-shrink-0 text-rose-600 mt-0.5" />
              <div className="flex-1 font-medium">{errorMsg}</div>
            </div>
          ) : null}

          {/* STEP 1: CONFIGURE */}
          {currentStep === "configure" && (
            <div className="space-y-6">
              {/* Bloque Objetivo */}
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/40 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Layers className="h-4 w-4 text-emerald-600" />
                    Paso 1: ¿Qué bloque descriptivo deseas actualizar?
                  </label>
                  <span className="text-xs text-slate-500">Selecciona uno existente o escribe uno nuevo</span>
                </div>

                {existingBlocksCatalog.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {existingBlocksCatalog.map(([title, count]) => {
                      const isSelected = targetBlockTitle.trim().toLowerCase() === title.trim().toLowerCase();
                      return (
                        <button
                          key={title}
                          type="button"
                          onClick={() => setTargetBlockTitle(title)}
                          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                            isSelected
                              ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/20"
                              : "bg-white border border-slate-200 text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/50"
                          }`}
                        >
                          {title}
                          <span
                            className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                              isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="relative mt-2">
                  <input
                    type="text"
                    value={targetBlockTitle}
                    onChange={(e) => setTargetBlockTitle(e.target.value)}
                    placeholder="Ej: Requisitos Migratorios, Visas de Residencia, Información Práctica..."
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                </div>
              </div>

              {/* Paso 2: Selección de Publicaciones */}
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/40 p-5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <label className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Database className="h-4 w-4 text-emerald-600" />
                    Paso 2: Seleccionar publicaciones a las que se aplicará
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={onlyWithBlock}
                        onChange={(e) => setOnlyWithBlock(e.target.checked)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      Mostrar solo con el bloque existente
                    </label>
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 underline underline-offset-2"
                    >
                      {selectedPubIds.size === filteredPublications.length && filteredPublications.length > 0
                        ? "Deseleccionar todas"
                        : `Seleccionar todas (${filteredPublications.length})`}
                    </button>
                  </div>
                </div>

                {/* Buscador */}
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Filtrar publicaciones por título, oferente o país..."
                    className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 py-2 text-xs text-slate-800 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                </div>

                {/* Tabla/Lista de Publicaciones */}
                <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 shadow-inner">
                  {filteredPublications.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400">
                      No se encontraron publicaciones que coincidan con el criterio seleccionado.
                    </div>
                  ) : (
                    filteredPublications.map((pub) => {
                      const isSelected = selectedPubIds.has(pub.id);
                      const hasBlock = pubHasTargetBlock(pub, targetBlockTitle);
                      const currentBody = getPubCurrentBlockBody(pub, targetBlockTitle);

                      return (
                        <div
                          key={pub.id}
                          onClick={() => handleTogglePub(pub.id)}
                          className={`flex items-center justify-between p-3 text-xs transition cursor-pointer hover:bg-slate-50 ${
                            isSelected ? "bg-emerald-50/50" : ""
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}} // handled by parent div
                              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                            />
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900 truncate">
                                {pub.title}
                              </div>
                              <div className="text-[11px] text-slate-500 truncate flex items-center gap-1.5 mt-0.5">
                                {pub.publisherName ? <span>{pub.publisherName}</span> : null}
                                {pub.country ? (
                                  <>
                                    <span>•</span>
                                    <span className="font-medium text-slate-700">{pub.country}</span>
                                  </>
                                ) : null}
                                {pub.category ? (
                                  <>
                                    <span>•</span>
                                    <span className="text-slate-400">{pub.category}</span>
                                  </>
                                ) : null}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                            {hasBlock ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                                <Check className="h-3 w-3" />
                                Contiene bloque
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                                Sin este bloque
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                  <span>
                    Seleccionadas: <strong className="text-emerald-700 font-bold">{selectedPubIds.size}</strong> de{" "}
                    {filteredPublications.length}
                  </span>
                </div>
              </div>

              {/* Paso 3: Documento Oficial o Prompt */}
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/40 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-emerald-600" />
                    Paso 3: Fuente de Información Oficial (Excel, CSV o Documento)
                  </label>
                  <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setActiveTab("file")}
                      className={`px-3 py-1 rounded-md font-medium transition ${
                        activeTab === "file" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Subir Archivo (.xlsx / .csv / .pdf)
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("text")}
                      className={`px-3 py-1 rounded-md font-medium transition ${
                        activeTab === "text" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Pegar Texto Oficial
                    </button>
                  </div>
                </div>

                {activeTab === "file" ? (
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv,.txt,.md,.json,.pdf"
                      onChange={handleFileChange}
                      className="hidden"
                    />

                    {uploadedFile ? (
                      <div className="flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50/60 p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white">
                            <FileSpreadsheet className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-emerald-950">{uploadedFile.name}</div>
                            <div className="text-xs text-emerald-700">
                              {(uploadedFile.size / 1024).toFixed(1)} KB • Documento cargado listo para procesar
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setUploadedFile(null);
                            if (fileInputRef.current) fileInputRef.current.value = "";
                          }}
                          className="rounded-lg border border-emerald-300 bg-white px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                        >
                          Cambiar archivo
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleDrop}
                        className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white p-6 transition cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/20"
                      >
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 mb-3">
                          <Upload className="h-6 w-6" />
                        </div>
                        <div className="text-sm font-semibold text-slate-800">
                          Haz clic para subir o arrastra tu archivo Excel / Documento aquí
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          Compatible con Excel (.xlsx, .xls), CSV, TXT, JSON o documentos oficiales
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <textarea
                      rows={5}
                      value={customDocumentText}
                      onChange={(e) => setCustomDocumentText(e.target.value)}
                      placeholder="Pega aquí extractos de normativas, tablas de requisitos, leyes migratorias o datos oficiales..."
                      className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                    />
                  </div>
                )}

                {/* Prompt Adicional */}
                <div>
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                    Instrucciones específicas para el Agente IA (Opcional):
                  </label>
                  <input
                    type="text"
                    value={updatePrompt}
                    onChange={(e) => setUpdatePrompt(e.target.value)}
                    placeholder="Ej: Priorizar visados de trabajo y nómadas digitales, incluir costos en USD y tiempos estimados oficiales..."
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    El agente contextualizará automáticamente los datos oficiales según el país y la naturaleza de cada publicación seleccionada.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: PREVIEW & GRANULAR APPROVAL */}
          {currentStep === "preview" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-emerald-50/80 border border-emerald-200 rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white">
                    <Eye className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-emerald-950">
                      Revisión de Cambios Generados por la IA
                    </h3>
                    <p className="text-xs text-emerald-800">
                      Verifica el contenido antes de guardarlo en Travelgrin. Puedes desmarcar cualquiera que no desees aplicar.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleAllPreviews(true)}
                    className="rounded-lg bg-white border border-emerald-300 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                  >
                    Aprobar todas
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleAllPreviews(false)}
                    className="rounded-lg bg-white border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Desmarcar todas
                  </button>
                </div>
              </div>

              {/* Lista de Previews */}
              <div className="space-y-4">
                {previewResults.map((item) => {
                  const isExpanded = expandedPreviewIds.has(item.publicationId);
                  return (
                    <div
                      key={item.publicationId}
                      className={`rounded-2xl border transition overflow-hidden ${
                        item.selectedForSave && item.success
                          ? "border-emerald-300 bg-white shadow-sm"
                          : !item.success
                          ? "border-rose-200 bg-rose-50/30"
                          : "border-slate-200 bg-slate-50/40 opacity-70"
                      }`}
                    >
                      {/* Header de la Publicación */}
                      <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            disabled={!item.success}
                            checked={item.selectedForSave && item.success}
                            onChange={() => handleTogglePreviewSelect(item.publicationId)}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                          />
                          <div>
                            <div className="font-bold text-sm text-slate-900">{item.publicationTitle}</div>
                            <div className="text-xs text-slate-500 flex items-center gap-2">
                              {item.publisherName && <span>{item.publisherName}</span>}
                              {item.country && (
                                <>
                                  <span>•</span>
                                  <span className="font-semibold text-slate-700">{item.country}</span>
                                </>
                              )}
                              <span>•</span>
                              <span className="font-medium text-emerald-700">Bloque: {item.blockTitle}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {item.success ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                              Listo para aplicar
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-800">
                              <AlertCircle className="h-3.5 w-3.5 text-rose-600" />
                              Error al procesar
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              const next = new Set(expandedPreviewIds);
                              if (next.has(item.publicationId)) {
                                next.delete(item.publicationId);
                              } else {
                                next.add(item.publicationId);
                              }
                              setExpandedPreviewIds(next);
                            }}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Cuerpo de Contenido */}
                      <div className="p-4 space-y-3">
                        {item.success && item.updatedBodyHtml ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Original */}
                            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                                Bloque Original
                              </div>
                              {item.originalBody ? (
                                <div
                                  className="text-xs text-slate-700 max-h-48 overflow-y-auto prose prose-xs"
                                  dangerouslySetInnerHTML={{ __html: item.originalBody }}
                                />
                              ) : (
                                <div className="text-xs italic text-slate-400">
                                  (Esta publicación no tenía este bloque previamente; se creará como nuevo).
                                </div>
                              )}
                            </div>

                            {/* Nuevo Generado */}
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-3">
                              <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 mb-2 flex items-center justify-between">
                                <span>Actualizado con Documento Oficial</span>
                                <span className="font-normal text-[10px] text-emerald-600 lowercase">
                                  {item.providerUsed || "IA Grounded"}
                                </span>
                              </div>
                              <div
                                className="text-xs text-slate-900 max-h-48 overflow-y-auto prose prose-xs"
                                dangerouslySetInnerHTML={{ __html: item.updatedBodyHtml }}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="p-3 text-xs text-rose-700 bg-rose-50 rounded-xl">
                            {item.error || "No se pudo generar el contenido para esta publicación."}
                          </div>
                        )}

                        {/* Evidencias del Documento Oficial */}
                        {item.evidencias && item.evidencias.length > 0 && isExpanded && (
                          <div className="pt-2 border-t border-slate-100">
                            <div className="text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1.5">
                              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                              Evidencias oficiales encontradas en el documento:
                            </div>
                            <ul className="list-disc pl-5 text-[11px] text-slate-600 space-y-0.5">
                              {item.evidencias.map((ev, i) => (
                                <li key={i}>{ev}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3: COMPLETED */}
          {currentStep === "complete" && (
            <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">¡Actualización Exitosa!</h3>
              <p className="text-sm text-slate-600 max-w-md">{saveSuccessMsg}</p>
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Actualizar otro bloque
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/80 px-6 py-4">
          <div>
            {currentStep === "preview" && (
              <button
                type="button"
                onClick={() => setCurrentStep("configure")}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                ← Volver a Configurar
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing || isSaving}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancelar
            </button>

            {currentStep === "configure" && (
              <button
                type="button"
                onClick={handleGeneratePreviews}
                disabled={isProcessing || selectedPubIds.size === 0 || (!uploadedFile && !customDocumentText.trim() && !updatePrompt.trim())}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700 disabled:opacity-50 transition"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Procesando con IA ({selectedPubIds.size} pubs)...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generar Previsualizaciones ({selectedPubIds.size})
                  </>
                )}
              </button>
            )}

            {currentStep === "preview" && (
              <button
                type="button"
                onClick={handleSaveApprovedChanges}
                disabled={isSaving || previewResults.filter((p) => p.selectedForSave && p.success).length === 0}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2 text-sm font-semibold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700 disabled:opacity-50 transition"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Guardando en Base de Datos...
                  </>
                ) : (
                  <>
                    <Database className="h-4 w-4" />
                    Aplicar Cambios Aprobados ({previewResults.filter((p) => p.selectedForSave && p.success).length})
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
