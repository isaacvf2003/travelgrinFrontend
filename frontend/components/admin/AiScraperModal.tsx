"use client";

import { useState, useEffect } from "react";
import { Bot, Sparkles, X, Trash2, Plus, Info, RefreshCw, FileText, Check, Settings2, ArrowUp, ArrowDown, Pencil } from "lucide-react";

export type I18nRecord = Record<string, string>;

export interface ExtraDescriptionBlock {
  title: string;
  titleI18n: I18nRecord;
  body: string;
  bodyI18n: I18nRecord;
  visibleInCard: boolean;
  estado?: "ok" | "parcial" | "sin_datos";
  contenido?: string;
  evidencias?: string[];
  prompt?: string;
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
  scrapedHeadings?: string[];
  scrapedParagraphs?: string[];
  scrapedTextContent?: string;
  rawPageTitle?: string;
  status?: "active" | "draft" | "paused";
}

interface AiScraperModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDraftToEdit: (draft: ScrapedPublicationDraft, index?: number) => void;
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
  const [translatingIndex, setTranslatingIndex] = useState<number | null>(null);
  const [translatingAll, setTranslatingAll] = useState(false);
  const [translateProgress, setTranslateProgress] = useState("");
  const [successNotice, setSuccessNotice] = useState("");
  const [customTitlePrompt, setCustomTitlePrompt] = useState("");
  const [customDescPrompt, setCustomDescPrompt] = useState("");
  const [includeScoreScout, setIncludeScoreScout] = useState(false);
  const [customScraperBlocks, setCustomScraperBlocks] = useState<Array<{ title: string; prompt?: string }>>([]);
  const [newBlockTitleInput, setNewBlockTitleInput] = useState("");
  const [newBlockPromptInput, setNewBlockPromptInput] = useState("");
  const [customScraperPrompts, setCustomScraperPrompts] = useState<string[]>([]);
  const [newPromptInput, setNewPromptInput] = useState("");

  // Reordering and inline editing of custom description blocks
  const [editingBlockIndex, setEditingBlockIndex] = useState<number | null>(null);
  const [editingBlockTitle, setEditingBlockTitle] = useState("");
  const [editingBlockPrompt, setEditingBlockPrompt] = useState("");

  // Accordion Inline Form State for active draft inspection directly in the queue card
  const [expandedDraftIndex, setExpandedDraftIndex] = useState<number | null>(null);
  const [draftForm, setDraftForm] = useState<ScrapedPublicationDraft | null>(null);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [customLogoInput, setCustomLogoInput] = useState("");

  // Restore queue from sessionStorage and customApiKey/prompts/blocks from localStorage on load
  useEffect(() => {
    if (typeof window === "undefined" || !isOpen) return;
    try {
      const savedKey = window.localStorage.getItem("tgn_ai_custom_api_key");
      if (savedKey) setCustomApiKey(savedKey);

      const savedProvider = window.localStorage.getItem("tgn_ai_scraper_provider");
      if (savedProvider === "auto" || savedProvider === "gemini" || savedProvider === "openai") {
        setAiProvider(savedProvider);
      }

      const savedTitlePrompt = window.localStorage.getItem("tgn_custom_title_prompt");
      if (savedTitlePrompt) setCustomTitlePrompt(savedTitlePrompt);

      const savedDescPrompt = window.localStorage.getItem("tgn_custom_desc_prompt");
      if (savedDescPrompt) setCustomDescPrompt(savedDescPrompt);

      const savedScoreScout = window.localStorage.getItem("tgn_include_score_scout");
      if (savedScoreScout !== null) {
        setIncludeScoreScout(savedScoreScout === "true");
      }

      const savedBlocks = window.localStorage.getItem("tgn_custom_scraper_blocks");
      if (savedBlocks) {
        const parsed = JSON.parse(savedBlocks);
        if (Array.isArray(parsed)) {
          setCustomScraperBlocks(parsed);
        }
      }

      const savedPrompts = window.localStorage.getItem("tgn_custom_scraper_prompts");
      if (savedPrompts) {
        const parsed = JSON.parse(savedPrompts);
        if (Array.isArray(parsed)) {
          setCustomScraperPrompts(parsed);
        }
      }

      const saved = window.sessionStorage.getItem("tgn_ai_drafts_queue");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setDraftsQueue(parsed);
        }
      }
    } catch {}
  }, [isOpen]);

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

  const handleSaveAiProvider = (provider: "auto" | "gemini" | "openai") => {
    setAiProvider(provider);
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem("tgn_ai_scraper_provider", provider);
      }
    } catch {}
  };

  const handleSaveTitlePrompt = (val: string) => {
    setCustomTitlePrompt(val);
    try {
      if (typeof window !== "undefined") {
        if (val.trim()) {
          window.localStorage.setItem("tgn_custom_title_prompt", val.trim());
        } else {
          window.localStorage.removeItem("tgn_custom_title_prompt");
        }
      }
    } catch {}
  };

  const handleSaveDescPrompt = (val: string) => {
    setCustomDescPrompt(val);
    try {
      if (typeof window !== "undefined") {
        if (val.trim()) {
          window.localStorage.setItem("tgn_custom_desc_prompt", val.trim());
        } else {
          window.localStorage.removeItem("tgn_custom_desc_prompt");
        }
      }
    } catch {}
  };

  const handleToggleScoreScout = (enabled: boolean) => {
    setIncludeScoreScout(enabled);
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem("tgn_include_score_scout", enabled ? "true" : "false");
      }
    } catch {}
  };

  const handleAddCustomScraperBlock = (title: string, promptText?: string) => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    setCustomScraperBlocks((prev) => {
      const filtered = prev.filter((b) => b.title.toLowerCase() !== trimmedTitle.toLowerCase());
      const updated = [...filtered, { title: trimmedTitle, prompt: promptText?.trim() || undefined }];
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem("tgn_custom_scraper_blocks", JSON.stringify(updated));
        }
      } catch {}
      return updated;
    });
    setNewBlockTitleInput("");
    setNewBlockPromptInput("");
  };

  const handleRemoveCustomScraperBlock = (titleToRemove: string) => {
    setCustomScraperBlocks((prev) => {
      const updated = prev.filter((b) => b.title.toLowerCase() !== titleToRemove.toLowerCase());
      try {
        if (typeof window !== "undefined") {
          if (updated.length > 0) {
            window.localStorage.setItem("tgn_custom_scraper_blocks", JSON.stringify(updated));
          } else {
            window.localStorage.removeItem("tgn_custom_scraper_blocks");
          }
        }
      } catch {}
      return updated;
    });
  };

  const handleMoveCustomBlock = (index: number, direction: "up" | "down") => {
    setCustomScraperBlocks((prev) => {
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem("tgn_custom_scraper_blocks", JSON.stringify(copy));
        }
      } catch {}
      return copy;
    });
  };

  const handleStartEditBlock = (index: number) => {
    const block = customScraperBlocks[index];
    if (!block) return;
    setEditingBlockIndex(index);
    setEditingBlockTitle(block.title);
    setEditingBlockPrompt(block.prompt || "");
  };

  const handleSaveEditBlock = () => {
    if (editingBlockIndex === null) return;
    const cleanTitle = editingBlockTitle.trim();
    if (!cleanTitle) return;
    setCustomScraperBlocks((prev) => {
      const copy = [...prev];
      copy[editingBlockIndex] = {
        title: cleanTitle,
        prompt: editingBlockPrompt.trim() || undefined,
      };
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem("tgn_custom_scraper_blocks", JSON.stringify(copy));
        }
      } catch {}
      return copy;
    });
    setEditingBlockIndex(null);
    setEditingBlockTitle("");
    setEditingBlockPrompt("");
  };

  const handleCancelEditBlock = () => {
    setEditingBlockIndex(null);
    setEditingBlockTitle("");
    setEditingBlockPrompt("");
  };

  const ensureCustomBlocksInDraft = (draft: ScrapedPublicationDraft): ScrapedPublicationDraft => {
    const existing = [...(draft.extraDescriptions || [])];
    customScraperBlocks.forEach((b) => {
      const cleanTitle = b.title.trim();
      const existingIdx = existing.findIndex((eb) => eb.title.toLowerCase() === cleanTitle.toLowerCase());
      if (existingIdx === -1) {
        existing.push({
          title: cleanTitle,
          titleI18n: { es: cleanTitle, en: cleanTitle, pt: cleanTitle, it: cleanTitle },
          body: "",
          bodyI18n: { es: "", en: "", pt: "", it: "" },
          visibleInCard: false,
          prompt: b.prompt,
        });
      } else if (b.prompt && !existing[existingIdx].prompt) {
        existing[existingIdx] = {
          ...existing[existingIdx],
          prompt: b.prompt,
        };
      }
    });
    return {
      ...draft,
      extraDescriptions: existing,
    };
  };

  const handleAddPromptRule = (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed) return;
    setCustomScraperPrompts((prev) => {
      if (prev.some((p) => p.toLowerCase() === trimmed.toLowerCase())) return prev;
      const updated = [...prev, trimmed];
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem("tgn_custom_scraper_prompts", JSON.stringify(updated));
        }
      } catch {}
      return updated;
    });
    setNewPromptInput("");
  };

  const handleRemovePromptRule = (index: number) => {
    setCustomScraperPrompts((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      try {
        if (typeof window !== "undefined") {
          if (updated.length > 0) {
            window.localStorage.setItem("tgn_custom_scraper_prompts", JSON.stringify(updated));
          } else {
            window.localStorage.removeItem("tgn_custom_scraper_prompts");
          }
        }
      } catch {}
      return updated;
    });
  };

  const handleClearAllPrompts = () => {
    setCustomScraperPrompts([]);
    try {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("tgn_custom_scraper_prompts");
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
      const effectivePrompts = [...customScraperPrompts];
      if (newPromptInput.trim() && !effectivePrompts.some((p) => p.toLowerCase() === newPromptInput.trim().toLowerCase())) {
        effectivePrompts.push(newPromptInput.trim());
      }

      const res = await fetch("/api/admin/ai-scrape-publications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          urls: urlsToProcess,
          provider: aiProvider,
          apiKey: customApiKey.trim() || undefined,
          customTitlePrompt: customTitlePrompt.trim() || undefined,
          customDescriptionPrompt: customDescPrompt.trim() || undefined,
          includeScoreScout,
          customBlocks: customScraperBlocks,
          customPrompts: effectivePrompts,
        }),
      });

      const rawText = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(rawText);
      } catch {
        if (res.status === 504 || rawText.includes("504") || /gateway timeout|FUNCTION_INVOCATION_TIMEOUT/i.test(rawText)) {
          throw new Error("El proceso de scraping tardó más del tiempo límite de Vercel (Timeout). Por favor intentalo nuevamente o con menos URLs.");
        }
        if (rawText.startsWith("An error occurred") || rawText.includes("<!DOCTYPE")) {
          throw new Error(`Error en el servidor de IA (${res.status}). Por favor verificá que la URL sea pública o reintentá en unos momentos.`);
        }
        throw new Error(rawText.slice(0, 150) || "Error al procesar el scraping web con IA.");
      }

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
        const updated = [...generatedDrafts, ...prev];
        try {
          if (typeof window !== "undefined") {
            window.sessionStorage.setItem("tgn_ai_drafts_queue", JSON.stringify(updated));
          }
        } catch {}
        return updated;
      });

      if (tab === "single" && generatedDrafts.length === 1) {
        setExpandedDraftIndex(0);
        setDraftForm(generatedDrafts[0]);
        setSuccessNotice("Publicación generada exitosamente. Se ha añadido al inicio de la cola.");
      } else {
        setSuccessNotice(`Se generaron ${generatedDrafts.length} borrador(es) en la cola de revisión.`);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "No se pudo completar la extracción web.");
    } finally {
      setIsProcessing(false);
    }
  };

  const isDraftTranslated = (draft: ScrapedPublicationDraft): boolean => {
    const enTitle = draft.titleI18n?.en;
    const enDesc = draft.descriptionI18n?.en;
    const esTitle = draft.titleI18n?.es || draft.title;
    const esDesc = draft.descriptionI18n?.es || draft.description;
    return Boolean((enTitle && enTitle.trim() !== esTitle.trim()) || (enDesc && enDesc.trim() !== esDesc.trim()));
  };

  const translateSingleDraft = async (
    draft: ScrapedPublicationDraft,
    customKey?: string
  ): Promise<ScrapedPublicationDraft> => {
    const sourceLang = "es";
    const targetLangs = ["en", "pt", "it"];
    const titleSource = (draft.titleI18n?.es || draft.title || "").trim();
    const descSource = (draft.descriptionI18n?.es || draft.description || "").trim();
    const provSource = (draft.providerInfoI18n?.es || "").trim();

    let updatedTitleI18n = { ...(draft.titleI18n || { es: titleSource }) };
    let updatedDescI18n = { ...(draft.descriptionI18n || { es: descSource }) };
    let updatedProvI18n = { ...(draft.providerInfoI18n || { es: provSource }) };

    // 1. Translate Title
    if (titleSource) {
      try {
        const res = await fetch("/api/admin/translate-i18n", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: titleSource,
            targetLangs,
            sourceLang,
            isHtml: false,
            apiKey: customKey?.trim() || undefined,
          }),
        });
        const data = await res.json();
        if (data?.translations) {
          updatedTitleI18n = {
            ...updatedTitleI18n,
            es: titleSource,
            ...data.translations,
          };
        }
      } catch (e) {
        console.error("Error translating title:", e);
      }
    }

    // 2. Translate Description
    if (descSource) {
      try {
        const res = await fetch("/api/admin/translate-i18n", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: descSource,
            targetLangs,
            sourceLang,
            isHtml: true,
            apiKey: customKey?.trim() || undefined,
          }),
        });
        const data = await res.json();
        if (data?.translations) {
          updatedDescI18n = {
            ...updatedDescI18n,
            es: descSource,
            ...data.translations,
          };
        }
      } catch (e) {
        console.error("Error translating description:", e);
      }
    }

    // 3. Translate Provider Info
    if (provSource) {
      try {
        const res = await fetch("/api/admin/translate-i18n", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: provSource,
            targetLangs,
            sourceLang,
            isHtml: true,
            apiKey: customKey?.trim() || undefined,
          }),
        });
        const data = await res.json();
        if (data?.translations) {
          updatedProvI18n = {
            ...updatedProvI18n,
            es: provSource,
            ...data.translations,
          };
        }
      } catch (e) {
        console.error("Error translating provider info:", e);
      }
    }

    // 4. Translate Extra Description Blocks
    let updatedExtraDescriptions = [...(draft.extraDescriptions || [])];
    if (updatedExtraDescriptions.length > 0) {
      const translatedBlocks = await Promise.all(
        updatedExtraDescriptions.map(async (block) => {
          const blockTitle = (block.titleI18n?.es || block.title || "").trim();
          const blockBody = (block.bodyI18n?.es || block.body || "").trim();
          let nextTitleI18n = { ...(block.titleI18n || { es: blockTitle }) };
          let nextBodyI18n = { ...(block.bodyI18n || { es: blockBody }) };

          if (blockTitle) {
            try {
              const res = await fetch("/api/admin/translate-i18n", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  text: blockTitle,
                  targetLangs,
                  sourceLang,
                  isHtml: false,
                  apiKey: customKey?.trim() || undefined,
                }),
              });
              const data = await res.json();
              if (data?.translations) {
                nextTitleI18n = { ...nextTitleI18n, es: blockTitle, ...data.translations };
              }
            } catch {}
          }

          if (blockBody) {
            try {
              const res = await fetch("/api/admin/translate-i18n", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  text: blockBody,
                  targetLangs,
                  sourceLang,
                  isHtml: true,
                  apiKey: customKey?.trim() || undefined,
                }),
              });
              const data = await res.json();
              if (data?.translations) {
                nextBodyI18n = { ...nextBodyI18n, es: blockBody, ...data.translations };
              }
            } catch {}
          }

          return {
            ...block,
            title: blockTitle,
            body: blockBody,
            titleI18n: nextTitleI18n,
            bodyI18n: nextBodyI18n,
          };
        })
      );
      updatedExtraDescriptions = translatedBlocks;
    }

    return {
      ...draft,
      titleI18n: updatedTitleI18n,
      descriptionI18n: updatedDescI18n,
      providerInfoI18n: updatedProvI18n,
      extraDescriptions: updatedExtraDescriptions,
    };
  };

  const handleTranslateDraft = async (index: number) => {
    const target = draftsQueue[index];
    if (!target) return;
    setTranslatingIndex(index);
    setErrorMessage("");
    try {
      const updated = await translateSingleDraft(target, customApiKey);
      setDraftsQueue((prev) => {
        const copy = prev.map((d, i) => (i === index ? updated : d));
        try {
          if (typeof window !== "undefined") {
            window.sessionStorage.setItem("tgn_ai_drafts_queue", JSON.stringify(copy));
          }
        } catch {}
        return copy;
      });
      setSuccessNotice(`Borrador "${target.title.slice(0, 35)}..." traducido exitosamente a 4 idiomas (ES, EN, PT, IT).`);
    } catch (err: any) {
      setErrorMessage(err.message || "Error al traducir el borrador.");
    } finally {
      setTranslatingIndex(null);
    }
  };

  const handleTranslateAllDrafts = async () => {
    if (!draftsQueue.length) return;
    setTranslatingAll(true);
    setErrorMessage("");
    setTranslateProgress(`Traduciendo 1 de ${draftsQueue.length}...`);
    try {
      const newQueue: ScrapedPublicationDraft[] = [];
      for (let i = 0; i < draftsQueue.length; i++) {
        setTranslateProgress(`Traduciendo ${i + 1} de ${draftsQueue.length}...`);
        const updated = await translateSingleDraft(draftsQueue[i], customApiKey);
        newQueue.push(updated);
      }
      setDraftsQueue(newQueue);
      try {
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem("tgn_ai_drafts_queue", JSON.stringify(newQueue));
        }
      } catch {}
      setSuccessNotice(`Todos los borradores (${draftsQueue.length}) fueron traducidos a 4 idiomas (ES, EN, PT, IT).`);
    } catch (err: any) {
      setErrorMessage(err.message || "Error al traducir el lote de borradores.");
    } finally {
      setTranslatingAll(false);
      setTranslateProgress("");
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
    const effectiveDraft = ensureCustomBlocksInDraft(draft);
    if (!onApproveDirectly) {
      onSelectDraftToEdit(effectiveDraft);
      handleRemoveDraft(index);
      onClose();
      return;
    }

    setSavingIndex(index);
    try {
      const success = await onApproveDirectly(effectiveDraft);
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
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 my-4 sm:my-8 relative">
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

          {/* Custom AI Options & Fixed Prompts Section */}
          <div className="rounded-2xl border border-cyan-200 bg-gradient-to-b from-cyan-50/70 to-slate-50/70 p-4 text-xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-cyan-100/80 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[#007D92] flex items-center gap-1.5 text-sm">
                  <Sparkles className="h-4 w-4 text-[#00A9C6]" />
                  Configuración de Prompts e Instrucciones Fijas de IA
                </span>
                <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-bold text-[#006070]">
                  Personalización Permanente
                </span>
              </div>
              <span className="text-[11px] text-slate-500">
                Se guarda en tu navegador y se aplica automáticamente en cada scraping futuro
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 1. Custom Title Prompt */}
              <div className="space-y-1.5 rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <span>📌 Prompt para Título</span>
                  </label>
                  {customTitlePrompt ? (
                    <button
                      type="button"
                      onClick={() => handleSaveTitlePrompt("")}
                      className="text-[10px] font-semibold text-rose-500 hover:underline cursor-pointer"
                    >
                      Restablecer
                    </button>
                  ) : null}
                </div>
                <p className="text-[11px] text-slate-500 leading-tight">
                  Indicaciones para el estilo del título (ej: especialista de marketing, clientes extranjeros, tono empático).
                </p>
                <textarea
                  rows={2}
                  value={customTitlePrompt}
                  onChange={(e) => handleSaveTitlePrompt(e.target.value)}
                  placeholder="Ej: Actúa como especialista en marketing digital, orientado a clientes extranjeros, títulos llamativos y humanos..."
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs text-slate-800 outline-none focus:border-[#00A9C6] focus:ring-1 focus:ring-[#00A9C6]"
                  disabled={isProcessing}
                />
                <div className="flex flex-wrap gap-1 pt-1 text-[10px]">
                  {[
                    "Especialista en marketing y conversión",
                    "Enfoque clientes extranjeros",
                    "Tono humano y cercano",
                    "Nombre oficial con subtítulo destacado",
                    "Corto, limpio y directo",
                  ].map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => handleSaveTitlePrompt(customTitlePrompt ? `${customTitlePrompt}. ${sug}` : sug)}
                      className="rounded border border-cyan-100 bg-cyan-50/50 px-1.5 py-0.5 text-cyan-800 hover:bg-cyan-100 transition cursor-pointer"
                    >
                      + {sug}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Custom Description Prompt */}
              <div className="space-y-1.5 rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <span>📝 Prompt para Descripción Principal</span>
                  </label>
                  {customDescPrompt ? (
                    <button
                      type="button"
                      onClick={() => handleSaveDescPrompt("")}
                      className="text-[10px] font-semibold text-rose-500 hover:underline cursor-pointer"
                    >
                      Restablecer
                    </button>
                  ) : null}
                </div>
                <p className="text-[11px] text-slate-500 leading-tight">
                  Indicaciones de redacción (ej: estructura de servicios, tono empático, sin precios, sin emojis ni frases genéricas).
                </p>
                <textarea
                  rows={2}
                  value={customDescPrompt}
                  onChange={(e) => handleSaveDescPrompt(e.target.value)}
                  placeholder="Ej: Explicar servicio por servicio con detalle, redacción clara y profesional, sin precios ni aranceles..."
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs text-slate-800 outline-none focus:border-[#00A9C6] focus:ring-1 focus:ring-[#00A9C6]"
                  disabled={isProcessing}
                />
                <div className="flex flex-wrap gap-1 pt-1 text-[10px]">
                  {[
                    "Sin precios ni aranceles",
                    "Sin emojis ni viñetas genéricas",
                    "Explicar cada servicio en detalle",
                    "Resumen ejecutivo formal",
                    "Enfocado en historia y trayectoria",
                  ].map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => handleSaveDescPrompt(customDescPrompt ? `${customDescPrompt}. ${sug}` : sug)}
                      className="rounded border border-cyan-100 bg-cyan-50/50 px-1.5 py-0.5 text-cyan-800 hover:bg-cyan-100 transition cursor-pointer"
                    >
                      + {sug}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 3. Bloques Opcionales de Descripción */}
            <div className="rounded-xl border border-purple-200 bg-white p-3.5 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-purple-900 text-xs flex items-center gap-1">
                    <Bot className="h-4 w-4 text-purple-600" />
                    Bloques Opcionales de Descripción
                  </span>
                  <span className="text-[11px] text-purple-700">
                    (Se generan automáticamente debajo de la descripción principal)
                  </span>
                </div>
                <span className="text-[10px] text-slate-400">
                  Podés eliminar o agregar bloques según lo que necesites
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* Score Scout Block Card */}
                {includeScoreScout ? (
                  <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/60 p-2.5">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-emerald-900 text-xs">Score Scout</span>
                        <span className="rounded bg-emerald-200/80 px-1.5 py-0.2 text-[9px] font-bold text-emerald-800">
                          Auditoría
                        </span>
                      </div>
                      <p className="text-[10px] text-emerald-700 leading-tight">
                        Puntuación y confianza institucional calculada por IA.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleScoreScout(false)}
                      title="Eliminar bloque Score Scout (no aparecerá en futuros scrapings)"
                      className="rounded-lg border border-rose-200 bg-white px-2 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 hover:border-rose-300 transition flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" />
                      Eliminar bloque
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                    <div className="text-[11px] text-slate-500">
                      <span className="line-through font-medium text-slate-400">Score Scout</span>
                      <span className="text-[10px] block text-slate-400">Bloque eliminado de futuros scrapings</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleScoreScout(true)}
                      className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 transition cursor-pointer"
                    >
                      + Restaurar Score Scout
                    </button>
                  </div>
                )}

                {/* Other Custom Blocks */}
                {customScraperBlocks.map((b, bIdx) => {
                  const isEditing = editingBlockIndex === bIdx;
                  return (
                    <div
                      key={bIdx}
                      className="rounded-xl border border-purple-200 bg-purple-50/50 p-2.5 transition space-y-2"
                    >
                      {isEditing ? (
                        <div className="space-y-2 bg-white/90 p-2.5 rounded-lg border border-purple-300">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-purple-900">Editar Bloque Opcional</span>
                            <span className="text-[10px] text-slate-500">Posición {bIdx + 1} de {customScraperBlocks.length}</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">Título del bloque:</label>
                              <input
                                type="text"
                                value={editingBlockTitle}
                                onChange={(e) => setEditingBlockTitle(e.target.value)}
                                className="w-full rounded-lg border border-purple-300 bg-white px-2.5 py-1 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
                                placeholder="Título del bloque"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">Prompt o instrucción para la IA:</label>
                              <input
                                type="text"
                                value={editingBlockPrompt}
                                onChange={(e) => setEditingBlockPrompt(e.target.value)}
                                className="w-full rounded-lg border border-purple-300 bg-white px-2.5 py-1 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
                                placeholder="Prompt para la IA (ej: hazme o generame 10 preguntas con respuestas)"
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={handleCancelEditBlock}
                              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={handleSaveEditBlock}
                              className="rounded-lg bg-purple-600 px-3 py-1 text-[11px] font-bold text-white hover:bg-purple-700 cursor-pointer shadow-xs"
                            >
                              Guardar Cambios
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <div className="space-y-0.5 overflow-hidden pr-2 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-purple-900 text-xs truncate">{b.title}</span>
                              <span className="rounded bg-purple-200/80 px-1.5 py-0.2 text-[9px] font-bold text-purple-800">
                                Personalizado
                              </span>
                            </div>
                            {b.prompt ? (
                              <p className="text-[10px] text-purple-700 truncate" title={b.prompt}>
                                <span className="font-semibold text-purple-900">Prompt:</span> {b.prompt}
                              </p>
                            ) : (
                              <p className="text-[10px] text-slate-400">Extracción automática de contenido</p>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Reorder Arrows */}
                            <div className="flex items-center border border-purple-200 rounded-lg bg-white overflow-hidden shadow-xs">
                              <button
                                type="button"
                                onClick={() => handleMoveCustomBlock(bIdx, "up")}
                                disabled={bIdx === 0}
                                title="Subir posición de este bloque"
                                className="px-1.5 py-1 text-purple-700 hover:bg-purple-50 disabled:opacity-30 disabled:hover:bg-white cursor-pointer transition border-r border-purple-100"
                              >
                                <ArrowUp className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveCustomBlock(bIdx, "down")}
                                disabled={bIdx === customScraperBlocks.length - 1}
                                title="Bajar posición de este bloque"
                                className="px-1.5 py-1 text-purple-700 hover:bg-purple-50 disabled:opacity-30 disabled:hover:bg-white cursor-pointer transition"
                              >
                                <ArrowDown className="h-3 w-3" />
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleStartEditBlock(bIdx)}
                              title="Editar título o prompt de este bloque"
                              className="rounded-lg border border-purple-200 bg-white px-2 py-1 text-[11px] font-semibold text-purple-700 hover:bg-purple-100 hover:border-purple-300 transition flex items-center gap-1 cursor-pointer shadow-xs"
                            >
                              <Pencil className="h-3 w-3" />
                              Editar prompt
                            </button>

                            <button
                              type="button"
                              onClick={() => handleRemoveCustomScraperBlock(b.title)}
                              title="Eliminar este bloque opcional"
                              className="rounded-lg border border-rose-200 bg-white px-2 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 hover:border-rose-300 transition flex items-center gap-1 cursor-pointer shadow-xs"
                            >
                              <Trash2 className="h-3 w-3" />
                              Eliminar bloque
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Form to Add New Custom Block */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <span className="text-[11px] font-bold text-slate-700">
                    + Añadir nuevo bloque opcional de descripción para futuros scrapings:
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 pb-1">
                  <span className="text-[10px] text-slate-500 font-semibold">Plantillas Prompts v2:</span>
                  <button
                    type="button"
                    onClick={() => handleAddCustomScraperBlock("Requisitos", "Extraer requisitos de admisión, documentación necesaria, perfil del postulante o condiciones de ingreso presentes en el texto del sitio. Si no hay datos, marcar sin_datos.")}
                    className="rounded-md border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-800 hover:bg-purple-100 transition cursor-pointer"
                  >
                    + Requisitos
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddCustomScraperBlock("Proceso y costos", "Detallar pasos del proceso o trámite, etapas, aranceles o modalidades de pago informadas en el sitio web. Si no hay datos, marcar sin_datos.")}
                    className="rounded-md border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-800 hover:bg-purple-100 transition cursor-pointer"
                  >
                    + Proceso y costos
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddCustomScraperBlock("Logística", "Informar modalidad (presencial/online), sedes, horarios de atención, plataformas o canales de soporte del sitio web. Si no hay datos, marcar sin_datos.")}
                    className="rounded-md border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-800 hover:bg-purple-100 transition cursor-pointer"
                  >
                    + Logística
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddCustomScraperBlock("FAQs", "Extraer las preguntas frecuentes y respuestas oficiales directamente de la sección de dudas o información del sitio web. Si el sitio no contiene preguntas frecuentes, marcar sin_datos.")}
                    className="rounded-md border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-800 hover:bg-purple-100 transition cursor-pointer"
                  >
                    + FAQs (Preguntas Frecuentes)
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={newBlockTitleInput}
                    onChange={(e) => setNewBlockTitleInput(e.target.value)}
                    placeholder="Título del bloque (ej: Requisitos, Formas de Pago, FAQ...)"
                    className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-[#00A9C6]"
                    disabled={isProcessing}
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newBlockPromptInput}
                      onChange={(e) => setNewBlockPromptInput(e.target.value)}
                      placeholder="Prompt de descripción para la IA (opcional)"
                      className="flex-1 h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-[#00A9C6]"
                      disabled={isProcessing}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newBlockTitleInput.trim()) {
                          e.preventDefault();
                          handleAddCustomScraperBlock(newBlockTitleInput, newBlockPromptInput);
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleAddCustomScraperBlock(newBlockTitleInput, newBlockPromptInput)}
                      disabled={isProcessing || !newBlockTitleInput.trim()}
                      className="h-8 px-3 rounded-lg bg-[#00A9C6] text-xs font-bold text-white hover:bg-[#0095AE] disabled:opacity-50 transition cursor-pointer shrink-0"
                    >
                      Agregar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs font-semibold text-slate-700">Motor de IA:</label>
              <select
                value={aiProvider}
                onChange={(e) => handleSaveAiProvider(e.target.value as "auto" | "gemini" | "openai")}
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
              className="h-10 rounded-xl bg-[#00A9C6] px-5 text-sm font-semibold text-white hover:bg-[#0095AE] disabled:opacity-50 transition shadow-sm cursor-pointer"
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
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Cola de Revisión ({draftsQueue.length} borrador{draftsQueue.length > 1 ? "es" : ""})
                </h3>
                <p className="text-xs text-slate-500">
                  Inspecciona, traduce a 4 idiomas (EN, PT, IT) o pasa al formulario principal antes de publicar.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setDraftsQueue([]);
                    setExpandedDraftIndex(null);
                    setDraftForm(null);
                    try {
                      if (typeof window !== "undefined") {
                        window.sessionStorage.removeItem("tgn_ai_drafts_queue");
                      }
                    } catch {}
                    setSuccessNotice("Cola de borradores vaciada.");
                  }}
                  className="h-9 rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  title="Vaciar todos los borradores de la cola de revisión"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Limpiar cola</span>
                </button>

                <button
                  type="button"
                  onClick={handleTranslateAllDrafts}
                  disabled={translatingAll || isProcessing || translatingIndex !== null}
                  className="h-9 rounded-xl border border-sky-300 bg-sky-50 px-3.5 text-xs font-semibold text-[#007D92] hover:bg-sky-100 disabled:opacity-50 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  title="Traducir todos los borradores de la cola a Inglés, Portugués e Italiano"
                >
                  {translatingAll ? (
                    <>
                      <span className="inline-block animate-spin">⏳</span>
                      <span>{translateProgress || "Traduciendo lote..."}</span>
                    </>
                  ) : (
                    <>
                      <span>🌐</span>
                      <span>Traducir todo el lote (EN, PT, IT)</span>
                    </>
                  )}
                </button>

                {onApproveDirectly && draftsQueue.length > 1 && (
                  <button
                    type="button"
                    onClick={handleApproveAll}
                    disabled={savingAll || translatingAll}
                    className="h-9 rounded-xl border border-emerald-600 bg-emerald-50 px-4 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 cursor-pointer shadow-xs"
                  >
                    {savingAll ? "Guardando lote..." : "Aprobar y guardar todas"}
                  </button>
                )}
              </div>
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

                          {/* Translation Status Badge */}
                          {isDraftTranslated(draft) ? (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200 flex items-center gap-1">
                              <span>🌐</span> 4 Idiomas listos (ES, EN, PT, IT)
                            </span>
                          ) : (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 border border-slate-200 flex items-center gap-1">
                              <span>🇪🇸</span> Solo Español
                            </span>
                          )}
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

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectDraftToEdit(ensureCustomBlocksInDraft(draft), index);
                          onClose();
                        }}
                        className="rounded-lg border border-[#00A9C6] bg-cyan-50 px-3.5 py-1.5 text-xs font-bold text-[#007D92] hover:bg-cyan-100 shadow-xs cursor-pointer"
                      >
                        📝 Pasar a Formulario Principal
                      </button>

                      <button
                        type="button"
                        onClick={() => handleTranslateDraft(index)}
                        disabled={translatingIndex === index || translatingAll}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition cursor-pointer disabled:opacity-50 ${
                          isDraftTranslated(draft)
                            ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                            : "border-sky-300 bg-sky-50 text-[#007D92] hover:bg-sky-100"
                        }`}
                        title="Traducir título, descripción, datos de oferente y bloques adicionales a Inglés, Portugués e Italiano"
                      >
                        {translatingIndex === index ? (
                          <>
                            <span className="inline-block animate-spin">⏳</span>
                            <span>Traduciendo...</span>
                          </>
                        ) : isDraftTranslated(draft) ? (
                          <>
                            <span>🔄</span>
                            <span>Re-traducir (EN, PT, IT)</span>
                          </>
                        ) : (
                          <>
                            <span>🌐</span>
                            <span>Traducir a EN, PT, IT</span>
                          </>
                        )}
                      </button>

                      {onApproveDirectly && (
                        <button
                          type="button"
                          onClick={() => handleApproveDraft(draft, index)}
                          disabled={savingIndex === index || translatingIndex === index || translatingAll}
                          className="rounded-lg bg-[#00A9C6] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0095AE] disabled:opacity-50 cursor-pointer shadow-xs"
                        >
                          {savingIndex === index ? "Guardando..." : "Aprobar y Guardar"}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleRemoveDraft(index)}
                        disabled={translatingIndex === index || translatingAll}
                        className="rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 cursor-pointer"
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

                  {/* Extra Description Blocks Status Pills */}
                  {draft.extraDescriptions && draft.extraDescriptions.length > 0 && (
                    <div className="rounded-xl border border-purple-100 bg-purple-50/40 p-2.5 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-purple-950 text-[11px]">
                          Bloques de Información ({draft.extraDescriptions.length}):
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {draft.extraDescriptions.map((blk, blkIdx) => {
                          const isSinDatos = blk.estado === "sin_datos" || (!blk.body && !blk.contenido);
                          const isParcial = blk.estado === "parcial";
                          return (
                            <div
                              key={blkIdx}
                              className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium border shadow-2xs ${
                                isSinDatos
                                  ? "bg-slate-100/90 text-slate-600 border-slate-200"
                                  : isParcial
                                  ? "bg-amber-50 text-amber-900 border-amber-200"
                                  : "bg-white text-purple-900 border-purple-200"
                              }`}
                              title={
                                isSinDatos
                                  ? "Sin datos explícitos en la web (bloque vacío)"
                                  : isParcial
                                  ? "Información parcial extraída"
                                  : "Información completa extraída"
                              }
                            >
                              <span className="font-semibold">{blk.title}</span>
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase tracking-wider ${
                                  isSinDatos
                                    ? "bg-slate-200 text-slate-700"
                                    : isParcial
                                    ? "bg-amber-200 text-amber-900"
                                    : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                }`}
                              >
                                {blk.estado || (isSinDatos ? "sin_datos" : "ok")}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
