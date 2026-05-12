"use client";
import React, { useState, useEffect, useMemo } from "react";
import { ChevronRight, Plane, Quote } from "lucide-react";
import { useIsClient } from "@/app/hooks/isClient";
import Image from "next/image";
import ButtonSolid from "../ButtonSolid";
import { useTranslation } from "@/app/hooks/useTranslation";
import AR from 'country-flag-icons/react/3x2/AR'
import MX from 'country-flag-icons/react/3x2/MX'
import DE from 'country-flag-icons/react/3x2/DE'
import FR from 'country-flag-icons/react/3x2/FR'
import CL from 'country-flag-icons/react/3x2/CL'
import CO from 'country-flag-icons/react/3x2/CO'
import CA from 'country-flag-icons/react/3x2/CA'
import IT from 'country-flag-icons/react/3x2/IT'
import UY from 'country-flag-icons/react/3x2/UY'
import PE from 'country-flag-icons/react/3x2/PE'
import KE from 'country-flag-icons/react/3x2/KE'
import GT from 'country-flag-icons/react/3x2/GT'
import ES from 'country-flag-icons/react/3x2/ES'
import US from 'country-flag-icons/react/3x2/US'
import BO from 'country-flag-icons/react/3x2/BO'
import BR from 'country-flag-icons/react/3x2/BR'
import PY from 'country-flag-icons/react/3x2/PY'
import AU from 'country-flag-icons/react/3x2/AU'

export default function CardsCarousel() {
  const { t } = useTranslation();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [expandedCard, setExpandedCard] = useState(null);
  const [isHovering, setIsHovering] = useState(false);
  const [shuffledCards, setShuffledCards] = useState([]);
  const isClient = useIsClient();

  // Array de tarjetas/testimonios con claves de categoría
  const cards = useMemo(() => [
    {
      id: 1,
      nombre: "Sofía R. (26)",
      paisOrigen: "Argentina",
      paisDestino: "Alemania",
      categoriaKey: "educacion_y_centros_de_estudios_name",
      historia: "Quiero hacer un máster en Berlín, pero me preocupa si el frío me va a jugar en contra para concentrarme.",
      color: "bg-purple-500",
    },
    {
      id: 2,
      nombre: "Diego M. (32)",
      paisOrigen: "México",
      paisDestino: "Francia",
      categoriaKey: "educacion_y_centros_de_estudios_name",
      historia: "Busco estudiar gastronomía en Lyon, pero no sé si podré pagar todo sin chambear a la par.",
      color: "bg-purple-500",
    },
    {
      id: 3,
      nombre: "Hans P. (29)",
      paisOrigen: "Alemania",
      paisDestino: "Chile",
      categoriaKey: "educacion_y_centros_de_estudios_name",
      historia: "Ich möchte in Santiago Spanisch lernen, aber ich habe Angst, mich einsam zu fühlen.",
      color: "bg-purple-500",
    },
    {
      id: 4,
      nombre: "Camila T. (24)",
      paisOrigen: "Colombia",
      paisDestino: "Canadá",
      categoriaKey: "educacion_y_centros_de_estudios_name",
      historia: "Quiero especializarme en animación 3D, pero me asusta el costo de vida tan alto allá, parce.",
      color: "bg-purple-500",
    },
    {
      id: 5,
      nombre: "Francesca L. (27)",
      paisOrigen: "Italia",
      paisDestino: "Uruguay",
      categoriaKey: "educacion_y_centros_de_estudios_name",
      historia: "Vorrei studiare veterinaria a Montevideo, ma temo di non trovare subito un alloggio vicino all'università.",
      color: "bg-purple-500",
    },
    {
      id: 6,
      nombre: "Valentina F. (30)",
      paisOrigen: "Uruguay",
      paisDestino: "Perú",
      categoriaKey: "voluntariados_y_centros_de_ayuda_name",
      historia: "Quiero ayudar en un centro infantil en Cusco, pero me preocupa el mal de altura.",
      color: "bg-red-500",
    },
    {
      id: 7,
      nombre: "Lucas J. (35)",
      paisOrigen: "Argentina",
      paisDestino: "Kenia",
      categoriaKey: "voluntariados_y_centros_de_ayuda_name",
      historia: "Me motiva colaborar en un proyecto de agua potable, pero me inquieta la seguridad en ciertas zonas.",
      color: "bg-red-500",
    },
    {
      id: 8,
      nombre: "Paolo C. (28)",
      paisOrigen: "Italia",
      paisDestino: "Guatemala",
      categoriaKey: "voluntariados_y_centros_de_ayuda_name",
      historia: "Vorrei aiutare in un ospedale rurale, ma temo di non capire bene il dialetto locale.",
      color: "bg-red-500",
    },
    {
      id: 9,
      nombre: "Mariana S. (26)",
      paisOrigen: "Colombia",
      paisDestino: "España",
      categoriaKey: "voluntariados_y_centros_de_ayuda_name",
      historia: "Quiero ser voluntaria en un comedor en Sevilla, pero me preocupa no conseguir un cuarto barato, parce.",
      color: "bg-red-500",
    },
    {
      id: 10,
      nombre: "Emily T. (22)",
      paisOrigen: "Estados Unidos",
      paisDestino: "Bolivia",
      categoriaKey: "voluntariados_y_centros_de_ayuda_name",
      historia: "I want to support wildlife rescue in Santa Cruz, but I'm worried about the humid heat.",
      color: "bg-red-500",
    },
    {
      id: 11,
      nombre: "Sergio L. (38)",
      paisOrigen: "Argentina",
      paisDestino: "Canadá",
      categoriaKey: "gestiones_migratorias_y_visas_name",
      historia: "Quiero tramitar la residencia permanente, pero me asusta que el papeleo sea eterno.",
      color: "bg-blue-500",
    },
    {
      id: 12,
      nombre: "Laura P. (29)",
      paisOrigen: "México",
      paisDestino: "Alemania",
      categoriaKey: "gestiones_migratorias_y_visas_name",
      historia: "Busco visa de trabajo, pero no sé si me acepten sin título universitario, la neta.",
      color: "bg-blue-500",
    },
    {
      id: 13,
      nombre: "Johannes B. (34)",
      paisOrigen: "Alemania",
      paisDestino: "Brasil",
      categoriaKey: "gestiones_migratorias_y_visas_name",
      historia: "Ich möchte ein Arbeitsvisum beantragen, aber ich habe Angst, dass die Anforderungen zu hoch sind.",
      color: "bg-blue-500",
    },
    {
      id: 14,
      nombre: "Pedro V. (31)",
      paisOrigen: "Paraguay",
      paisDestino: "Estados Unidos",
      categoriaKey: "gestiones_migratorias_y_visas_name",
      historia: "Quiero una visa para emprender en Miami, pero me preocupa el costo de los abogados.",
      color: "bg-blue-500",
    },
    {
      id: 15,
      nombre: "Lucia F. (27)",
      paisOrigen: "España",
      paisDestino: "Chile",
      categoriaKey: "gestiones_migratorias_y_visas_name",
      historia: "Busco visa de estudiante, pero temo que me pidan demasiados papeles.",
      color: "bg-blue-500",
    },
    {
      id: 16,
      nombre: "Marcos L. (40)",
      paisOrigen: "Chile",
      paisDestino: "Estados Unidos",
      categoriaKey: "salud_y_centros_medicos_name",
      historia: "Necesito una cirugía cardíaca, pero temo no poder costear la recuperación allá.",
      color: "bg-green-500",
    },
    {
      id: 17,
      nombre: "Patricia G. (35)",
      paisOrigen: "México",
      paisDestino: "España",
      categoriaKey: "salud_y_centros_medicos_name",
      historia: "Voy por un tratamiento oncológico, pero me preocupa conseguir un traductor médico, la neta.",
      color: "bg-green-500",
    },
    {
      id: 18,
      nombre: "Jorge S. (45)",
      paisOrigen: "Argentina",
      paisDestino: "Alemania",
      categoriaKey: "salud_y_centros_medicos_name",
      historia: "Voy a un trasplante de hígado, pero temo que el clima frío afecte mi recuperación.",
      color: "bg-green-500",
    },
    {
      id: 19,
      nombre: "Isabella M. (29)",
      paisOrigen: "Italia",
      paisDestino: "Brasil",
      categoriaKey: "salud_y_centros_medicos_name",
      historia: "Devo fare una riabilitazione, ma temo di non trovare strutture adeguate vicino alla spiaggia.",
      color: "bg-green-500",
    },
    {
      id: 20,
      nombre: "Andrés P. (33)",
      paisOrigen: "Colombia",
      paisDestino: "Estados Unidos",
      categoriaKey: "salud_y_centros_medicos_name",
      historia: "Necesito terapia física, pero me preocupa que el seguro no cubra todo, parce.",
      color: "bg-green-500",
    },
    {
      id: 21,
      nombre: "Mateo R. (34)",
      paisOrigen: "Argentina",
      paisDestino: "España",
      categoriaKey: "emprendimientos_y_negocios_name",
      historia: "Quiero abrir una cafetería en Valencia, pero me preocupa la competencia feroz.",
      color: "bg-indigo-500",
    },
    {
      id: 22,
      nombre: "Gabriela S. (28)",
      paisOrigen: "México",
      paisDestino: "Canadá",
      categoriaKey: "emprendimientos_y_negocios_name",
      historia: "Busco expandir mi marca de ropa, pero me asusta no entender la contabilidad allá, la neta.",
      color: "bg-indigo-500",
    },
    {
      id: 23,
      nombre: "Klaus W. (40)",
      paisOrigen: "Alemania",
      paisDestino: "Brasil",
      categoriaKey: "emprendimientos_y_negocios_name",
      historia: "Ich möchte ein Restaurant eröffnen, aber ich habe Angst vor der Bürokratie.",
      color: "bg-indigo-500",
    },
    {
      id: 24,
      nombre: "Andrea L. (31)",
      paisOrigen: "Uruguay",
      paisDestino: "Estados Unidos",
      categoriaKey: "emprendimientos_y_negocios_name",
      historia: "Quiero lanzar mi startup en Austin, pero me preocupa no encontrar inversores rápido.",
      color: "bg-indigo-500",
    },
    {
      id: 25,
      nombre: "Paolo G. (29)",
      paisOrigen: "Italia",
      paisDestino: "Chile",
      categoriaKey: "emprendimientos_y_negocios_name",
      historia: "Vorrei aprire un laboratorio artigianale a Santiago, ma temo di non capire subito le leggi locali.",
      color: "bg-indigo-500",
    },
    {
      id: 26,
      nombre: "Ana M. (25)",
      paisOrigen: "Colombia",
      paisDestino: "Francia",
      categoriaKey: "empleos_temporales_name",
      historia: "Quiero trabajar en la vendimia, pero me preocupa el frío en la madrugada, parce.",
      color: "bg-orange-500",
    },
    {
      id: 27,
      nombre: "Lucas F. (30)",
      paisOrigen: "Argentina",
      paisDestino: "Australia",
      categoriaKey: "empleos_temporales_name",
      historia: "Busco empleo de temporada en granjas, pero temo que el inglés me juegue en contra.",
      color: "bg-orange-500",
    },
    {
      id: 28,
      nombre: "Franz K. (33)",
      paisOrigen: "Alemania",
      paisDestino: "Perú",
      categoriaKey: "empleos_temporales_name",
      historia: "Ich möchte in Cusco als Koch arbeiten, aber ich habe Angst vor der Höhe.",
      color: "bg-orange-500",
    },
    {
      id: 29,
      nombre: "María P. (27)",
      paisOrigen: "México",
      paisDestino: "España",
      categoriaKey: "empleos_temporales_name",
      historia: "Quiero trabajar en un hotel en Mallorca, pero me preocupa conseguir alojamiento barato, la neta.",
      color: "bg-orange-500",
    },
    {
      id: 30,
      nombre: "Fabio D. (41)",
      paisOrigen: "Italia",
      paisDestino: "Chile",
      categoriaKey: "empleos_temporales_name",
      historia: "Vorrei fare la stagione in un resort, ma temo di non reggere il ritmo.",
      color: "bg-orange-500",
    },
    {
      id: 31,
      nombre: "Thiago M. (29)",
      paisOrigen: "Brasil",
      paisDestino: "Argentina",
      categoriaKey: "deportes_y_entrenamientos_name",
      historia: "Quero treinar jiu-jitsu em Buenos Aires, mas tenho medo do frio atrapalhar meu desempenho.",
      color: "bg-pink-500",
    },
    {
      id: 32,
      nombre: "Laura G. (24)",
      paisOrigen: "Argentina",
      paisDestino: "España",
      categoriaKey: "deportes_y_entrenamientos_name",
      historia: "Quiero perfeccionarme en tenis en Barcelona, pero temo lesionarme lejos de casa.",
      color: "bg-pink-500",
    },
    {
      id: 33,
      nombre: "Hugo P. (34)",
      paisOrigen: "Francia",
      paisDestino: "México",
      categoriaKey: "deportes_y_entrenamientos_name",
      historia: "Je veux m'entraîner en boxe à Mexico, mais j'ai peur de ne pas supporter la chaleur.",
      color: "bg-pink-500",
    },
    {
      id: 34,
      nombre: "Sebastián R. (32)",
      paisOrigen: "Uruguay",
      paisDestino: "Brasil",
      categoriaKey: "deportes_y_entrenamientos_name",
      historia: "Quiero aprender capoeira en Salvador, pero me preocupa adaptarme al ritmo de los entrenos.",
      color: "bg-pink-500",
    },
    {
      id: 35,
      nombre: "Giulia F. (26)",
      paisOrigen: "Italia",
      paisDestino: "Chile",
      categoriaKey: "deportes_y_entrenamientos_name",
      historia: "Vorrei fare sci sulle Ande, ma temo di non essere pronta per l'altitudine.",
      color: "bg-pink-500",
    },
  ], []);

  const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  useEffect(() => {
    setShuffledCards(shuffleArray(cards));
  }, [cards]);

  // //Auto-advance carousel (bucle) - pausar si hay interacción o hover
  useEffect(() => {
    const timer = setInterval(() => {
      // No avanzar automáticamente si hay una tarjeta expandida o si está en hover
      if (expandedCard !== null || isHovering) return;

      setCurrentSlide((prev) => {
        if (typeof window === "undefined") return prev;

        const increment =
          window.innerWidth >= 1024 ? 3 : window.innerWidth >= 768 ? 3 : 1;
        const nextIndex = prev + increment;

        // Si llegamos al final, volver al inicio (bucle)
        if (nextIndex >= shuffledCards.length) {
          return 0;
        }

        return nextIndex;
      });
    }, 3000); // Cambia cada 3 segundos

    return () => clearInterval(timer);
  }, [shuffledCards.length, expandedCard, isHovering]);

  const nextSlide = () => {
    setCurrentSlide((prev) => {
      if (typeof window === "undefined") return prev;
      const increment =
        window.innerWidth >= 1024 ? 3 : window.innerWidth >= 768 ? 3 : 1;
      const nextIndex = prev + increment;

      // Si llegamos al final, volver al inicio (bucle)
      if (nextIndex >= shuffledCards.length) {
        return 0;
      }

      return nextIndex;
    });
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => {
      if (typeof window === "undefined") return prev;
      const increment =
        window.innerWidth >= 1024 ? 3 : window.innerWidth >= 768 ? 3 : 1;
      const prevIndex = prev - increment;

      // Si vamos antes del inicio, ir al final
      if (prevIndex < 0) {
        // Calcular la última posición válida
        const maxSlides = Math.ceil(shuffledCards.length / increment) - 1;
        return maxSlides * increment;
      }

      return prevIndex;
    });
  };

  const isAtEnd = () => {
    if (typeof window === "undefined") return false;
    const increment =
      window.innerWidth >= 1024 ? 3 : window.innerWidth >= 768 ? 3 : 1;
    return currentSlide + increment >= shuffledCards.length;
  };

  const isAtStart = () => {
    return currentSlide === 0;
  };

  // Función para calcular el número total de "páginas" de dots
  const getTotalDots = () => {
    if (typeof window === "undefined")
      return Math.ceil(shuffledCards.length / 3); // fallback
    const increment =
      window.innerWidth >= 1024 ? 3 : window.innerWidth >= 768 ? 3 : 1;
    return Math.ceil(shuffledCards.length / increment);
  };

  // Función para calcular el dot activo actual
  const getCurrentDotIndex = () => {
    if (typeof window === "undefined") return Math.floor(currentSlide / 3); // fallback
    const increment =
      window.innerWidth >= 1024 ? 3 : window.innerWidth >= 768 ? 3 : 1;
    return Math.floor(currentSlide / increment);
  };

  const handleTouchStart = (e) => {
    if (window.innerWidth >= 1024) return; // Solo en mobile y tablet
    setIsDragging(true);
    setStartX(e.touches[0].clientX);
  };

  const handleTouchMove = (e) => {
    if (!isDragging || window.innerWidth >= 1024) return;
    e.preventDefault();
  };

  const handleTouchEnd = (e) => {
    if (!isDragging || window.innerWidth >= 1024) return;
    setIsDragging(false);

    const endX = e.changedTouches[0].clientX;
    const diff = startX - endX;
    const threshold = 50; // Mínimo de 50px para hacer swipe

    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        // Swipe izquierda - ir al siguiente
        nextSlide();
      } else {
        // Swipe derecha - ir al anterior
        prevSlide();
      }
    }
  };

  const handleMouseDown = (e) => {
    if (window.innerWidth >= 1024) return; // Solo en mobile y tablet
    setIsDragging(true);
    setStartX(e.clientX);
  };

  const handleMouseMove = (e) => {
    if (!isDragging || window.innerWidth >= 1024) return;
    e.preventDefault();
  };

  const handleMouseUp = (e) => {
    if (!isDragging || window.innerWidth >= 1024) return;
    setIsDragging(false);

    const endX = e.clientX;
    const diff = startX - endX;
    const threshold = 50;

    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        nextSlide();
      } else {
        prevSlide();
      }
    }
  };

  const getVisibleCards = () => {
    const visible = [];

    if (typeof window !== "undefined") {
      if (window.innerWidth >= 1024) {
        // Desktop: siempre mostrar 3 completos + 1 parcial (si existe)
        for (let i = 0; i < 4; i++) {
          const index = currentSlide + i;
          if (index < shuffledCards.length) {
            visible.push(shuffledCards[index]);
          }
        }
      } else if (window.innerWidth >= 768) {
        // Tablet: 3 completos + 1 parcial (si existe)
        for (let i = 0; i < 4; i++) {
          const index = currentSlide + i;
          if (index < shuffledCards.length) {
            visible.push(shuffledCards[index]);
          }
        }
      } else {
        // Mobile: solo 1 completo
        const index = currentSlide;
        if (index < shuffledCards.length) {
          visible.push(shuffledCards[index]);
        }
      }
    } else {
      // Fallback para SSR
      for (let i = 0; i < 4; i++) {
        const index = currentSlide + i;
        if (index < shuffledCards.length) {
          visible.push(shuffledCards[index]);
        }
      }
    }

    return visible;
  };

  const handleCardClick = (cardId) => {
    // Solo en mobile (menos de 1024px)
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setExpandedCard(expandedCard === cardId ? null : cardId);
    }
  };

  if (!isClient) {
    return <div>Cargando...</div>;
  }

  return (
    <>
      {/* Contenedor con fondo degradé */}
      <div
        className="relative w-full mx-auto px-4 py-8 mb-12 rounded-3xl mt-12 z-10"
        style={{
          background:
            "linear-gradient(90deg, #08D9BD 0%, #04B5BD 50%, #009ABC 100%)",
        }}
      >
        <h1 className="text-[22px] md:text-[25.76px] text-white text-center font-bold">
          {t("historias_como_la_tuya")}
        </h1>
        <p className="text-[14px] md:text-[16px] my-4 text-white text-center">
          {t("muchos_ya_se")}
        </p>

        {/* Container del carousel con padding interno */}
        <div
          className="relative overflow-hidden touch-pan-x px-6 py-4"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            setIsDragging(false);
            setIsHovering(false);
          }}
          onMouseEnter={() => setIsHovering(true)}
          style={{
            cursor: isDragging ? "grabbing" : "grab",
            userSelect: "none",
          }}
        >
          <div
            className={`flex transition-transform duration-500 ease-in-out ${
              isDragging ? "transition-none" : ""
            }`}
          >
            {/* Mobile: 1 slide completo */}
            <div className="flex md:hidden w-full">
              {getVisibleCards().map((card, index) => (
                <div
                  key={`${card.id}-${currentSlide}-${index}`}
                  className="flex-shrink-0 w-full px-3"
                  style={{ touchAction: "pan-y" }}
                >
                  <CardItem
                    card={card}
                    isPartial={false}
                    onCardClick={handleCardClick}
                    isExpanded={expandedCard === card.id}
                  />
                </div>
              ))}
            </div>

            {/* Tablet: 3.5 slides - Con scroll horizontal */}
            <div className="hidden md:flex lg:hidden w-full">
              {getVisibleCards().map((card, index) => {
                const totalVisible = getVisibleCards().length;
                const isLast = index === totalVisible - 1;
                const hasPartialNext = currentSlide + 3 < shuffledCards.length;

                return (
                  <div
                    key={`${card.id}-${currentSlide}-${index}`}
                    className={`flex-shrink-0 ${
                      index < 3 ? "w-1/3" : "w-1/6"
                    } px-3`}
                    style={{ touchAction: "pan-y" }}
                  >
                    <CardItem
                      card={card}
                      isPartial={isLast && hasPartialNext}
                      onCardClick={handleCardClick}
                      isExpanded={expandedCard === card.id}
                    />
                  </div>
                );
              })}
            </div>

            {/* Desktop: 3 completos + 1 parcial */}
            <div className="hidden lg:flex w-full">
              {getVisibleCards().map((card, index) => (
                <div
                  key={`${card.id}-${currentSlide}-${index}`}
                  className={`flex-shrink-0 px-3 ${
                    index < 3
                      ? "w-[calc(33.333%-12px)]" // 3 tarjetas completas con más padding
                      : "w-[calc(16.667%-12px)]" // 1 tarjeta parcial con más padding
                  }`}
                >
                  <CardItem
                    card={card}
                    isPartial={index >= 3}
                    onCardClick={handleCardClick}
                    isExpanded={false} // En desktop no se expande con click
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Flechas de navegación */}
        {!isAtStart() && (
          <button
            onClick={prevSlide}
            className="absolute sm:left-2 left-4 top-1/2 transform -translate-y-1/2 bg-white rounded-full p-3 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 z-10 flex items-center justify-center"
            aria-label="Slide anterior"
          >
            <ChevronRight className="h-6 w-6 text-gray-600 rotate-180" />
          </button>
        )}

        {!isAtEnd() && (
          <button
            onClick={nextSlide}
            className="absolute sm:right-2 right-4 top-1/2 transform -translate-y-1/2 bg-white rounded-full p-3 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 z-10 flex items-center justify-center"
            aria-label="Siguiente slide"
          >
            <ChevronRight className="h-6 w-6 text-gray-600" />
          </button>
        )}

        {/* Dots indicadores */}
        <div className="flex justify-center mt-6 space-x-3">
          {Array.from({ length: getTotalDots() }).map((_, index) => (
            <div
              key={index}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                index === getCurrentDotIndex()
                  ? "bg-white scale-110"
                  : "bg-white/50 hover:bg-white/70"
              }`}
            />
          ))}
        </div>
        <div className="flex flex-col justify-center items-center space-y-4 sm:mt-6">
          <p className="text-center text-[14px] md:text-[16px] text-white">
            {t("existen_puertas_abiertas")}
          </p>
          <ButtonSolid
            title={t("quiero_comenzar_mi_viaje")}
            hexButton="#15A4AE"
            redirectTo="/buscar"
            classStyle="w-[15rem] md:w-auto text-[14px] sm:text-sm lg:text-lg bg-teal-500 hover:bg-teal-600 text-white lg:px-12 py-3 rounded-lg font-medium transition-colors"
          />
        </div>
      </div>
    </>
  );
}

// Componente para cada tarjeta de testimonio
function CardItem({
  card,
  isPartial = false,
  onCardClick,
  isExpanded = false,
}) {
  const { t } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 1024;

  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (isMobile && onCardClick) {
      onCardClick(card.id);
    }
  };

  const handleMouseEnter = () => {
    if (!isMobile) {
      setIsHovered(true);
    }
  };

  const handleMouseLeave = () => {
    if (!isMobile) {
      setIsHovered(false);
    }
  };

  const getCountryFlag = (pais) => {
    const flagComponents = {
      Argentina: AR,
      México: MX, 
      Alemania: DE,
      Francia: FR,
      Chile: CL,
      Colombia: CO,
      Canadá: CA,
      Italia: IT,
      Uruguay: UY,
      Perú: PE,
      Kenia: KE,
      Guatemala: GT,
      España: ES,
      "Estados Unidos": US,
      Bolivia: BO,
      Brasil: BR,
      Paraguay: PY,
      Australia: AU,
    };
  
    const FlagComponent = flagComponents[pais];
    
    if (FlagComponent) {
      return (
        <FlagComponent 
          className="w-6 h-4 rounded-sm inline-block mr-2" 
          title={`Bandera de ${pais}`}
        />
      );
    }
    
    return (
      <div className="w-6 h-4 bg-gray-300 rounded-sm flex items-center justify-center text-xs mr-2">
        🌍
      </div>
    );
  };
  

  const getCategoryIcon = (categoriaKey) => {
    const iconMap = {
      "educacion_y_centros_de_estudios_name": "/educacion.png",
      "voluntariados_y_centros_de_ayuda_name": "/voluntariados.png",
      "gestiones_migratorias_y_visas_name": "/gestiones.png",
      "salud_y_centros_medicos_name": "/salud.png",
      "emprendimientos_y_negocios_name": "/emprender.png",
      "empleos_temporales_name": "/empleos.png",
      "deportes_y_entrenamientos_name": "/deportes.png",
    };

    const iconSrc = iconMap[categoriaKey] || "/default-icon.png";

    return (
      <Image
        src={iconSrc}
        alt={t(categoriaKey)}
        width={20}
        height={20}
        className="w-10 h-10 object-contain"
      />
    );
  };

  return (
    <div
      className={`group relative rounded-[36px] overflow-hidden transition-all duration-300 shadow-2xl hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] hover:scale-105 hover:-translate-y-2 cursor-pointer h-80 ${
        isPartial ? "opacity-75" : ""
      }`}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Fondo con color según categoría */}
      <div className="absolute inset-0 bg-white transition-transform duration-300 group-hover:scale-105">
        {/* Overlay negro con 40% de opacidad */}
        {/* Overlay gradient */}
      </div>

      {/* Contenido original - visible por defecto */}
      <div className="absolute inset-0 flex flex-col p-6 transition-opacity duration-300 z-10">
        {/* Avatar con iniciales */}

        <h3 className="text-black font-bold text-[20px] lg:text-[20px] md:text-[14px] leading-tight drop-shadow-lg text-center mb-2">
          <span className="mr-2">{getCountryFlag(card.paisOrigen)}</span>
          {card.nombre}
        </h3>

        <div className="text-black text-[12px] flex items-center justify-center my-2">
          <Plane className="w-6 h-6 md:w-4 md:h-4 fill-current text-black" />
          <span className="font-medium ml-2">{card.paisDestino}</span>
        </div>

        <div className="text-black text-[12px] px-3 pb-1 rounded-full flex justify-center items-center">
          {getCategoryIcon(card.categoriaKey)}
          {t(card.categoriaKey)}
        </div>

        <div className="flex flex-row space-x-4 mt-1">
          <Quote
            className="w-12 h-12 fill-current text-blue-600"
            style={{
              // Forzar color y opacidad del icono en iOS
              color: "#2563eb",
              fill: "#2563eb",
              opacity: "1",
              transform: "translateZ(0)",
              WebkitTransform: "translateZ(0)",
            }}
          />
          <p
            className="text-[17px] font-bold"
            style={{
              // Forzar color de texto y opacidad en iOS
              color: "#000000 !important",
              WebkitTextFillColor: "#000000",
              opacity: "1",
              fontWeight: "bold",
              // Prevenir problemas de transparencia
              backgroundColor: "transparent",
              mixBlendMode: "normal",
              WebkitMixBlendMode: "normal",
              // Optimizaciones de rendering
              transform: "translateZ(0)",
              WebkitTransform: "translateZ(0)",
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              // Forzar anti-aliasing
              WebkitFontSmoothing: "antialiased",
              MozOsxFontSmoothing: "grayscale",
            }}
          >
            {card.historia}
          </p>
        </div>
      </div>
    </div>
  );
}
