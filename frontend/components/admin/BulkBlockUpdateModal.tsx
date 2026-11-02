"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import {
  FileText,
  Upload,
  Check,
  AlertCircle,
  RefreshCw,
  X,
  Search,
  Eye,
  FileSpreadsheet,
  CheckCircle2,
  PenTool,
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
  filterOptions?: any[];
  [key: string]: any;
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

  // Mode: "file" (Excel/Doc) or "prompt" (Instructions only)
  const [sourceMode, setSourceMode] = useState<"file" | "prompt">("prompt");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [updatePrompt, setUpdatePrompt] = useState("");

  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState({ current: 0, total: 0 });
  const [currentStep, setCurrentStep] = useState<"configure" | "preview" | "complete">("configure");
  const [previewResults, setPreviewResults] = useState<PreviewResultItem[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [saveSuccessMsg, setSaveSuccessMsg] = useState("");
  const [expandedPreviewIds, setExpandedPreviewIds] = useState<Set<string>>(new Set());

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

  // Extract distinct extraDescription titles existing across publications
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

  const pubHasTargetBlock = (pub: PublicationItem, blockName: string): boolean => {
    if (!blockName) return false;
    const extraDesc = Array.isArray(pub?.fields?.extraDescriptions) ? pub.fields.extraDescriptions : [];
    return extraDesc.some((d: any) => String(d?.title || "").trim().toLowerCase() === blockName.trim().toLowerCase());
  };

  const getPubCurrentBlockBody = (pub: PublicationItem, blockName: string): string => {
    if (!blockName) return "";
    const extraDesc = Array.isArray(pub?.fields?.extraDescriptions) ? pub.fields.extraDescriptions : [];
    const found = extraDesc.find((d: any) => String(d?.title || "").trim().toLowerCase() === blockName.trim().toLowerCase());
    return found?.body || "";
  };

  // Filtered publications
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      setErrorMsg("");
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setUploadedFile(file);
      setErrorMsg("");
    }
  };

  // GENERATE PREVIEWS
  const handleGeneratePreviews = async () => {
    setErrorMsg("");
    if (!targetBlockTitle.trim()) {
      setErrorMsg("Por favor, selecciona o escribe el título del bloque que deseas actualizar.");
      return;
    }
    if (selectedPubIds.size === 0) {
      setErrorMsg("Debes seleccionar al menos una publicación para aplicar la actualización.");
      return;
    }
    if (sourceMode === "file" && !uploadedFile && !updatePrompt.trim()) {
      setErrorMsg("Debes subir un archivo Excel/documento o agregar instrucciones de actualización.");
      return;
    }
    if (sourceMode === "prompt" && !updatePrompt.trim()) {
      setErrorMsg("Escribe las instrucciones de redacción para actualizar este bloque.");
      return;
    }

    setIsProcessing(true);

    try {
      // Build selected publication context payloads directly from memory
      // This completely avoids any SQLite / prisma server queries
      const targetPubs = publications
        .filter((p) => selectedPubIds.has(p.id))
        .map((p) => ({
          id: p.id,
          title: p.title || "",
          publisherName: p.publisherName || "",
          country: p.country || "",
          city: p.city || "",
          category: p.category || "",
          subcategory: p.subcategory || "",
          currentBody: getPubCurrentBlockBody(p, targetBlockTitle),
        }));

      let res: Response;

      if (sourceMode === "file" && uploadedFile) {
        const formData = new FormData();
        formData.append("targetBlockTitle", targetBlockTitle.trim());
        formData.append("updatePrompt", updatePrompt.trim());
        formData.append("file", uploadedFile);
        formData.append("publications", JSON.stringify(targetPubs));

        res = await fetch("/api/admin/document-block-update", {
          method: "POST",
          body: formData,
        });
      } else {
        const payload = {
          targetBlockTitle: targetBlockTitle.trim(),
          updatePrompt: updatePrompt.trim(),
          documentText: "",
          publications: targetPubs,
        };

        res = await fetch("/api/admin/document-block-update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "No se pudo procesar la actualización.");
      }

      const initialPreviews: PreviewResultItem[] = (data.results || []).map((r: any) => ({
        ...r,
        selectedForSave: r.success,
      }));

      setPreviewResults(initialPreviews);
      setCurrentStep("preview");
    } catch (err: any) {
      setErrorMsg(err.message || "Ocurrió un error al generar el contenido.");
    } finally {
      setIsProcessing(false);
    }
  };

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

  // APPLY APPROVED CHANGES DIRECTLY TO BACKEND
  const handleSaveApprovedChanges = async () => {
    const toSave = previewResults.filter((p) => p.selectedForSave && p.success && p.updatedBodyHtml);
    if (toSave.length === 0) {
      setErrorMsg("No hay publicaciones seleccionadas para guardar.");
      return;
    }

    setIsSaving(true);
    setErrorMsg("");
    setSaveProgress({ current: 0, total: toSave.length });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < toSave.length; i++) {
      const item = toSave[i];
      setSaveProgress({ current: i + 1, total: toSave.length });

      try {
        const originalPub = publications.find((p) => p.id === item.publicationId);
        if (!originalPub) continue;

        const currentFields = (originalPub.fields as Record<string, any>) || {};
        const extraDescriptions: any[] = Array.isArray(currentFields.extraDescriptions)
          ? [...currentFields.extraDescriptions]
          : [];

        const targetTitle = item.blockTitle.trim();
        const existingIdx = extraDescriptions.findIndex(
          (d) => String(d?.title || "").trim().toLowerCase() === targetTitle.toLowerCase()
        );

        if (existingIdx >= 0) {
          extraDescriptions[existingIdx] = {
            ...extraDescriptions[existingIdx],
            title: targetTitle,
            body: item.updatedBodyHtml,
            titleI18n: {
              ...(extraDescriptions[existingIdx].titleI18n || {}),
              es: targetTitle,
            },
            bodyI18n: {
              ...(extraDescriptions[existingIdx].bodyI18n || {}),
              es: item.updatedBodyHtml,
            },
          };
        } else {
          extraDescriptions.push({
            title: targetTitle,
            body: item.updatedBodyHtml,
            titleI18n: { es: targetTitle },
            bodyI18n: { es: item.updatedBodyHtml },
            visibleInCard: false,
          });
        }

        const updatePayload = {
          ...originalPub,
          fields: {
            ...currentFields,
            extraDescriptions,
          },
          filterOptionIds: (originalPub.filterOptions || []).map((fo: any) => fo.filterOptionId || fo.id),
        };

        const res = await fetch(`/api/admin/publications?id=${encodeURIComponent(item.publicationId)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatePayload),
        });

        if (res.ok) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (e) {
        failCount++;
      }
    }

    setIsSaving(false);

    if (successCount > 0) {
      setSaveSuccessMsg(`Se actualizaron correctamente ${successCount} publicación(es)${failCount > 0 ? ` (${failCount} con error)` : ""}.`);
      setCurrentStep("complete");
      if (onPublicationsUpdated) {
        await onPublicationsUpdated();
      }
    } else {
      setErrorMsg("No se pudieron guardar los cambios en la base de datos.");
    }
  };

  const handleReset = () => {
    setCurrentStep("configure");
    setPreviewResults([]);
    setErrorMsg("");
    setSaveSuccessMsg("");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-2xl bg-white shadow-xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Clean Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Actualizador de Bloques Descriptivos
              </h2>
              <p className="text-xs text-slate-500">
                Actualiza el contenido de bloques específicos en las publicaciones seleccionadas.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center border-b border-slate-100 bg-slate-50/70 px-6 py-2.5 text-xs">
          <div
            className={`flex items-center gap-1.5 font-medium ${
              currentStep === "configure" ? "text-slate-900 font-semibold" : "text-slate-500"
            }`}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] text-white">
              1
            </span>
            Configuración y Selección
          </div>
          <span className="mx-3 text-slate-300">/</span>
          <div
            className={`flex items-center gap-1.5 font-medium ${
              currentStep === "preview" ? "text-slate-900 font-semibold" : "text-slate-400"
            }`}
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                currentStep === "preview"
                  ? "bg-slate-900 text-white"
                  : currentStep === "complete"
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-200 text-slate-600"
              }`}
            >
              2
            </span>
            Revisión de Cambios
          </div>
          <span className="mx-3 text-slate-300">/</span>
          <div
            className={`flex items-center gap-1.5 font-medium ${
              currentStep === "complete" ? "text-emerald-700 font-semibold" : "text-slate-400"
            }`}
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                currentStep === "complete" ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-600"
              }`}
            >
              3
            </span>
            Guardado
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50/70 p-3.5 text-xs text-rose-800">
              <AlertCircle className="h-4 w-4 flex-shrink-0 text-rose-600 mt-0.5" />
              <div className="flex-1 font-medium leading-relaxed">{errorMsg}</div>
            </div>
          )}

          {/* STEP 1: CONFIGURE */}
          {currentStep === "configure" && (
            <div className="space-y-6">
              {/* Sección 1: Bloque Objetivo */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    1. Bloque descriptivo a actualizar
                  </label>
                  <span className="text-xs text-slate-400">Elige uno existente o escribe uno nuevo</span>
                </div>

                {existingBlocksCatalog.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {existingBlocksCatalog.map(([title, count]) => {
                      const isSelected = targetBlockTitle.trim().toLowerCase() === title.trim().toLowerCase();
                      return (
                        <button
                          key={title}
                          type="button"
                          onClick={() => setTargetBlockTitle(title)}
                          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                            isSelected
                              ? "bg-slate-900 text-white shadow-xs"
                              : "bg-slate-100/80 text-slate-700 hover:bg-slate-200"
                          }`}
                        >
                          {title}
                          <span
                            className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                              isSelected ? "bg-white/20 text-white" : "bg-white text-slate-500"
                            }`}
                          >
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                <input
                  type="text"
                  value={targetBlockTitle}
                  onChange={(e) => setTargetBlockTitle(e.target.value)}
                  placeholder="Nombre del bloque (ej: Orientación, Requisitos, Información Práctica...)"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-slate-500 focus:outline-none"
                />
              </div>

              {/* Sección 2: Selección de Publicaciones */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    2. Publicaciones destinatarias
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-xs font-normal text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={onlyWithBlock}
                        onChange={(e) => setOnlyWithBlock(e.target.checked)}
                        className="rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                      />
                      Mostrar solo con este bloque
                    </label>
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      className="text-xs font-semibold text-slate-700 hover:text-slate-900 underline underline-offset-2"
                    >
                      {selectedPubIds.size === filteredPublications.length && filteredPublications.length > 0
                        ? "Deseleccionar todas"
                        : `Seleccionar todas (${filteredPublications.length})`}
                    </button>
                  </div>
                </div>

                {/* Filtro de búsqueda */}
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Filtrar por título, oferente o país..."
                    className="w-full rounded-lg border border-slate-200 pl-8 pr-3 py-1.5 text-xs text-slate-800 focus:border-slate-500 focus:outline-none"
                  />
                </div>

                {/* Lista de publicaciones */}
                <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
                  {filteredPublications.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      No hay publicaciones que coincidan con el filtro.
                    </div>
                  ) : (
                    filteredPublications.map((pub) => {
                      const isSelected = selectedPubIds.has(pub.id);
                      const hasBlock = pubHasTargetBlock(pub, targetBlockTitle);

                      return (
                        <div
                          key={pub.id}
                          onClick={() => handleTogglePub(pub.id)}
                          className={`flex items-center justify-between p-2.5 text-xs transition cursor-pointer hover:bg-slate-50 ${
                            isSelected ? "bg-slate-50" : ""
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="rounded border-slate-300 text-slate-900 focus:ring-slate-500 h-3.5 w-3.5"
                            />
                            <div className="min-w-0">
                              <div className="font-medium text-slate-900 truncate">{pub.title}</div>
                              <div className="text-[11px] text-slate-500 truncate flex items-center gap-1.5">
                                {pub.publisherName ? <span>{pub.publisherName}</span> : null}
                                {pub.country ? (
                                  <>
                                    <span>•</span>
                                    <span>{pub.country}</span>
                                  </>
                                ) : null}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                            {hasBlock ? (
                              <span className="rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                                Bloque existente
                              </span>
                            ) : (
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                                Sin este bloque
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="text-[11px] text-slate-500">
                  Seleccionadas: <strong className="text-slate-800">{selectedPubIds.size}</strong> de {filteredPublications.length}
                </div>
              </div>

              {/* Sección 3: Método de Actualización (2 OPCIONES LIMPIAS) */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    3. Método de actualización
                  </label>
                  <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-100">
                    <button
                      type="button"
                      onClick={() => setSourceMode("prompt")}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition ${
                        sourceMode === "prompt"
                          ? "bg-white text-slate-900 shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <PenTool className="h-3.5 w-3.5" />
                      Instrucciones de redacción
                    </button>
                    <button
                      type="button"
                      onClick={() => setSourceMode("file")}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition ${
                        sourceMode === "file"
                          ? "bg-white text-slate-900 shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5" />
                      Subir archivo (Excel / Doc)
                    </button>
                  </div>
                </div>

                {sourceMode === "prompt" ? (
                  <div className="space-y-2">
                    <textarea
                      rows={4}
                      value={updatePrompt}
                      onChange={(e) => setUpdatePrompt(e.target.value)}
                      placeholder="Escribe las instrucciones para actualizar este bloque (ej: Mejora la orientación, añade recomendaciones prácticas de llegada, trámites esenciales y consejos de adaptación)..."
                      className="w-full rounded-lg border border-slate-200 p-3 text-xs text-slate-900 focus:border-slate-500 focus:outline-none"
                    />
                    <p className="text-[11px] text-slate-400">
                      El redactor enriquecerá y adaptará el bloque específicamente al destino y contexto de cada publicación seleccionada.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv,.txt,.md,.json,.pdf"
                      onChange={handleFileChange}
                      className="hidden"
                    />

                    {uploadedFile ? (
                      <div className="flex items-center justify-between rounded-lg border border-slate-300 bg-slate-50 p-3">
                        <div className="flex items-center gap-3">
                          <FileSpreadsheet className="h-5 w-5 text-slate-700" />
                          <div>
                            <div className="text-xs font-semibold text-slate-900">{uploadedFile.name}</div>
                            <div className="text-[11px] text-slate-500">
                              {(uploadedFile.size / 1024).toFixed(1)} KB • Archivo listo para procesar
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setUploadedFile(null);
                            if (fileInputRef.current) fileInputRef.current.value = "";
                          }}
                          className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Cambiar archivo
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleDrop}
                        className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50/50 p-6 transition cursor-pointer hover:border-slate-400 hover:bg-slate-50"
                      >
                        <Upload className="h-6 w-6 text-slate-400 mb-2" />
                        <div className="text-xs font-medium text-slate-700">
                          Haz clic para subir o arrastra tu archivo aquí
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Formatos aceptados: .xlsx, .xls, .csv, .txt o .pdf
                        </div>
                      </div>
                    )}

                    {/* Instrucción complementaria */}
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 mb-1 block">
                        Instrucciones complementarias (opcional):
                      </label>
                      <input
                        type="text"
                        value={updatePrompt}
                        onChange={(e) => setUpdatePrompt(e.target.value)}
                        placeholder="Ej: Dar prioridad a las normativas vigentes para extranjeros del Mercosur..."
                        className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-900 focus:border-slate-500 focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: PREVIEW */}
          {currentStep === "preview" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Revisión de Cambios
                  </h3>
                  <p className="text-xs text-slate-500">
                    Revisa las modificaciones generadas antes de guardarlas en el sistema.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleAllPreviews(true)}
                    className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Aprobar todas
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleAllPreviews(false)}
                    className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-50"
                  >
                    Desmarcar todas
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {previewResults.map((item) => {
                  const isExpanded = expandedPreviewIds.has(item.publicationId);
                  return (
                    <div
                      key={item.publicationId}
                      className={`rounded-xl border transition ${
                        item.selectedForSave && item.success
                          ? "border-slate-300 bg-white"
                          : !item.success
                          ? "border-rose-200 bg-rose-50/20"
                          : "border-slate-200 bg-slate-50 opacity-60"
                      }`}
                    >
                      <div className="flex items-center justify-between p-3.5 border-b border-slate-100">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            disabled={!item.success}
                            checked={item.selectedForSave && item.success}
                            onChange={() => handleTogglePreviewSelect(item.publicationId)}
                            className="rounded border-slate-300 text-slate-900 focus:ring-slate-500 h-4 w-4"
                          />
                          <div className="min-w-0">
                            <div className="font-semibold text-xs text-slate-900 truncate">
                              {item.publicationTitle}
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                              {item.country && <span>{item.country}</span>}
                              {item.publisherName && (
                                <>
                                  <span>•</span>
                                  <span>{item.publisherName}</span>
                                </>
                              )}
                              <span>•</span>
                              <span className="font-medium text-slate-700">Bloque: {item.blockTitle}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {item.success ? (
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                              Listo para aplicar
                            </span>
                          ) : (
                            <span className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-700">
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
                            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="p-3.5">
                        {item.success && item.updatedBodyHtml ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                Versión Anterior
                              </div>
                              {item.originalBody ? (
                                <div
                                  className="text-slate-600 max-h-40 overflow-y-auto prose prose-xs"
                                  dangerouslySetInnerHTML={{ __html: item.originalBody }}
                                />
                              ) : (
                                <div className="text-slate-400 italic">
                                  (Bloque nuevo, no existía en esta publicación)
                                </div>
                              )}
                            </div>

                            <div className="rounded-lg border border-slate-300 bg-white p-3">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-800 mb-1.5">
                                Nueva Versión
                              </div>
                              <div
                                className="text-slate-900 max-h-40 overflow-y-auto prose prose-xs"
                                dangerouslySetInnerHTML={{ __html: item.updatedBodyHtml }}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="p-3 text-xs text-rose-700 bg-rose-50 rounded-lg">
                            {item.error || "No se pudo generar el contenido."}
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
            <div className="flex flex-col items-center justify-center p-8 text-center space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Actualización completada</h3>
              <p className="text-xs text-slate-600 max-w-sm">{saveSuccessMsg}</p>
              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Actualizar otro bloque
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-white px-6 py-3.5">
          <div>
            {currentStep === "preview" && (
              <button
                type="button"
                onClick={() => setCurrentStep("configure")}
                className="text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                ← Volver a Configurar
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing || isSaving}
              className="rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancelar
            </button>

            {currentStep === "configure" && (
              <button
                type="button"
                onClick={handleGeneratePreviews}
                disabled={isProcessing || selectedPubIds.size === 0 || (sourceMode === "prompt" && !updatePrompt.trim()) || (sourceMode === "file" && !uploadedFile && !updatePrompt.trim())}
                className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Generando ({selectedPubIds.size})...
                  </>
                ) : (
                  <>
                    Continuar a Previsualización ({selectedPubIds.size})
                  </>
                )}
              </button>
            )}

            {currentStep === "preview" && (
              <button
                type="button"
                onClick={handleSaveApprovedChanges}
                disabled={isSaving || previewResults.filter((p) => p.selectedForSave && p.success).length === 0}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Guardando ({saveProgress.current}/{saveProgress.total})...
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Aplicar Cambios ({previewResults.filter((p) => p.selectedForSave && p.success).length})
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
