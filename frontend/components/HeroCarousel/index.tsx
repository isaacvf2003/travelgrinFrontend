"use client";
import React, { useEffect, useState } from "react";
import ButtonSolid from "../ButtonSolid";
import Image from "next/image";
import { useCountry } from "@/app/context/CountryProvider";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function HeroCarousel() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const { t } = useTranslation();
  const [isMobile, setIsMobile] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const { hideCountryOnOpenModal, setHideCountryOnOpenModal } = useCountry();

  // Array de imágenes hero para desktop/tablet
  const heroImages = [
    "/hero1.webp",
    "/hero2.webp",
    "/hero3.webp",
    "/hero4.webp",
    "/hero5.webp",
  ];

  // Array de imágenes hero para mobile
  const heroImagesMobile = [
    "/hero-mobile-1.webp",
    "/hero-mobile-2.webp",
    "/hero-mobile-3.webp",
    "/hero-mobile-4.webp",
    "/hero-mobile-5.webp",
  ];

  // Asegurar que el componente se hidrate correctamente
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Detectar dispositivo móvil de forma simple y directa
  useEffect(() => {
    if (!isClient) return;

    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkIsMobile();
    window.addEventListener("resize", checkIsMobile);

    return () => window.removeEventListener("resize", checkIsMobile);
  }, [isClient]);

  // Auto-advance carousel
  useEffect(() => {
    if (!isClient) return;

    const currentImages = isMobile ? heroImagesMobile : heroImages;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % currentImages.length);
    }, 2000);

    return () => clearInterval(timer);
  }, [isClient, isMobile]);

  // Reset slide cuando cambia el tipo de dispositivo
  useEffect(() => {
    setCurrentSlide(0);
  }, [isMobile]);

  if (!isClient) {
    return (
      <div className="max-w-[25rem] sm:max-w-[41rem] md:max-w-full mx-auto md:mx-0 relative mt-8 sm:w-full h-[820px] sm:h-[520px] lg:h-[620px] mb-12">
        <div className="w-full h-full bg-gray-200 rounded-[36px] animate-pulse"></div>
      </div>
    );
  }

  const currentImages = isMobile ? heroImagesMobile : heroImages;
  // eslint-disable-next-line react-hooks/rules-of-hooks

  const handleHideCountryOnOpenModal = (hide: boolean) => {
    setHideCountryOnOpenModal?.(hide);
  };
  return (
    <div className="max-w-[25rem] sm:max-w-[41rem] md:max-w-full mx-auto md:mx-0 relative mt-8 sm:w-full h-[820px] sm:h-[520px] lg:h-[620px] mb-12 overflow-hidden rounded-[36px]">
      {/* Contenedor de imágenes con posicionamiento absoluto */}
      <div className="absolute inset-0">
        {currentImages.map((imageSrc, index) => (
          <div
            key={`${isMobile ? "mobile" : "desktop"}-${index}`}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              index === currentSlide ? "opacity-100" : "opacity-0"
            }`}
            style={{
              zIndex: index === currentSlide ? 2 : 1,
            }}
          >
            <Image
              src={imageSrc}
              alt={`Hero ${index + 1}`}
              fill
              className="w-full h-full object-cover"
              priority={index === 0} // Solo la primera imagen como priority
              quality={100} // Reducir calidad ligeramente
              sizes=""
              //placeholder="blur"
              // blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyLrI5SZIXXWnQqNnNgtJbFW6ixBDzwG5kx/9k="
              style={{
                objectPosition: isMobile ? "100% 100%" : "center center",
                // Optimizaciones para iOS
                transform: "translateZ(0)",
                WebkitTransform: "translateZ(0)",
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
              }}
            />
          </div>
        ))}
      </div>

      {/* Overlay */}
      {/* Overlay */}
      <div className="absolute inset-0 bg-opacity-20 z-3"></div>

      {/* Sombra blanca mobile - de arriba hacia abajo */}
      <div className="md:hidden relative z-4">
        <div className="absolute -top-1 left-0 right-0 h-[600px] bg-gradient-to-b from-white/100 via-white/100 to-transparent"></div>
      </div>

      {/* Sombra blanca desktop - de izquierda a derecha */}
      <div className="hidden md:block absolute inset-0 z-5">
        <div className="absolute top-0 left-0 bottom-0 w-[50rem] bg-gradient-to-r from-white/100 via-white/80 to-transparent"></div>
      </div>

      {/* Content */}
      <div className="relative z-5 h-full flex sm:items-center items-start pt-12">
        <div className="max-w-7xl mx-auto px-6 w-full">
          <div className="items-center">
            <div className="text-white">
              <h1
                style={{
                  color: "#273166",
                  fontFamily: "var(--font-montserrat-alternates) !important",
                }}
                className="text-[2rem] sm:text-[2.15rem] lg:text-5xl font-bold leading-tight mb-6 whitespace-pre-line"
              >
                {t("heroTitle")}
              </h1>

              <p
                style={{ color: "#323232" }}
                className="text-[14px] sm:text-[15px] lg:text-lg mb-8 md:w-[23rem]"
              >
                {t("tienes_una_idea")}
              </p>

              {/* Avatares de usuarios */}
              <div className="flex items-center mb-8">
                <div className="flex -space-x-5">
                  <Image
                    src="/persons-3.svg"
                    alt="User Placeholder"
                    width={200}
                    height={100}
                    className="w-[6rem] h-14 rounded-full object-cover"
                  />
                </div>
                <span className="-ml-2 text-[12px] sm:text-sm" style={{ color: "#273166" }}>
                  {t("mil_personas_son_parte")}
                </span>
              </div>

              {/* Botones de acción */}
              <div className="flex flex-col sm:flex-row gap-4">
                <ButtonSolid
                  title={t("viajar_por_un_cambio")}
                  hexButton="#15A4AE"
                  redirectTo="/buscar"
                  classStyle="w-[15rem] md:w-auto text-[14px] sm:text-sm lg:text-lg bg-teal-500 hover:bg-teal-600 text-white lg:px-12 py-3 rounded-lg font-medium transition-colors"
                  isHeaderButton
                  setHideCountryOnOpenModal={handleHideCountryOnOpenModal}
                />
                <ButtonSolid
                  title={t("ofrecer_mi_servicio")}
                  hexButton="#273166"
                  classStyle="w-[15rem] md:w-auto text-[14px] sm:text-sm lg:text-lg bg-blue-900 hover:bg-blue-800 text-white lg:px-8 py-3 rounded-lg font-medium transition-colors"
                  isHeaderButton
                  setHideCountryOnOpenModal={handleHideCountryOnOpenModal}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dots indicadores */}
      <div className="absolute bottom-6 lg:bottom-3 left-1/2 transform -translate-x-1/2 flex space-x-3 z-6">
        {currentImages.map((_, index) => (
          <div
            key={`dot-${isMobile ? "mobile" : "desktop"}-${index}`}
            className={`w-3 h-3 rounded-full transition-all duration-300 cursor-pointer ${
              index === currentSlide
                ? "bg-white md:bg-gray-700 scale-110"
                : "bg-white/50 md:bg-gray-600/80 hover:bg-white/70 md:hover:bg-gray-500"
            }`}
            onClick={() => setCurrentSlide(index)}
          />
        ))}
      </div>
    </div>
  );
}
