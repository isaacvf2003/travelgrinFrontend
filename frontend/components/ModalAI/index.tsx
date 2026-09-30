import toast from "react-hot-toast";
import { useTranslation } from "@/app/hooks/useTranslation";
import { createPortal } from "react-dom";
import { useState, useEffect, useRef } from "react";

export type FieldTargetType = "description" | "included" | "notIncluded" | "title";

const AI_I18N = {
  es: {
    asistente_ia: "Asistente IA",
    destacado: "Destacado",
    en_linea: "En línea",
    reiniciar_chat: "Reiniciar chat",
    cerrar: "Cerrar",
    escribiendo: "El Asistente está escribiendo...",
    enviar: "Enviar",
    placeholder_included: "Describe qué incluye tu servicio...",
    placeholder_not_included: "Describe qué no incluye...",
    placeholder_title: "Ideas o palabras clave para tu título...",
    placeholder_description: "Describe tu servicio con tus palabras...",
    btn_accept_apply: "Aceptar y aplicar en el formulario",
    btn_another_option: "Dame otra opción",
    toast_included_updated: "¡Campo '¿Qué incluye?' actualizado!",
    toast_not_included_updated: "¡Campo '¿Qué NO incluye?' actualizado!",
    toast_title_updated: "¡Título de publicación actualizado!",
    toast_desc_updated: "¡Descripción actualizada correctamente!",
    toast_error_gen: "Error al generar contenido con IA",
    bot_applied_confirmation: "¡Perfecto! He aplicado los cambios directamente en tu formulario. Tu propuesta destacada luce mucho más atractiva para los viajeros.",
    bot_error_message: "Disculpa, hubo un error al generar. Por favor inténtalo de nuevo.",
    bot_proposal_intro: (target: string, content: string) => `He preparado esta propuesta para "${target}":\n\n"${content}"\n\n¿Te gusta cómo quedó?`,
    target_labels: {
      included: "¿Qué incluye?",
      notIncluded: "¿Qué NO incluye?",
      title: "Título",
      description: "Descripción",
    },
    featured_initial_greeting: "Hola 👋, veo que estás configurando tu Publicación Destacada. Puedo ayudarte a redactar y optimizar:",
    btn_improve_included: "✨ Mejorar \"¿Qué incluye?\" de mi propuesta",
    btn_improve_not_included: "🛡️ Redactar \"¿Qué NO incluye?\"",
    btn_improve_title: "🎯 Optimizar Título de la publicación",
    btn_featured_doubts: "ℹ️ Dudas sobre la publicación destacada",
    user_msg_improve_included: "Mejorar '¿Qué incluye?' de mi propuesta",
    user_msg_improve_not_included: "Redactar '¿Qué NO incluye?'",
    user_msg_improve_title: "Optimizar el Título de mi publicación destacada",
    user_msg_featured_doubts: "Dudas sobre la publicación destacada",
    bot_included_detected: (val: string) => `Detecté lo que pusiste en '¿Qué incluye?':\n\n"${val}"\n\nContame qué más querés sumar, resaltar o aclarar, o presioná enviar para que te arme una versión estructurada y atractiva para viajeros con viñetas.`,
    bot_included_empty: "Contame con tus palabras qué incluye tu servicio para el viajero (ej. traslados, clases, materiales, asesoría personalizada, soporte 24/7, etc.), y te redactaré un detalle claro, profesional y estructurado.",
    bot_not_included_detected: (val: string) => `Detecté tu texto actual en '¿Qué NO incluye?':\n\n"${val}"\n\n¿Querés agregar alguna exclusión adicional para que los viajeros tengan expectativas 100% claras?`,
    bot_not_included_empty: "Aclarar qué NO incluye tu propuesta genera gran confianza. Contame qué cosas no están cubiertas (ej: pasajes aéreos, gastos personales, tasas de visado, comidas) y te armo una redacción profesional.",
    bot_title_detected: (val: string) => `Tu título actual es: "${val}". Contame qué enfoque preferís o dejame sugerirte opciones atractivas y de alto impacto.`,
    bot_title_empty: "Contame brevemente tu servicio y destino para redactarte títulos atractivos, profesionales y de alto impacto para viajeros.",
    bot_featured_doubts_answer: "⭐ Las publicaciones destacadas tienen máxima visibilidad en los primeros lugares del marketplace, badge oficial de Destacado, permiten subir hasta 5 fotos, logo oficial, links directos de contacto (WhatsApp, web, redes) y detallar todo lo que incluye tu servicio para que los viajeros conecten directamente con vos.",
  },
  en: {
    asistente_ia: "AI Assistant",
    destacado: "Featured",
    en_linea: "Online",
    reiniciar_chat: "Restart chat",
    cerrar: "Close",
    escribiendo: "Assistant is typing...",
    enviar: "Send",
    placeholder_included: "Describe what your service includes...",
    placeholder_not_included: "Describe what is not included...",
    placeholder_title: "Ideas or keywords for your title...",
    placeholder_description: "Describe your service in your own words...",
    btn_accept_apply: "Accept and apply to form",
    btn_another_option: "Give me another option",
    toast_included_updated: "Field 'What's included' updated!",
    toast_not_included_updated: "Field 'What's NOT included' updated!",
    toast_title_updated: "Publication title updated!",
    toast_desc_updated: "Description updated successfully!",
    toast_error_gen: "Error generating content with AI",
    bot_applied_confirmation: "Great! I have applied the changes directly to your form. Your featured listing looks much more appealing to travelers.",
    bot_error_message: "Sorry, an error occurred during generation. Please try again.",
    bot_proposal_intro: (target: string, content: string) => `I have prepared this proposal for "${target}":\n\n"${content}"\n\nDo you like how it looks?`,
    target_labels: {
      included: "What's included",
      notIncluded: "What's NOT included",
      title: "Title",
      description: "Description",
    },
    featured_initial_greeting: "Hello 👋, I see you are setting up your Featured Publication. I can help you draft and optimize:",
    btn_improve_included: "✨ Improve \"What's included?\" in my offer",
    btn_improve_not_included: "🛡️ Draft \"What's NOT included?\"",
    btn_improve_title: "🎯 Optimize Publication Title",
    btn_featured_doubts: "ℹ️ Questions about Featured Listing",
    user_msg_improve_included: "Improve 'What's included?' in my offer",
    user_msg_improve_not_included: "Draft 'What's NOT included?'",
    user_msg_improve_title: "Optimize the Title of my featured publication",
    user_msg_featured_doubts: "Questions about Featured Listing",
    bot_included_detected: (val: string) => `I noticed what you entered in 'What's included?':\n\n"${val}"\n\nTell me what else you'd like to highlight or clarify, or press send so I can create a structured, high-converting bulleted list for travelers.`,
    bot_included_empty: "Tell me in your own words what your service includes for travelers (e.g. airport pickups, classes, materials, 1-on-1 guidance, 24/7 support), and I will create a structured, professional overview.",
    bot_not_included_detected: (val: string) => `I noticed your current text in 'What's NOT included?':\n\n"${val}"\n\nWould you like to add any other exclusions to set 100% clear expectations?`,
    bot_not_included_empty: "Clarifying what is NOT included builds huge trust with travelers. Tell me what is not covered (e.g. flight tickets, visa fees, personal expenses, meals) and I will format it professionally.",
    bot_title_detected: (val: string) => `Your current title is: "${val}". Tell me what style you prefer or let me suggest high-impact, catchy alternatives.`,
    bot_title_empty: "Tell me briefly about your service and destination so I can generate catchy, professional, high-impact titles for travelers.",
    bot_featured_doubts_answer: "⭐ Featured publications receive top placement in search results, an official Featured badge, up to 5 photos, your brand logo, direct contact buttons (WhatsApp, website, social media), and structured inclusions so travelers connect directly with you.",
  },
  pt: {
    asistente_ia: "Assistente IA",
    destacado: "Destaque",
    en_linea: "Online",
    reiniciar_chat: "Reiniciar chat",
    cerrar: "Fechar",
    escribiendo: "O Assistente está digitando...",
    enviar: "Enviar",
    placeholder_included: "Descreva o que seu serviço inclui...",
    placeholder_not_included: "Descreva o que não está incluído...",
    placeholder_title: "Ideias ou palavras-chave para seu título...",
    placeholder_description: "Descreva seu serviço com suas próprias palavras...",
    btn_accept_apply: "Aceitar e aplicar no formulário",
    btn_another_option: "Me dê outra opção",
    toast_included_updated: "Campo 'O que inclui?' atualizado!",
    toast_not_included_updated: "Campo 'O que NÃO inclui?' atualizado!",
    toast_title_updated: "Título da publicação atualizado!",
    toast_desc_updated: "Descrição atualizada com sucesso!",
    toast_error_gen: "Erro ao gerar conteúdo com IA",
    bot_applied_confirmation: "Perfeito! Apliquei as alterações diretamente no seu formulário. Sua proposta em destaque está muito mais atraente para os viajantes.",
    bot_error_message: "Desculpe, ocorreu um erro ao gerar. Por favor, tente novamente.",
    bot_proposal_intro: (target: string, content: string) => `Preparei esta proposta para "${target}":\n\n"${content}"\n\nGostou do resultado?`,
    target_labels: {
      included: "O que inclui",
      notIncluded: "O que NÃO inclui",
      title: "Título",
      description: "Descrição",
    },
    featured_initial_greeting: "Olá 👋, vejo que você está configurando sua Publicação em Destaque. Posso te ajudar a redigir e otimizar:",
    btn_improve_included: "✨ Melhorar \"O que inclui?\" na minha proposta",
    btn_improve_not_included: "🛡️ Redigir \"O que NÃO inclui?\"",
    btn_improve_title: "🎯 Otimizar Título da publicação",
    btn_featured_doubts: "ℹ️ Dúvidas sobre publicação em destaque",
    user_msg_improve_included: "Melhorar 'O que inclui?' na minha proposta",
    user_msg_improve_not_included: "Redigir 'O que NÃO inclui?'",
    user_msg_improve_title: "Otimizar o Título da minha publicação em destaque",
    user_msg_featured_doubts: "Dúvidas sobre a publicação em destaque",
    bot_included_detected: (val: string) => `Detectei o que você colocou em 'O que inclui?':\n\n"${val}"\n\nConte-me o que mais deseja adicionar ou destacar, ou envie para eu criar uma versão estruturada e atraente com tópicos.`,
    bot_included_empty: "Conte-me com suas palavras o que seu serviço inclui para o viajante (ex: traslados, aulas, materiais, assessoria personalizada, suporte 24/7, etc.) e redigirei um detalhamento claro e profissional.",
    bot_not_included_detected: (val: string) => `Detectei seu texto atual em 'O que NÃO inclui?':\n\n"${val}"\n\nDeseja adicionar alguma exclusão para que os viajantes tenham expectativas 100% claras?`,
    bot_not_included_empty: "Esclarecer o que NÃO está incluso gera muita confiança. Conte-me o que não é coberto (ex: passagens aéreas, despesas pessoais, taxas de visto, refeições) e criarei uma redação profissional.",
    bot_title_detected: (val: string) => `Seu título atual é: "${val}". Conte-me qual estilo prefere ou deixe-me sugerir opções atraentes de alto impacto.`,
    bot_title_empty: "Conte-me brevemente sobre seu serviço e destino para eu redigir títulos atraentes, profissionais e de alto impacto para viajantes.",
    bot_featured_doubts_answer: "⭐ As publicações em destaque têm visibilidade máxima no topo do marketplace, selo oficial de Destaque, permitem até 5 fotos, logotipo oficial, links diretos de contato (WhatsApp, site, redes sociais) e detalhamento completo para viajantes entrarem em contato direto com você.",
  },
  it: {
    asistente_ia: "Assistente IA",
    destacado: "In Evidenza",
    en_linea: "In linea",
    reiniciar_chat: "Riavvia chat",
    cerrar: "Chiudi",
    escribiendo: "L'Assistente sta scrivendo...",
    enviar: "Invia",
    placeholder_included: "Descrivi cosa include il tuo servizio...",
    placeholder_not_included: "Descrivi cosa non è incluso...",
    placeholder_title: "Idee o parole chiave per il tuo titolo...",
    placeholder_description: "Descrivi il tuo servizio con parole tue...",
    btn_accept_apply: "Accetta e applica nel modulo",
    btn_another_option: "Dammi un'altra opzione",
    toast_included_updated: "Campo 'Cosa include?' aggiornato!",
    toast_not_included_updated: "Campo 'Cosa NON include?' aggiornato!",
    toast_title_updated: "Titolo della pubblicazione aggiornato!",
    toast_desc_updated: "Descrizione aggiornata con successo!",
    toast_error_gen: "Errore durante la generazione dei contenuti con IA",
    bot_applied_confirmation: "Perfetto! Ho applicato le modifiche direttamente nel tuo modulo. La tua proposta in evidenza è molto più attraente per i viaggiatori.",
    bot_error_message: "Spiacenti, si è verificato un errore durante la generazione. Riprova per favore.",
    bot_proposal_intro: (target: string, content: string) => `Ho preparato questa proposta per "${target}":\n\n"${content}"\n\nTi piace come è venuta?`,
    target_labels: {
      included: "Cosa include",
      notIncluded: "Cosa NON include",
      title: "Titolo",
      description: "Descrizione",
    },
    featured_initial_greeting: "Ciao 👋, vedo che stai configurando la tua Pubblicazione in Evidenza. Posso aiutarti a redigere e ottimizzare:",
    btn_improve_included: "✨ Migliora \"Cosa include?\" della mia proposta",
    btn_improve_not_included: "🛡️ Redigi \"Cosa NON include?\"",
    btn_improve_title: "🎯 Ottimizza Titolo della pubblicazione",
    btn_featured_doubts: "ℹ️ Dubbi sulla pubblicazione in evidenza",
    user_msg_improve_included: "Migliora 'Cosa include?' della mia proposta",
    user_msg_improve_not_included: "Redigi 'Cosa NON include?'",
    user_msg_improve_title: "Ottimizza il Titolo della mia pubblicazione in evidenza",
    user_msg_featured_doubts: "Dubbi sulla pubblicazione in evidenza",
    bot_included_detected: (val: string) => `Ho rilevato quello che hai inserito in 'Cosa include?':\n\n"${val}"\n\nDimmi cosa vorresti aggiungere o evidenziare, oppure premi invia per creare una versione strutturata ed efficace con elenchi puntati.`,
    bot_included_empty: "Raccontami con parole tue cosa include il tuo servizio per il viaggiatore (es. trasferimenti, lezioni, materiali, consulenza personalizzata, supporto 24/7, ecc.) e redigerò un dettaglio chiaro e professionale.",
    bot_not_included_detected: (val: string) => `Ho rilevato il tuo testo attuale in 'Cosa NON include?':\n\n"${val}"\n\nVuoi aggiungere qualche esclusione per dare ai viaggiatori aspettative chiare al 100%?`,
    bot_not_included_empty: "Chiarire cosa NON è incluso genera grande fiducia. Dimmi cosa non è coperto (es. voli aerei, spese personali, tasse di visto, pasti) e ti preparerò una descrizione professionale.",
    bot_title_detected: (val: string) => `Il tuo titolo attuale è: "${val}". Dimmi quale stile preferisci o lascia che ti suggerisca opzioni accattivanti e ad alto impatto.`,
    bot_title_empty: "Raccontami brevemente il tuo servizio e destinazione per redigere titoli accattivanti, professionali e ad alto impatto per viaggiatori.",
    bot_featured_doubts_answer: "⭐ Le pubblicazioni in evidenza hanno la massima visibilità in cima al marketplace, badge ufficiale In Evidenza, fino a 5 foto, logo ufficiale, link diretti di contatto (WhatsApp, sito web, social) e descrizione dettagliata dei servizi inclusi per permettere ai viaggiatori di contattarti direttamente.",
  }
};

export default function ModalAI({
  onClose,
  step = "basic",
  description,
  setDescription,
  included,
  setIncluded,
  notIncluded,
  setNotIncluded,
  publicationTitle,
  setPublicationTitle,
  typeProfile,
  selectedCategory,
  isOfrezco,
  isIntermediario,
  destinationCountry,
  contanos,
  website,
  country,
  fieldTarget = "description",
}: {
  onClose: () => void;
  step?: "basic" | "featured";
  description?: string;
  setDescription?: (desc: string) => void;
  included?: string;
  setIncluded?: (inc: string) => void;
  notIncluded?: string;
  setNotIncluded?: (notInc: string) => void;
  publicationTitle?: string;
  setPublicationTitle?: (title: string) => void;
  typeProfile?: string;
  selectedCategory?: string;
  isOfrezco?: boolean;
  isIntermediario?: boolean;
  destinationCountry?: string;
  contanos?: string;
  website?: string;
  country?: string;
  fieldTarget?: FieldTargetType;
}) {
  const { t, locale } = useTranslation();
  const currentLang = (locale as keyof typeof AI_I18N) || "es";
  const strings = AI_I18N[currentLang] || AI_I18N.es;

  const [userInput, setUserInput] = useState("");
  const [currentStep, setCurrentStep] = useState("initial");
  const [activeTarget, setActiveTarget] = useState<FieldTargetType>(
    step === "featured" ? (fieldTarget || "included") : (fieldTarget || "description")
  );
  const [showDescriptionInput, setShowDescriptionInput] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [suggestedContent, setSuggestedContent] = useState("");
  const [isInitialized, setIsInitialized] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      scrollToBottom();
    }, 100);
    return () => clearTimeout(timer);
  }, [messages, isGenerating, showDescriptionInput]);

  const getCurrentTimestamp = () => {
    return new Date()
      .toLocaleTimeString(locale === "en" ? "en-US" : locale === "pt" ? "pt-BR" : locale === "it" ? "it-IT" : "es-ES", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
      .toLowerCase();
  };

  const storageSuffix = `${step}_${activeTarget}_${locale}`;
  const CHAT_STORAGE_KEY = `travelgrin_ai_chat_${storageSuffix}`;
  const CHAT_TIMESTAMP_KEY = `travelgrin_ai_chat_timestamp_${storageSuffix}`;
  const WAITING_FIELDS_KEY = `travelgrin_ai_waiting_fields_${storageSuffix}`;

  const getInitialBotMessage = () => {
    if (step === "featured") {
      return {
        id: 1,
        type: "bot",
        content: strings.featured_initial_greeting,
        timestamp: getCurrentTimestamp(),
        showFeaturedButtons: true,
      };
    }

    return {
      id: 1,
      type: "bot",
      content: t("hola_ia_inicial") || "Hola 👋, soy la IA de Travelgrin y puedo ayudarte con:",
      timestamp: getCurrentTimestamp(),
      showInitialButtons: true,
    };
  };

  const loadMessagesFromStorage = () => {
    try {
      const stored = localStorage.getItem(CHAT_STORAGE_KEY);
      const timestamp = localStorage.getItem(CHAT_TIMESTAMP_KEY);

      if (stored && timestamp) {
        const now = Date.now();
        const storedTime = parseInt(timestamp);
        const tenMinutes = 10 * 60 * 1000;

        if (now - storedTime > tenMinutes) {
          localStorage.removeItem(CHAT_STORAGE_KEY);
          localStorage.removeItem(CHAT_TIMESTAMP_KEY);
          localStorage.removeItem(WAITING_FIELDS_KEY);
        } else {
          return JSON.parse(stored);
        }
      }
    } catch (error) {
      console.error("Error loading messages from localStorage:", error);
    }

    return [getInitialBotMessage()];
  };

  const saveMessagesToStorage = (msgs: any[]) => {
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(msgs));
      localStorage.setItem(CHAT_TIMESTAMP_KEY, Date.now().toString());
    } catch (error) {
      console.error("Error saving messages to localStorage:", error);
    }
  };

  const clearChatStorage = () => {
    try {
      localStorage.removeItem(CHAT_STORAGE_KEY);
      localStorage.removeItem(CHAT_TIMESTAMP_KEY);
      localStorage.removeItem(WAITING_FIELDS_KEY);
    } catch (error) {
      console.error("Error clearing chat storage:", error);
    }
  };

  useEffect(() => {
    const initialMessages = loadMessagesFromStorage();
    setMessages(initialMessages);
    setIsInitialized(true);
    const hasDescriptionInput = initialMessages.some((msg: any) => msg.showDescriptionInput);
    if (hasDescriptionInput) {
      setShowDescriptionInput(true);
    }
  }, [step, locale]);

  useEffect(() => {
    if (fieldTarget) {
      setActiveTarget(fieldTarget);
    }
  }, [fieldTarget]);

  useEffect(() => {
    if (messages.length > 0 && isInitialized) {
      saveMessagesToStorage(messages);
    }
  }, [messages, isInitialized]);

  const restartChat = () => {
    clearChatStorage();
    setMessages([getInitialBotMessage()]);
    setSuggestedContent("");
    setShowDescriptionInput(false);
    setCurrentStep("initial");
  };

  // 1. DUDA DE CALIFICACIÓN (BASIC STEP)
  const handleQualificationDubt = () => {
    const userMessage = {
      id: messages.length + 1,
      type: "user",
      content: t("tengo_dudas"),
      timestamp: getCurrentTimestamp(),
    };

    let botResponse;
    if (selectedCategory) {
      botResponse = {
        id: messages.length + 2,
        type: "bot",
        content: t("experiencia_pregunta").replace("{{categoria}}", selectedCategory),
        timestamp: getCurrentTimestamp(),
        showExperienceButtons: true,
      };
    } else {
      botResponse = {
        id: messages.length + 2,
        type: "bot",
        content: t("para_ayudarte"),
        timestamp: getCurrentTimestamp(),
        showCategoryButtons: true,
      };
    }

    setMessages((prev) => [...prev, userMessage, botResponse]);
    setCurrentStep("qualification");
  };

  const handleExperience = (hasExperience: boolean) => {
    const userMessage = {
      id: messages.length + 1,
      type: "user",
      content: hasExperience ? t("si") : t("no"),
      timestamp: getCurrentTimestamp(),
    };

    const botResponse = {
      id: messages.length + 2,
      type: "bot",
      content: hasExperience ? t("perfect") : t("por_ahora_no_califica"),
      timestamp: getCurrentTimestamp(),
    };

    setMessages((prev) => [...prev, userMessage, botResponse]);
  };

  const handleCategoryResponse = (hasCategory: boolean) => {
    const userMessage = {
      id: messages.length + 1,
      type: "user",
      content: hasCategory ? t("si") : t("no"),
      timestamp: getCurrentTimestamp(),
    };

    const botResponse = {
      id: messages.length + 2,
      type: "bot",
      content: hasCategory ? t("perfecto_tu_propuesta") : t("no_califica_por_ahora"),
      timestamp: getCurrentTimestamp(),
    };

    setMessages((prev) => [...prev, userMessage, botResponse]);
  };

  // 2. MEJORAR DESCRIPCIÓN (BASIC STEP)
  const handleDescriptionImprovement = () => {
    setActiveTarget("description");
    const userMessage = {
      id: messages.length + 1,
      type: "user",
      content: t("mejora_description"),
      timestamp: getCurrentTimestamp(),
    };

    let botResponse;
    if (description && description.trim()) {
      botResponse = {
        id: messages.length + 2,
        type: "bot",
        content: t("detecte"),
        timestamp: getCurrentTimestamp(),
        showDescriptionInput: true,
      };
      setUserInput(description);
    } else {
      botResponse = {
        id: messages.length + 2,
        type: "bot",
        content: t("contame_con_tus_palabras"),
        timestamp: getCurrentTimestamp(),
        showDescriptionInput: true,
      };
      setUserInput("");
    }
    setShowDescriptionInput(true);
    setMessages((prev) => [...prev, userMessage, botResponse]);
    setCurrentStep("description");
  };

  // 3. FEATURED STEP: MEJORAR "¿QUÉ INCLUYE?"
  const handleImproveIncluded = () => {
    setActiveTarget("included");
    const userMessage = {
      id: messages.length + 1,
      type: "user",
      content: strings.user_msg_improve_included,
      timestamp: getCurrentTimestamp(),
    };

    let botResponse;
    if (included && included.trim()) {
      botResponse = {
        id: messages.length + 2,
        type: "bot",
        content: strings.bot_included_detected(included),
        timestamp: getCurrentTimestamp(),
        showDescriptionInput: true,
      };
      setUserInput(included);
    } else {
      botResponse = {
        id: messages.length + 2,
        type: "bot",
        content: strings.bot_included_empty,
        timestamp: getCurrentTimestamp(),
        showDescriptionInput: true,
      };
      setUserInput("");
    }

    setShowDescriptionInput(true);
    setMessages((prev) => [...prev, userMessage, botResponse]);
    setCurrentStep("included");
  };

  // 4. FEATURED STEP: REDACTAR "¿QUÉ NO INCLUYE?"
  const handleImproveNotIncluded = () => {
    setActiveTarget("notIncluded");
    const userMessage = {
      id: messages.length + 1,
      type: "user",
      content: strings.user_msg_improve_not_included,
      timestamp: getCurrentTimestamp(),
    };

    let botResponse;
    if (notIncluded && notIncluded.trim()) {
      botResponse = {
        id: messages.length + 2,
        type: "bot",
        content: strings.bot_not_included_detected(notIncluded),
        timestamp: getCurrentTimestamp(),
        showDescriptionInput: true,
      };
      setUserInput(notIncluded);
    } else {
      botResponse = {
        id: messages.length + 2,
        type: "bot",
        content: strings.bot_not_included_empty,
        timestamp: getCurrentTimestamp(),
        showDescriptionInput: true,
      };
      setUserInput("");
    }

    setShowDescriptionInput(true);
    setMessages((prev) => [...prev, userMessage, botResponse]);
    setCurrentStep("notIncluded");
  };

  // 5. FEATURED STEP: OPTIMIZAR TÍTULO
  const handleImproveTitle = () => {
    setActiveTarget("title");
    const userMessage = {
      id: messages.length + 1,
      type: "user",
      content: strings.user_msg_improve_title,
      timestamp: getCurrentTimestamp(),
    };

    let botResponse;
    if (publicationTitle && publicationTitle.trim()) {
      botResponse = {
        id: messages.length + 2,
        type: "bot",
        content: strings.bot_title_detected(publicationTitle),
        timestamp: getCurrentTimestamp(),
        showDescriptionInput: true,
      };
      setUserInput(publicationTitle);
    } else {
      botResponse = {
        id: messages.length + 2,
        type: "bot",
        content: strings.bot_title_empty,
        timestamp: getCurrentTimestamp(),
        showDescriptionInput: true,
      };
      setUserInput("");
    }

    setShowDescriptionInput(true);
    setMessages((prev) => [...prev, userMessage, botResponse]);
    setCurrentStep("title");
  };

  // 6. FEATURED STEP: DUDAS DESTACADO
  const handleFeaturedDoubt = () => {
    const userMessage = {
      id: messages.length + 1,
      type: "user",
      content: strings.user_msg_featured_doubts,
      timestamp: getCurrentTimestamp(),
    };

    const botResponse = {
      id: messages.length + 2,
      type: "bot",
      content: strings.bot_featured_doubts_answer,
      timestamp: getCurrentTimestamp(),
    };

    setMessages((prev) => [...prev, userMessage, botResponse]);
  };

  // LLAMADA A LA API DE GENERACIÓN
  const generateContent = async (userMessageText?: string) => {
    setIsGenerating(true);

    try {
      const actingAs =
        isOfrezco && isIntermediario
          ? "Ambos"
          : isOfrezco
          ? "Directo"
          : isIntermediario
          ? "Intermediario"
          : "No especificado";

      const currentFieldValue =
        activeTarget === "included"
          ? included
          : activeTarget === "notIncluded"
          ? notIncluded
          : activeTarget === "title"
          ? publicationTitle
          : description;

      const messageToSend = userMessageText || userInput || currentFieldValue || "";

      const response = await fetch("/api/generate-description", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          typeProfile,
          selectedCategory,
          actingAs,
          userMessage: messageToSend,
          language: locale,
          currentDescription: currentFieldValue,
          fieldTarget: activeTarget,
          destinationCountry,
          website,
          country,
          baseDescription: contanos || description,
        }),
      });

      if (!response.ok) {
        throw new Error("Error al generar contenido");
      }

      const data = await response.json();
      const generated = data.description;

      setSuggestedContent(generated);

      const targetLabel = strings.target_labels[activeTarget] || activeTarget;

      const newBotMessage = {
        id: messages.length + 1,
        type: "bot",
        content: strings.bot_proposal_intro(targetLabel, generated),
        timestamp: getCurrentTimestamp(),
        showApplyButtons: true,
      };

      setMessages((prev) => [...prev, newBotMessage]);
      setUserInput("");
      setShowDescriptionInput(false);
    } catch (error) {
      console.error("Error:", error);
      toast.error(strings.toast_error_gen || t("error_desc") || "Error al generar contenido");

      const errorMessage = {
        id: messages.length + 1,
        type: "bot",
        content: strings.bot_error_message || t("disculpa") || "Disculpa, hubo un error al generar. Por favor inténtalo de nuevo.",
        timestamp: getCurrentTimestamp(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsGenerating(false);
    }
  };

  // ACEPTAR Y APLICAR EN EL FORMULARIO
  const acceptContent = () => {
    if (!suggestedContent) return;

    if (activeTarget === "included" && setIncluded) {
      setIncluded(suggestedContent);
      toast.success(strings.toast_included_updated);
    } else if (activeTarget === "notIncluded" && setNotIncluded) {
      setNotIncluded(suggestedContent);
      toast.success(strings.toast_not_included_updated);
    } else if (activeTarget === "title" && setPublicationTitle) {
      setPublicationTitle(suggestedContent);
      toast.success(strings.toast_title_updated);
    } else if (setDescription) {
      setDescription(suggestedContent);
      toast.success(strings.toast_desc_updated || t("success_desc") || "¡Descripción actualizada correctamente!");
    }

    const confirmMessage = {
      id: messages.length + 1,
      type: "bot",
      content: strings.bot_applied_confirmation,
      timestamp: getCurrentTimestamp(),
    };

    setMessages((prev) => [...prev, confirmMessage]);
  };

  const generateAnotherOption = () => {
    const requestMessage = {
      id: messages.length + 1,
      type: "user",
      content: strings.btn_another_option || t("dame_otra") || "Dame otra opción",
      timestamp: getCurrentTimestamp(),
    };

    setMessages((prev) => [...prev, requestMessage]);
    generateContent(
      locale === "en"
        ? "Generate a different, catchy and more creative option"
        : locale === "pt"
        ? "Gere uma opção diferente, atraente e mais criativa"
        : locale === "it"
        ? "Genera un'opzione diversa, accattivante e più creativa"
        : "Genera una opción diferente, atractiva y más creativa"
    );
  };

  const sendInputMessage = () => {
    if (userInput.trim()) {
      const userMessage = {
        id: messages.length + 1,
        type: "user",
        content: userInput,
        timestamp: getCurrentTimestamp(),
      };

      setMessages((prev) => [...prev, userMessage]);
      generateContent(userInput);
      setTimeout(() => scrollToBottom(), 50);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !isGenerating && showDescriptionInput) {
      sendInputMessage();
    }
  };

  const modalAIContent = (
    <>
      <div
        className="fixed inset-0 bg-transparent z-[9999999998]"
        onClick={onClose}
      />

      <div
        className="fixed bottom-4 right-4"
        style={{
          zIndex: 9999999999,
          pointerEvents: "auto",
        }}
      >
        <div
          className="bg-white rounded-2xl shadow-2xl w-84 sm:w-96 h-[28rem] flex flex-col border border-slate-200/80"
          style={{
            zIndex: 10000000000,
            WebkitFontSmoothing: "antialiased",
            MozOsxFontSmoothing: "grayscale",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex-shrink-0 bg-gradient-to-r from-[#00A9C6] to-[#008299] text-white p-3.5 rounded-t-2xl relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-sm shadow-inner">
                  🤖
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-white flex items-center gap-1.5">
                    {strings.asistente_ia}
                    {step === "featured" ? (
                      <span className="rounded-md bg-amber-400/30 px-1.5 py-0.5 text-[10px] font-bold text-amber-100">
                        {strings.destacado}
                      </span>
                    ) : null}
                  </h3>
                  <p className="text-[11px] text-cyan-100 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
                    {strings.en_linea}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-1.5">
                <button
                  onClick={restartChat}
                  className="text-white/80 hover:text-white hover:bg-white/20 rounded-full p-1.5 transition-colors"
                  title={strings.reiniciar_chat}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>

                <button
                  onClick={onClose}
                  className="text-white/80 hover:text-white hover:bg-white/20 rounded-full p-1.5 transition-colors"
                  title={strings.cerrar}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Messages Area */}
          <div
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto p-3.5 bg-slate-50 space-y-3"
          >
            {messages.map((message) => (
              <div key={message.id} className="flex items-start space-x-2">
                {message.type === "bot" && (
                  <div className="w-6 h-6 bg-[#00A9C6] rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs shadow-sm">
                    🤖
                  </div>
                )}

                <div
                  className={`rounded-2xl p-3 shadow-sm max-w-[85%] ${
                    message.type === "bot"
                      ? "bg-white text-slate-800 rounded-tl-none border border-slate-100"
                      : "bg-[#00A9C6] text-white rounded-tr-none ml-auto"
                  }`}
                >
                  <p className="text-xs whitespace-pre-line leading-relaxed font-normal">
                    {message.content}
                  </p>

                  {/* Botones iniciales FEATURED STEP */}
                  {message.showFeaturedButtons && (
                    <div className="flex flex-col space-y-2 mt-3">
                      <button
                        onClick={handleImproveIncluded}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl text-xs font-semibold shadow-sm transition transform hover:scale-[1.01] text-left flex items-center gap-1.5"
                      >
                        {strings.btn_improve_included}
                      </button>
                      <button
                        onClick={handleImproveNotIncluded}
                        className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-xl text-xs font-semibold shadow-sm transition transform hover:scale-[1.01] text-left flex items-center gap-1.5"
                      >
                        {strings.btn_improve_not_included}
                      </button>
                      <button
                        onClick={handleImproveTitle}
                        className="bg-sky-600 hover:bg-sky-700 text-white px-3 py-1.5 rounded-xl text-xs font-semibold shadow-sm transition transform hover:scale-[1.01] text-left flex items-center gap-1.5"
                      >
                        {strings.btn_improve_title}
                      </button>
                      <button
                        onClick={handleFeaturedDoubt}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-xl text-xs font-medium transition text-left flex items-center gap-1.5"
                      >
                        {strings.btn_featured_doubts}
                      </button>
                    </div>
                  )}

                  {/* Botones iniciales BASIC STEP */}
                  {message.showInitialButtons && (
                    <div className="flex flex-col space-y-2 mt-3">
                      <button
                        onClick={handleQualificationDubt}
                        className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-xl text-xs font-semibold shadow-sm transition text-left"
                      >
                        {t("dudas_califico") || "Tengo dudas si califico para Travelgrin"}
                      </button>
                      <button
                        onClick={handleDescriptionImprovement}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl text-xs font-semibold shadow-sm transition text-left"
                      >
                        {t("mejorar_descripcion") || "Mejorar la descripción de mi propuesta"}
                      </button>
                    </div>
                  )}

                  {/* Botones de experiencia */}
                  {message.showExperienceButtons && (
                    <div className="flex flex-row space-x-2 mt-3">
                      <button
                        onClick={() => handleExperience(true)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1 rounded-full text-xs font-semibold transition"
                      >
                        {t("si") || "Sí"}
                      </button>
                      <button
                        onClick={() => handleExperience(false)}
                        className="bg-rose-500 hover:bg-rose-600 text-white px-3.5 py-1 rounded-full text-xs font-semibold transition"
                      >
                        {t("no") || "No"}
                      </button>
                    </div>
                  )}

                  {/* Botones de categoría */}
                  {message.showCategoryButtons && (
                    <div className="flex flex-row space-x-2 mt-3">
                      <button
                        onClick={() => handleCategoryResponse(true)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1 rounded-full text-xs font-semibold transition"
                      >
                        {t("si") || "Sí"}
                      </button>
                      <button
                        onClick={() => handleCategoryResponse(false)}
                        className="bg-rose-500 hover:bg-rose-600 text-white px-3.5 py-1 rounded-full text-xs font-semibold transition"
                      >
                        {t("no") || "No"}
                      </button>
                    </div>
                  )}

                  {/* Botones de Aceptar / Otra Opción */}
                  {message.showApplyButtons && (
                    <div className="flex flex-col space-y-2 mt-3">
                      <button
                        onClick={acceptContent}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl text-xs font-semibold shadow-sm transition flex items-center justify-center gap-1.5"
                      >
                        <span>✅</span> {strings.btn_accept_apply}
                      </button>
                      <button
                        onClick={generateAnotherOption}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-xl text-xs font-medium transition flex items-center justify-center gap-1.5"
                        disabled={isGenerating}
                      >
                        <span>🔄</span> {strings.btn_another_option}
                      </button>
                    </div>
                  )}

                  <span className="text-[10px] text-slate-400 mt-1 block">
                    {message.timestamp}
                  </span>
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isGenerating && (
              <div className="flex items-start space-x-2">
                <div className="w-6 h-6 bg-[#00A9C6] rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs">
                  🤖
                </div>
                <div className="bg-white rounded-2xl rounded-tl-none p-3 shadow-sm border border-slate-100">
                  <p className="text-xs text-slate-600 mb-1.5">{strings.escribiendo}</p>
                  <div className="flex space-x-1">
                    <div className="w-1.5 h-1.5 bg-[#00A9C6] rounded-full animate-bounce"></div>
                    <div className="w-1.5 h-1.5 bg-[#00A9C6] rounded-full animate-bounce [animation-delay:0.15s]"></div>
                    <div className="w-1.5 h-1.5 bg-[#00A9C6] rounded-full animate-bounce [animation-delay:0.3s]"></div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} style={{ height: "1px" }} />
          </div>

          {/* Input Area */}
          {showDescriptionInput && (
            <div className="flex-shrink-0 p-3 bg-white border-t border-slate-200 rounded-b-2xl">
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={
                    activeTarget === "included"
                      ? strings.placeholder_included
                      : activeTarget === "notIncluded"
                      ? strings.placeholder_not_included
                      : activeTarget === "title"
                      ? strings.placeholder_title
                      : strings.placeholder_description
                  }
                  disabled={isGenerating}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-full focus:outline-none focus:ring-2 focus:ring-[#00A9C6] focus:border-transparent text-slate-800"
                />

                <button
                  onClick={sendInputMessage}
                  disabled={isGenerating || !userInput.trim()}
                  className="bg-[#00A9C6] hover:bg-[#008299] text-white rounded-full p-2 transition disabled:bg-slate-300"
                  title={strings.enviar}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );

  return createPortal(modalAIContent, document.body);
}
