import { AlertTriangle, Globe, Pencil, PencilIcon } from "lucide-react";
import { useState, useRef, useEffect } from "react";

type Props = {
  placeholder: string;
  value: string;
  setValue: (text: string) => void;
  isSearching?: boolean;
  isStop?: boolean;
  isContanos?: boolean;
  isWeb?: boolean;
  textCharsRestantes?: string;
  textPerfecto?: string;
};

const MaterialTextarea = ({
  placeholder,
  value,
  setValue,
  isSearching,
  isStop = false,
  isContanos = false,
  isWeb = false,
  textCharsRestantes,
  textPerfecto,
}: Props) => {
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const maxLength = 500;

  // Función para ajustar automáticamente la altura
  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Resetear altura para obtener scrollHeight correcto
      textarea.style.height = "auto";

      // Calcular nueva altura con límites
      const newHeight = Math.min(textarea.scrollHeight, 147);
      textarea.style.height = `${newHeight}px`;
    }
  };

  // Ajustar altura cuando cambie el valor
  useEffect(() => {
    adjustHeight();
  }, [value]);

  // Determinar si hay icono para ajustar el padding
  const hasIcon = isSearching || isStop || isContanos || isWeb;
  const truncateText = (text, maxLength) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + "...";
  };
  return (
    <div className="mb-6 relative w-full">
      <div className="relative">
        {isSearching && (
          <div className="absolute top-4 left-3 z-10">
            <Pencil className="w-4 h-4 text-black " />
          </div>
        )}
        {isStop && (
          <div className="absolute top-4 left-3 z-10">
            <AlertTriangle className="w-4 h-4 text-black" />
          </div>
        )}
        {isContanos && (
          <div className="absolute top-4 left-3 z-10">
            <PencilIcon className="w-4 h-4 text-black" />
          </div>
        )}
        {isWeb && (
          <div className="absolute top-4 left-3 z-10">
            <Globe className="w-4 h-4 text-black" />
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            adjustHeight();
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          maxLength={maxLength}
          rows={1}
          className={`w-full text-black p-4 pt-6   rounded-xl resize-none transition-all duration-300 outline-none overflow-hidden transform hover:scale-[1.01] focus:scale-[1.01] ${
            hasIcon ? "pl-12" : "pl-4"
          }`}
          style={{
            minHeight: isContanos ? "104px" : "90px",
            maxHeight: "147px",
            scrollbarWidth: "thin",
            scrollbarColor: "#14b8a6 #f1f5f9",
            lineHeight: "1.5",
            // Forzar fondo blanco para iOS
            backgroundColor: "#ffffff",
            WebkitAppearance: "none", // Remover estilos nativos de iOS
            // Sombras más compatibles con iOS
            boxShadow:
              "0 8px 32px -12px rgba(8, 217, 189, 0.3), 0 4px 16px -6px rgba(4, 181, 189, 0.25), 0 2px 8px -3px rgba(0, 154, 188, 0.2), inset 0 0 0 1px rgba(255, 255, 255, 0.1)",
            // Alternativa para la sombra en iOS
            WebkitBoxShadow:
              "0 8px 32px -12px rgba(8, 217, 189, 0.3), 0 4px 16px -6px rgba(4, 181, 189, 0.25), 0 2px 8px -3px rgba(0, 154, 188, 0.2)",
            // Forzar opacidad completa
            opacity: "1",
            // Prevenir zoom en iOS
            fontSize: "16px",
            // Mejoras para rendering en iOS
            WebkitTransform: "translateZ(0)",
            transform: "translateZ(0)",
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
          }}
        />

        {/* Label flotante */}
        <label
          className={`absolute transition-all duration-200 pointer-events-none pr-3  ${
            hasIcon ? "left-12" : "left-8"
          } ${
            value || isFocused
              ? "-top-2 text-xs bg-white px-1 font-medium"
              : "top-4 text-base"
          } ${
            isFocused
              ? "text-teal-600"
              : value
              ? "text-teal-600"
              : "text-gray-500"
          }`}
          style={{
            // Asegurar que el fondo del label también sea blanco en iOS
            backgroundColor: value || isFocused ? "#ffffff" : "transparent",
            zIndex: 5,
          }}
        >
          {isContanos && value.length > 0
            ? truncateText(placeholder, 25)
            : placeholder}
        </label>
      </div>

      {/* Contador de caracteres y mensaje de ayuda */}
      <div className="flex justify-between items-center mt-2 px-1">
        <div
          className={`text-sm transition-colors duration-200 ${
            isFocused ? "text-teal-600" : "text-gray-500"
          }`}
        >
          {isFocused && !value && (
            <span className="flex items-center gap-1">
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
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {textCharsRestantes}
            </span>
          )}
          {value && (
            <span className="flex items-center gap-1">
              <svg
                className="w-4 h-4 text-green-500"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-green-600">{textPerfecto}</span>
            </span>
          )}
        </div>

        <div
          className={`text-sm font-medium transition-colors duration-200 ${
            value.length > maxLength * 0.8
              ? value.length >= maxLength
                ? "text-red-500"
                : "text-orange-500"
              : isFocused
              ? "text-teal-600"
              : "text-gray-400"
          }`}
        >
          {value.length}/{maxLength}
        </div>
      </div>

      {/* Barra de progreso visual */}
      <div className="mt-1 h-1 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 rounded-full ${
            value.length > maxLength * 0.8
              ? value.length >= maxLength
                ? "bg-red-500"
                : "bg-orange-500"
              : "bg-gradient-to-r from-teal-500 to-blue-500"
          }`}
          style={{
            width: `${(value.length / maxLength) * 100}%`,
          }}
        />
      </div>
    </div>
  );
};

export default MaterialTextarea;
