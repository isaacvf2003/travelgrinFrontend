"use client";
import { useTranslation } from "@/app/hooks/useTranslation";
import React, { useState, useEffect } from "react";

type Props = {
    phrases: string[];
    isNotAlone?: boolean;
    isBlackText?: boolean;
    isBiggerText?: boolean;
}

const TextChangerEffect = ({phrases, isNotAlone, isBlackText, isBiggerText}: Props) => {
  const {t} = useTranslation()
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
  const [isFlipping, setIsFlipping] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsFlipping(true);
      
      // Después de la animación de flip, cambiar el texto
      setTimeout(() => {
        setCurrentPhraseIndex((prev) => (prev + 1) % phrases.length);
        setIsFlipping(false);
      }, 300); // Duración de la animación flip
    }, 3000);

    return () => clearInterval(interval);
  }, [phrases.length]);

  return (
    <div className={`items-center justify-center p-8 `}>
      <div className="text-center max-w-4xl mx-auto">
        <h1 className="text-[16px] md:text-6xl lg:text-7xl font-bold text-white mb-0">
          {/* Contenedor con altura fija para todo el texto */}
          <div className={` flex items-center justify-center ${isNotAlone ? "h-[80px] md:h-[120px] lg:h-[140px]" : "h-[0rem]"}`}>
            <div className={`leading-tight text-[21px] md:text-[25.76px]`}>
              {/* Texto dinámico con efecto flip */}
              <span 
                className={`changing-text inline-block transition-all duration-300 ease-in-out transform-gpu ${
                  isFlipping ? 'flip-out' : 'flip-in'
                } `}
                style={{
                  transformStyle: 'preserve-3d',
                  perspective: '1000px',
                  color: isBlackText ? '#273166' : 'white',
                }}
              >
                {phrases[currentPhraseIndex]}
              </span>
              {/* Texto fijo continuando la oración */}
              {isNotAlone && (
                <span className={`text-white text-[21px] md:text-[25.76px] whitespace-pre-line`}>
                  {" "} {t("que_necesitas_a_un_click")}
                </span>
              )}
            </div>
          </div>
        </h1>
      </div>

      {/* Estilos CSS para el efecto flip */}
      <style jsx>{`
        .flip-in {
          transform: rotateX(0deg);
          opacity: 1;
        }
        
        .flip-out {
          transform: rotateX(-90deg);
          opacity: 0;
        }
        
        .changing-text {
          transition: transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1), 
                      opacity 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
          transform-origin: center center;
        }
        
        @keyframes flipWord {
          0% {
            transform: rotateX(0deg);
            opacity: 1;
          }
          50% {
            transform: rotateX(-90deg);
            opacity: 0;
          }
          100% {
            transform: rotateX(0deg);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default TextChangerEffect;
