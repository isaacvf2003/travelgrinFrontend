import React, { useState } from "react";

interface FloatingAIButtonProps {
  onClick: () => void;
  isInFooter?: boolean; // Nueva prop para saber si está en el footer
  is425w: boolean; // Nueva prop para saber si el ancho es 425px o menos
}

export default function FloatingAIButton({
  onClick,
  isInFooter = false,
  is425w,
}: FloatingAIButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={
        isInFooter
          ? `absolute ${is425w ? "right-1 top-[2.8rem]" : "right-1 md:right-2 top-[3.2rem]"} transform -translate-y-1/2`
          : "fixed bottom-6 right-6 z-[9999]"
      }
      style={{
        // Propiedades específicas para iOS
        transform: isInFooter
          ? "translateY(-50%) translateZ(0)"
          : "translateZ(0)",
        WebkitTransform: isInFooter
          ? "translateY(-50%) translateZ(0)"
          : "translateZ(0)",
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
      }}
    >
      <button
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`
          group relative 
          hover:from-blue-600 hover:to-purple-700
          text-white rounded-full shadow-lg hover:shadow-2xl
          transition-all duration-300 ease-out
          ${isHovered ? "scale-110" : "scale-100"}
          flex items-center justify-center
          w-14 h-14 sm:w-16 sm:h-16
        `}
        style={{
          boxShadow: "0 6px 24px rgba(8, 217, 189, 0.45)",
          background:
            "linear-gradient(90deg, #08D9BD 0%, #04B5BD 50%, #009ABC 100%)",
        }}
      >
        {/* Icono de IA agrandado */}
        <div className="relative flex items-center justify-center w-full h-full p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/chatbot.webp"
            alt="Asistente IA"
            className="w-10 h-10 sm:w-11 sm:h-11 object-contain select-none drop-shadow-sm scale-110"
            draggable={false}
          />

          {/* Indicador de "online" */}
          <div
            className="absolute top-1 right-1 w-3.5 h-3.5 bg-green-400 border-2 border-white rounded-full animate-pulse shadow-sm"
          ></div>
        </div>

        {/* Efecto de ondas */}
        <div className="absolute inset-0 rounded-full animate-ping bg-blue-400 opacity-20"></div>

        {/* Tooltip - solo en modo flotante */}
        {!isInFooter && (
          <div
            className={`
            absolute right-full mr-3 px-3 py-2 bg-gray-800 text-white text-sm 
            rounded-lg whitespace-nowrap transition-all duration-300 transform
            ${
              isHovered
                ? "opacity-100 translate-x-0"
                : "opacity-0 translate-x-2"
            }
          `}
          >
            Asistente de IA
            {/* Flecha del tooltip */}
            <div className="absolute top-1/2 left-full transform -translate-y-1/2 border-l-4 border-l-gray-800 border-y-4 border-y-transparent"></div>
          </div>
        )}
      </button>

      {/* Texto alternativo para mobile - solo en modo flotante */}
      {!isInFooter && (
        <div
          className={`
          md:hidden absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2
          px-2 py-1 bg-gray-800 text-white text-xs rounded
          transition-all duration-300
          ${isHovered ? "opacity-100" : "opacity-0"}
        `}
        >
          IA
        </div>
      )}
    </div>
  );
}
