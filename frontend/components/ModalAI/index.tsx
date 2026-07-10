import toast from "react-hot-toast";
import ButtonSolid from "../ButtonSolid";
import { useTranslation } from "@/app/hooks/useTranslation";
import { createPortal } from "react-dom";
import { useState, useEffect, useRef } from "react";

export default function ModalAI({
  onClose,
  description,
  setDescription,
  // Props del formulario de oferente
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
  description?: string;
  setDescription?: (desc: string) => void;
  // Tipos para los props del formulario
  typeProfile?: string;
  selectedCategory?: string;
  isOfrezco?: boolean;
  isIntermediario?: boolean;
  destinationCountry?: string;
  contanos?: string;
  website?: string;
  country?: string;
  fieldTarget?: "description" | "included" | "notIncluded";
}) {
  const { t, locale } = useTranslation();
  const [userInput, setUserInput] = useState("");
  const [currentStep, setCurrentStep] = useState("initial"); // initial, qualification, description
  const [showDescriptionInput, setShowDescriptionInput] = useState(false);
  const [messages, setMessages] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [suggestedDescription, setSuggestedDescription] = useState("");
  // Ref para el contenedor de mensajes para auto-scroll
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Función para hacer scroll al final
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: "smooth",
        block: "end"
      });
    }
  };

  // Auto-scroll cuando cambian los mensajes o se está generando
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollToBottom();
    }, 100); // Pequeño delay para asegurar que el DOM se haya actualizado

    return () => clearTimeout(timer);
  }, [messages, isGenerating, showDescriptionInput]);

  // Función para generar timestamp dinámico
  const getCurrentTimestamp = () => {
    return new Date()
      .toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
      .toLowerCase();
  };

  // Clave única para localStorage basada en el email u otro identificador
  const storageSuffix = fieldTarget || "description";
  const CHAT_STORAGE_KEY = `travelgrin_ai_chat_${storageSuffix}`;
  const CHAT_TIMESTAMP_KEY = `travelgrin_ai_chat_timestamp_${storageSuffix}`;
  const WAITING_FIELDS_KEY = `travelgrin_ai_waiting_fields_${storageSuffix}`;

  // Cargar mensajes desde localStorage
  const loadMessagesFromStorage = () => {
    try {
      const stored = localStorage.getItem(CHAT_STORAGE_KEY);
      const timestamp = localStorage.getItem(CHAT_TIMESTAMP_KEY);
      
      // Verificar si han pasado 10 minutos (600000 ms)
      if (stored && timestamp) {
        const now = Date.now();
        const storedTime = parseInt(timestamp);
        const tenMinutes = 10 * 60 * 1000; // 10 minutos en milisegundos
        
        if (now - storedTime > tenMinutes) {
          // Han pasado 10 minutos, limpiar chat
          localStorage.removeItem(CHAT_STORAGE_KEY);
          localStorage.removeItem(CHAT_TIMESTAMP_KEY);
          localStorage.removeItem(WAITING_FIELDS_KEY);
          console.log("Chat limpiado automáticamente después de 10 minutos");
        } else {
          return JSON.parse(stored);
        }
      }
    } catch (error) {
      console.error("Error loading messages from localStorage:", error);
    }

    // Mensajes iniciales según especificaciones
    return [
      {
        id: 1,
        type: "bot",
        content:
          t("hola_ia_inicial") ||
          "Hola 👋, soy la IA de Travelgrin y puedo ayudarte con:",
        timestamp: getCurrentTimestamp(),
        showInitialButtons: true,
      },
    ];
  };

  // Guardar mensajes en localStorage
  const saveMessagesToStorage = (messages) => {
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
      localStorage.setItem(CHAT_TIMESTAMP_KEY, Date.now().toString());
    } catch (error) {
      console.error("Error saving messages to localStorage:", error);
    }
  };

  // Cargar estado de waitingForFields desde localStorage
  const loadWaitingFieldsFromStorage = () => {
    try {
      const stored = localStorage.getItem(WAITING_FIELDS_KEY);
      return stored === 'true';
    } catch (error) {
      console.error("Error loading waitingForFields from localStorage:", error);
      return false;
    }
  };

  // Guardar estado de waitingForFields en localStorage
  const saveWaitingFieldsToStorage = (waiting) => {
    try {
      localStorage.setItem(WAITING_FIELDS_KEY, waiting.toString());
    } catch (error) {
      console.error("Error saving waitingForFields to localStorage:", error);
    }
  };

  // Limpiar chat del localStorage
  const clearChatStorage = () => {
    try {
      localStorage.removeItem(CHAT_STORAGE_KEY);
      localStorage.removeItem(CHAT_TIMESTAMP_KEY);
      localStorage.removeItem(WAITING_FIELDS_KEY);
    } catch (error) {
      console.error("Error clearing chat storage:", error);
    }
  };


  // Estado para trackear si estamos esperando que se completen campos
  const [waitingForFields, setWaitingForFields] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Inicializar mensajes después del montaje del componente
  useEffect(() => {
    const initialMessages = loadMessagesFromStorage();
    setMessages(initialMessages);
    
    // Cargar el estado de waitingForFields desde localStorage
    const storedWaitingFields = loadWaitingFieldsFromStorage();
    setWaitingForFields(storedWaitingFields);
    setIsInitialized(true);
    //console.log("Estado de waitingForFields cargado desde localStorage:", storedWaitingFields);
    
    // Verificar si hay algún mensaje que muestre el input de descripción
    const hasDescriptionInput = initialMessages.some(msg => msg.showDescriptionInput);
    if (hasDescriptionInput) {
      setShowDescriptionInput(true);
    }
  }, []);

  // Efecto para reiniciar el timer de inactividad cada vez que cambian los mensajes
  useEffect(() => {
    if (messages.length > 0) {
      saveMessagesToStorage(messages);
    }
  }, [messages]);

  // Efecto para guardar waitingForFields cuando cambie (solo después de inicializar)
  useEffect(() => {
    if (isInitialized) {
      saveWaitingFieldsToStorage(waitingForFields);
    }
  }, [waitingForFields, isInitialized]);

  // Efecto para detectar cambios en los campos del formulario y continuar el flujo automáticamente
  useEffect(() => {
    // Solo ejecutar si estamos esperando que se completen los campos
    if (!waitingForFields) return;

    // Verificar si ahora ya tiene los campos completos
    const requiresTypeProfile = fieldTarget !== "description";
    const hasRequiredFields = selectedCategory && (isOfrezco || isIntermediario) && (!requiresTypeProfile || typeProfile);
    
    if (hasRequiredFields) {
      // Los campos están completos, continuar automáticamente
      const botResponse = {
        id: messages.length + 1,
        type: "bot",
        content: description && description.trim() 
          ? t("perfecto_todos_campos").replace(
            "{{description}}",
            description
          )
          : t("perfecto_ya_tienes"),
        timestamp: getCurrentTimestamp(),
        showDescriptionInput: true,
      };

      setMessages((prev) => [...prev, botResponse]);
      setShowDescriptionInput(true);
      setWaitingForFields(false); // Resetear el estado
      setUserInput(description)
    }
  }, [description, fieldTarget, isIntermediario, isOfrezco, selectedCategory, typeProfile, waitingForFields]);

  // Efecto para guardar mensajes cada vez que cambien (excepto en la primera carga)
  useEffect(() => {
    if (messages.length > 0) {
      saveMessagesToStorage(messages);
    }
  }, [messages]);



  // Función para reiniciar el chat
  const restartChat = () => {
    clearChatStorage();
    setMessages(loadMessagesFromStorage());
    setSuggestedDescription("");
    setShowDescriptionInput(false);
    setCurrentStep("initial");
    setWaitingForFields(false);
  };

  // Función para manejar dudas de calificación
  const handleQualificationDubt = () => {
    const userMessage = {
      id: messages.length + 1,
      type: "user",
      content: t("tengo_dudas"),
      timestamp: getCurrentTimestamp(),
    };

    let botResponse;

    if (selectedCategory) {
      // A) Ya completó categoría
      botResponse = {
        id: messages.length + 2,
        type: "bot",
        content: t("experiencia_pregunta").replace(
          "{{categoria}}",
          selectedCategory
        ),
        timestamp: getCurrentTimestamp(),
        showExperienceButtons: true,
      };
    } else {
      // B) No completó categoría
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

  // Función para manejar experiencia (Sí/No)
  const handleExperience = (hasExperience: boolean) => {
    const userMessage = {
      id: messages.length + 1,
      type: "user",
      content: hasExperience ? t("si") : t("no"),
      timestamp: getCurrentTimestamp(),
    };

    let botResponse;

    if (hasExperience) {
      // Califica
      botResponse = {
        id: messages.length + 2,
        type: "bot",
        content: t("perfect"),
        timestamp: getCurrentTimestamp(),
      };
    } else {
      // No califica
      botResponse = {
        id: messages.length + 2,
        type: "bot",
        content: t("por_ahora_no_califica"),
        timestamp: getCurrentTimestamp(),
      };
    }

    setMessages((prev) => [...prev, userMessage, botResponse]);

    // Agregar mensaje de reinicio después de cualquier respuesta de experiencia
    setTimeout(() => {
      const restartMessage = {
        id: messages.length + 3,
        type: "bot",
        content: "El chat se reiniciará en 5 minutos para ayudarte con otras consultas.",
        timestamp: getCurrentTimestamp(),
      };
      
      setMessages((prev) => [...prev, restartMessage]);

      // Reiniciar el chat después de 5 minutos
      setTimeout(() => {
        restartChat();
      }, 300000);
    }, 2000);
  };

  // Función para manejar categorías (Sí/No)
  const handleCategoryResponse = (hasCategory: boolean) => {
    const userMessage = {
      id: messages.length + 1,
      type: "user",
      content: hasCategory ? t("si"): t("no"),
      timestamp: getCurrentTimestamp(),
    };

    let botResponse;

    if (hasCategory) {
      // Califica
      botResponse = {
        id: messages.length + 2,
        type: "bot",
        content: t("perfecto_tu_propuesta"),
         
        timestamp: getCurrentTimestamp(),
      };
    } else {
      // No califica
      botResponse = {
        id: messages.length + 2,
        type: "bot",
        content: t("no_califica_por_ahora"),
          
        timestamp: getCurrentTimestamp(),
      };
    }

    setMessages((prev) => [...prev, userMessage, botResponse]);

    // Agregar mensaje de reinicio después de cualquier respuesta de categoría
    setTimeout(() => {
      const restartMessage = {
        id: messages.length + 3,
        type: "bot",
        content: "El chat se reiniciará en 5 minutos para ayudarte con otras consultas.",
        timestamp: getCurrentTimestamp(),
      };
      
      setMessages((prev) => [...prev, restartMessage]);

      // Reiniciar el chat después de 5 segundos
      setTimeout(() => {
        restartChat();
      }, 300000);
    }, 2000);
  };

  // Función para mejorar descripción
  const handleDescriptionImprovement = () => {
    const userMessage = {
      id: messages.length + 1,
      type: "user",
      content: t("mejora_description"),
      timestamp: getCurrentTimestamp(),
    };

    let botResponse;

    // Verificar si tiene los campos requeridos: Tipo de perfil, Categoría y Actúo como
    const requiresTypeProfile = fieldTarget !== "description";
    const hasRequiredFields =
      selectedCategory && (isOfrezco || isIntermediario) && (!requiresTypeProfile || typeProfile);

    if (hasRequiredFields) {
      // A) Ya completó los campos requeridos - ir directo al input
      if (description && description.trim()) {
        botResponse = {
          id: messages.length + 2,
          type: "bot",
         content: t("detecte"), 
         timestamp: getCurrentTimestamp(),
          showDescriptionInput: true,
        };
        setUserInput(description)
      } else {
        botResponse = {
          id: messages.length + 2,
          type: "bot",
          content: t("contame_con_tus_palabras"),
          timestamp: getCurrentTimestamp(),
          showDescriptionInput: true,
        };
      }
      setShowDescriptionInput(true);
    } else {
      // B) No completó los campos requeridos - mostrar qué falta y activar detección
      const missingFields = [];
      if (requiresTypeProfile && !typeProfile) missingFields.push("• " + t("tipo_perfil"));
      if (!selectedCategory) missingFields.push("• " + t("categoria"));
      if (!isOfrezco && !isIntermediario) missingFields.push("• " + t("actuo_como"));

      botResponse = {
        id: messages.length + 2,
        type: "bot",
        //todo
        content: t("para_mejorar").replace(
          "{{missingFields}}",
          missingFields.join("\n")
        ),
        //content: `Para poder mejorar tu descripción, necesito que completes estos campos en el formulario:\n\n${missingFields.join("\n")}\n\nUna vez que los completes, el chat continuará automáticamente.`,
        timestamp: getCurrentTimestamp(),
      };

      // Activar la detección automática
      setWaitingForFields(true);
    }

    setMessages((prev) => [...prev, userMessage, botResponse]);
    setCurrentStep("description");
  };

  // Función para generar descripción con IA
  const generateDescription = async (userMessage?: string) => {
    setIsGenerating(true);

    try {
      // Preparar los datos para el prompt
      const actingAs =
        isOfrezco && isIntermediario
          ? "Ambos"
          : isOfrezco
          ? "Directo"
          : isIntermediario
          ? "Intermediario"
          : "No especificado";

      // Usar la descripción del formulario si no hay input del usuario
      const messageToSend = userMessage || userInput || description || "";

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
          language: locale, // Detectar idioma
          currentDescription: description,
          fieldTarget,
          destinationCountry,
          website,
          country,
          baseDescription: contanos,
        }),
      });

      if (!response.ok) {
        throw new Error("Error al generar descripción");
      }

      const data = await response.json();
      const newDescription = data.description;

      setSuggestedDescription(newDescription);

      // Agregar mensaje del bot con la descripción generada
      const newBotMessage = {
        id: messages.length + 1,
        type: "bot",
        content: t("he_creado").replace(
          "{{newDescription}}",
          newDescription
        ),
        timestamp: getCurrentTimestamp(),
        showDescriptionButtons: true,
      };

      setMessages((prev) => [...prev, newBotMessage]);
      setUserInput("");
      setShowDescriptionInput(false);
    } catch (error) {
      console.error("Error:", error);
      toast.error(t("error_desc"));

      const errorMessage = {
        id: messages.length + 1,
        type: "bot",
        content:
          t("disculpa"),
        timestamp: getCurrentTimestamp(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsGenerating(false);
    }
  };

  // Función para aceptar la descripción sugerida
  const acceptDescription = () => {
    if (setDescription && suggestedDescription) {
      setDescription(suggestedDescription);
      toast.success(t("success_desc"));

      const confirmMessage = {
        id: messages.length + 1,
        type: "bot",
        content:t("perfecto_actualize"),
        timestamp: getCurrentTimestamp(),
      };

      setMessages((prev) => [...prev, confirmMessage]);

      // Agregar mensaje de reinicio después de la confirmación
      setTimeout(() => {
        const restartMessage = {
          id: messages.length + 2,
          type: "bot",
          content: "¡Descripción actualizada! El chat se reiniciará en 5 minutos para ayudarte con otras consultas.",
          timestamp: getCurrentTimestamp(),
        };
        
        setMessages((prev) => [...prev, restartMessage]);

        // Reiniciar el chat después de 3 segundos (más rápido porque ya se completó la tarea)
        setTimeout(() => {
          restartChat();
        }, 300000);
      }, 1500);

      // Mantener el cierre automático original como backup
      // setTimeout(() => {
      //   onClose();
      // }, 6000);
    }
  };

  // Función para generar otra descripción
  const generateAnother = () => {
    const requestMessage = {
      id: messages.length + 1,
      type: "user",
      content: t("dame_otra"),
      timestamp: getCurrentTimestamp(),
    };

    setMessages((prev) => [...prev, requestMessage]);
    generateDescription(t("genera_desc"));
  };

  // Función para enviar mensaje del usuario en input de descripción
  const sendDescriptionMessage = () => {
    if (userInput.trim()) {
      const userMessage = {
        id: messages.length + 1,
        type: "user",
        content: userInput,
        timestamp: getCurrentTimestamp(),
      };

      setMessages((prev) => [...prev, userMessage]);
      generateDescription(userInput);
      // Scroll inmediato después de agregar mensaje del usuario
      setTimeout(() => scrollToBottom(), 50);
    }
  };

  // Manejar Enter en el input
  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !isGenerating && showDescriptionInput) {
      sendDescriptionMessage();
    }
  };

 

  // Función para manejar clic fuera del modal (cerrar)
  const handleOutsideClick = () => {
    onClose();
  };

  const modalAIContent = (
    <>
      {/* Backdrop para detectar clics fuera */}
      <div
        className="fixed inset-0 bg-transparent z-[9999999998]"
        onClick={handleOutsideClick}
      />

      {/* Chat flotante en bottom right - sin backdrop */}
      <div
        className="fixed bottom-4 right-4"
        style={{
          zIndex: 9999999999,
          pointerEvents: "auto",
          // Removemos transform y propiedades de renderizado que causan transparencia
        }}
      >
        {/* AI Modal content - Chat style más pequeño */}
        <div
          className="bg-white rounded-2xl shadow-2xl w-80 h-96 flex flex-col"
          style={{
            zIndex: 10000000000,
            // Propiedades críticas para texto sólido en iOS
            WebkitFontSmoothing: "antialiased",
            MozOsxFontSmoothing: "grayscale",
            fontSmooth: "always",
            textRendering: "optimizeLegibility",
            // Forzamos compositing layers sin afectar transparencia
            willChange: "auto",
            // Removemos todas las propiedades que pueden causar transparencia
            // transform, backfaceVisibility, isolation removidas
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Chat Header */}
          <div 
            className="flex-shrink-0 bg-blue-600 text-white p-3 rounded-t-2xl relative"
            style={{
              // Aseguramos texto sólido en el header
              WebkitFontSmoothing: "antialiased",
              MozOsxFontSmoothing: "grayscale",
              color: "#ffffff", // Color explícito
              backgroundColor: "#2563eb", // Color explícito
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div 
                  className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.2)",
                  }}
                >
                  <span 
                    className="text-sm"
                    style={{
                      WebkitFontSmoothing: "antialiased",
                      MozOsxFontSmoothing: "grayscale",
                      color: "#ffffff",
                    }}
                  >
                    🤖
                  </span>
                </div>
                <div>
                  <h3 
                    className="font-semibold text-sm"
                    style={{
                      WebkitFontSmoothing: "antialiased",
                      MozOsxFontSmoothing: "grayscale",
                      color: "#ffffff",
                      fontWeight: "600",
                    }}
                  >
                    {t("asistente_ia")}
                  </h3>
                  <p 
                    className="text-xs text-blue-100"
                    style={{
                      WebkitFontSmoothing: "antialiased",
                      MozOsxFontSmoothing: "grayscale",
                      color: "#dbeafe",
                    }}
                  >
                    {t("en_linea")}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    clearChatStorage();
                    setMessages(loadMessagesFromStorage());
                    setSuggestedDescription("");
                    setShowDescriptionInput(false);
                    setCurrentStep("initial");
                    setWaitingForFields(false); // Resetear también este estado
                    toast.success(t("chat_limpio"));
                  }}
                  className="text-white hover:bg-white/20 rounded-full p-1 transition-colors duration-200"
                  title="Limpiar chat"
                  style={{
                    color: "#ffffff",
                  }}
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>

                <button
                  onClick={onClose}
                  className="text-white hover:bg-white/20 rounded-full p-1 transition-colors duration-200"
                  style={{
                    color: "#ffffff",
                  }}
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Chat Messages Area */}
          <div 
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto p-3 bg-gray-50 space-y-3"
            style={{
              backgroundColor: "#f9fafb",
              WebkitFontSmoothing: "antialiased",
              MozOsxFontSmoothing: "grayscale",
              // Scroll suave en iOS
              WebkitOverflowScrolling: "touch",
            }}
          >
            {messages.map((message) => (
              <div key={message.id} className="flex items-start space-x-2">
                {message.type === "bot" && (
                  <div 
                    className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{
                      backgroundColor: "#3b82f6",
                    }}
                  >
                    <span 
                      className="text-white text-xs"
                      style={{
                        WebkitFontSmoothing: "antialiased",
                        MozOsxFontSmoothing: "grayscale",
                        color: "#ffffff",
                      }}
                    >
                      🤖
                    </span>
                  </div>
                )}

                <div
                  className={`rounded-lg p-2 shadow-sm max-w-[80%] ${
                    message.type === "bot"
                      ? "bg-white rounded-tl-none"
                      : "bg-blue-500 text-white rounded-tr-none ml-auto"
                  }`}
                  style={{
                    backgroundColor: message.type === "bot" ? "#ffffff" : "#3b82f6",
                    color: message.type === "bot" ? "#111827" : "#ffffff",
                    WebkitFontSmoothing: "antialiased",
                    MozOsxFontSmoothing: "grayscale",
                    textRendering: "optimizeLegibility",
                  }}
                >
                  <p 
                    className="text-xs whitespace-pre-line"
                    style={{
                      WebkitFontSmoothing: "antialiased",
                      MozOsxFontSmoothing: "grayscale",
                      color: message.type === "bot" ? "#111827" : "#ffffff",
                      fontSize: "12px",
                      lineHeight: "1.4",
                    }}
                  >
                    {message.content}
                  </p>

                  {/* Botones iniciales */}
                  {message.showInitialButtons && (
                    <div className="flex flex-col space-y-2 mt-3">
                      <button
                        onClick={handleQualificationDubt}
                        className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-full text-xs transition-colors duration-200"
                        style={{
                          backgroundColor: "#f97316",
                          color: "#ffffff",
                          WebkitFontSmoothing: "antialiased",
                          MozOsxFontSmoothing: "grayscale",
                          fontSize: "12px",
                          fontWeight: "500",
                        }}
                      >
                        {t("dudas_califico")}
                      </button>
                      <button
                        onClick={handleDescriptionImprovement}
                        className="bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-full text-xs transition-colors duration-200"
                        style={{
                          backgroundColor: "#10b981",
                          color: "#ffffff",
                          WebkitFontSmoothing: "antialiased",
                          MozOsxFontSmoothing: "grayscale",
                          fontSize: "12px",
                          fontWeight: "500",
                        }}
                      >
                        {t("mejorar_descripcion")}
                      </button>
                    </div>
                  )}

                  {/* Botones de experiencia */}
                  {message.showExperienceButtons && (
                    <div className="flex flex-row space-x-2 mt-3">
                      <button
                        onClick={() => handleExperience(true)}
                        className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-full text-xs transition-colors duration-200"
                        style={{
                          backgroundColor: "#10b981",
                          color: "#ffffff",
                          WebkitFontSmoothing: "antialiased",
                          MozOsxFontSmoothing: "grayscale",
                          fontSize: "12px",
                          fontWeight: "500",
                        }}
                      >
                        {t("si")}
                      </button>
                      <button
                        onClick={() => handleExperience(false)}
                        className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-full text-xs transition-colors duration-200"
                        style={{
                          backgroundColor: "#ef4444",
                          color: "#ffffff",
                          WebkitFontSmoothing: "antialiased",
                          MozOsxFontSmoothing: "grayscale",
                          fontSize: "12px",
                          fontWeight: "500",
                        }}
                      >
                        {t("no")}
                      </button>
                    </div>
                  )}

                  {/* Botones de categoría */}
                  {message.showCategoryButtons && (
                    <div className="flex flex-row space-x-2 mt-3">
                      <button
                        onClick={() => handleCategoryResponse(true)}
                        className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-full text-xs transition-colors duration-200"
                        style={{
                          backgroundColor: "#10b981",
                          color: "#ffffff",
                          WebkitFontSmoothing: "antialiased",
                          MozOsxFontSmoothing: "grayscale",
                          fontSize: "12px",
                          fontWeight: "500",
                        }}
                      >
                         {t("si")}
                      </button>
                      <button
                        onClick={() => handleCategoryResponse(false)}
                        className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-full text-xs transition-colors duration-200"
                        style={{
                          backgroundColor: "#ef4444",
                          color: "#ffffff",
                          WebkitFontSmoothing: "antialiased",
                          MozOsxFontSmoothing: "grayscale",
                          fontSize: "12px",
                          fontWeight: "500",
                        }}
                      >
                       {t("no")}
                      </button>
                    </div>
                  )}

                  {/* Botones de descripción */}
                  {message.showDescriptionButtons && (
                    <div className="flex flex-col space-y-2 mt-3">
                      <button
                        onClick={acceptDescription}
                        className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-full text-xs transition-colors duration-200"
                        style={{
                          backgroundColor: "#10b981",
                          color: "#ffffff",
                          WebkitFontSmoothing: "antialiased",
                          MozOsxFontSmoothing: "grayscale",
                          fontSize: "12px",
                          fontWeight: "500",
                        }}
                      >
                        {t("aceptar_descripcion")}
                      </button>
                      <button
                        onClick={generateAnother}
                        className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded-full text-xs transition-colors duration-200"
                        disabled={isGenerating}
                        style={{
                          backgroundColor: "#f97316",
                          color: "#ffffff",
                          WebkitFontSmoothing: "antialiased",
                          MozOsxFontSmoothing: "grayscale",
                          fontSize: "12px",
                          fontWeight: "500",
                        }}
                      >
                        {t("dame_otra_opcion")}
                      </button>
                    </div>
                  )}

                  <span 
                    className="text-xs text-gray-500 mt-1 block"
                    style={{
                      WebkitFontSmoothing: "antialiased",
                      MozOsxFontSmoothing: "grayscale",
                      color: "#6b7280",
                      fontSize: "11px",
                    }}
                  >
                    {message.timestamp}
                  </span>
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isGenerating && (
              <div className="flex items-start space-x-2">
                <div 
                  className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor: "#3b82f6",
                  }}
                >
                  <span 
                    className="text-white text-xs"
                    style={{
                      WebkitFontSmoothing: "antialiased",
                      MozOsxFontSmoothing: "grayscale",
                      color: "#ffffff",
                    }}
                  >
                    🤖
                  </span>
                </div>
                <div 
                  className="bg-white rounded-lg rounded-tl-none p-2 shadow-sm"
                  style={{
                    backgroundColor: "#ffffff",
                  }}
                >
                  <p 
                    className="text-xs text-gray-600 mb-1"
                    style={{
                      WebkitFontSmoothing: "antialiased",
                      MozOsxFontSmoothing: "grayscale",
                      color: "#4b5563",
                      fontSize: "12px",
                    }}
                  >
                    {t("pensando")}
                  </p>
                  <div className="flex space-x-1">
                    <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce"></div>
                    <div
                      className="w-1 h-1 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.1s" }}
                    ></div>
                    <div
                      className="w-1 h-1 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    ></div>
                  </div>
                </div>
              </div>
            )}

            {/* Elemento invisible para hacer scroll al final */}
            <div ref={messagesEndRef} style={{ height: '1px' }} />
          </div>

          {/* Input de descripción cuando corresponde */}
          {showDescriptionInput && (
            <div 
              className="flex-shrink-0 p-3 bg-white border-t border-gray-200 rounded-b-2xl"
              style={{
                backgroundColor: "#ffffff",
                borderTopColor: "#e5e7eb",
              }}
            >
              <div className="flex items-center space-x-2">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={description && description.trim() ? "Escribe aquí para mejorar tu descripción..." : t("describe_servicio")}
                    disabled={isGenerating}
                    className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                    style={{
                      WebkitFontSmoothing: "antialiased",
                      MozOsxFontSmoothing: "grayscale",
                      color: "#111827",
                      backgroundColor: "#ffffff",
                      borderColor: "#d1d5db",
                      fontSize: "12px",
                      textRendering: "optimizeLegibility",
                    }}
                  />
                </div>

                <button
                  onClick={sendDescriptionMessage}
                  disabled={isGenerating || !userInput.trim()}
                  className="bg-blue-500 hover:bg-blue-600 text-white rounded-full p-1.5 transition-colors duration-200 flex-shrink-0 disabled:bg-gray-400"
                  style={{
                    backgroundColor: isGenerating || !userInput.trim() ? "#9ca3af" : "#3b82f6",
                    color: "#ffffff",
                  }}
                >
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                    />
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
