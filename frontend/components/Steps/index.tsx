"use client"
import React, { useState } from "react";
import Image from "next/image";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function Steps() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const {t} = useTranslation()

  const steps = [
    {
      id: 1,
      title: t("publica_tu_propuesta"),
      description: t("completa_tu_informacion"),
      iconSrc: "/publica-1.webp",
      cardBg: "bg-white",
      extraIcon: null
    },
    {
      id: 2,
      title: t("mostrate_al_publico_indicado"),
      description: t("tu_oferta_llegara"),
      iconSrc: "/mostrar-2.webp",
      cardBg: "bg-white",
      // extraIcon: {
      //   src: "/maletin_2.png",
      //   classes: "lg:h-[202px] lg:w-[360px] md:h-[100px] md:w-[100px] h-24 w-24 object-contain absolute mt-[10rem] ml-[2rem] md:-mt-[8rem] md:ml-[6rem] lg:-mt-10 lg:-right-[3rem]"
      // }
    },
    {
      id: 3,
      title: t("hace_match_sin_vueltas"),
      description: t("sin_intermediarios_vos"),
      iconSrc: "/match.webp",
      cardBg: "bg-white",
      extraIcon: null
    },
    // {
    //   id: 4,
    //   title: "Es simple, gratis y sin intermediarios",
    //   description: "CargÃ¡ tu propuesta, contÃ¡ quÃ© ofrecÃ©s, cuÃ¡ndo y a quiÃ©n va dirigida. El viajero interesado puede contactarte o incluir tu servicio en su plan personalizado.",
    //   iconSrc: "/help_4.png",
    //   cardBg: "#D3F1ED",
    //   extraIcon: {
    //     src: "/phone_4.png",
    //     classes: "lg:h-[202px] lg:w-[360px] md:h-[100px] md:w-[100px] mt-[18rem] -ml-[7rem] md:mt-[10rem] md:-ml-[12rem] h-24 w-24 object-contain absolute lg:ml-[5rem] lg:mt-[5rem]"
    //   }
    // }
  ];

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % steps.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + steps.length) % steps.length);
  };

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-6xl mx-auto lg:pl-[5rem] sm:pl-0">
        <h1 className="text-white text-center text-[25.76px] font-bold  mb-[0rem] lg:mb-[7rem] relative sm:right-0">
          {t("como_funciona_publicar_en_travelgrin")}
        </h1>

        {/* Desktop Layout - Keep original code unchanged */}
        <div className="hidden lg:block">
          {/* Step 1 */}
          <div className="w-[13rem] sm:w-auto flex flex-row lg:items-center justify-center lg:justify-start gap-8 lg:gap-4 relative lg:px-[10rem]">
            {/* Computer Icon */}
            <div className="flex-shrink-0 h-[300px] w-[150px] md:h-[300px] md:w-[150px] lg:h-[202px] lg:w-[360px] absolute">
              <Image
                src={"/publica-1.webp"}
                width={600}
                height={600}
                alt="Computadora icono"
                className="lg:h-[400px] lg:w-[300px] md:h-[300px] md:w-[150px] h-[300px] w-[150px] object-contain absolute -top-10 right-25 md:-top-20 md:right-45 lg:top-[-11rem] lg:mr-[4rem]"
                style={{ zIndex: 1 }}
              />
            </div>

            {/* Content Card */}
            <div className="bg-white rounded-lg p-6 lg:p-8 lg:max-w-md w-[15rem] md:w-[25rem] shadow-2xl">
              <h1 className="text-[25.76px] font-bold text-gray-800 mb-4 text-center">
              {t("publica_tu_propuesta")}
              </h1>
              <p className="text-gray-600 text-[16px] leading-relaxed text-center">
                {t("completa_tu_informacion")}
              </p>
            </div>

            {/* Step Number */}
            <div className="flex-shrink-0 absolute lg:relative -top-23 lg:-top-20 lg:right-10 md:-top-[10rem] -mr-[17rem] md:-mr-[28rem] z-30">
              <span className="text-white text-[150px] md:text-[260px] lg:text-[260px] lg:text-9xl font-bold opacity-80">
                1
              </span>
            </div>
          </div>

          {/* Step 2 */}
          <div className="w-[13rem] sm:w-auto flex flex-row-reverse lg:items-center justify-center gap-8 lg:gap-4 relative lg:px-[10rem] mt-12 md:mt-[101px] lg:ml-[18rem] xl:ml-[40rem]">
            {/* Computer Icon */}
            <div className="flex-shrink-0 h-24 w-24 lg:h-[400px] lg:w-[300px] absolute lg:mr-[20rem]">
              <Image
                src={"/mostrar-2.webp"}
                width={600}
                height={600}
                alt="Computadora icono"
                className="lg:h-[400px] lg:w-[300px] md:h-[135px] md:w-[135px] h-24 w-24 object-contain absolute -top-10 left-25 md:-top-20 md:left-45 lg:-top-20 lg:left-50"
                style={{ zIndex: 1 }}
              />
            </div>

            {/* Content Card */}
            <div className="bg-white rounded-lg p-6 lg:p-8 lg:max-w-md w-[15rem] md:w-[25rem] shadow-2xl">
              <h1 className="text-[25.76px] font-bold text-gray-800 mb-4 text-center">
              {t("mostrate_al_publico_indicado")}
              </h1>
              <p className="text-gray-600 text-[16px] leading-relaxed text-center">
              {t("tu_oferta_llegara")}
              </p>
            </div>

            {/* Step Number */}
            <div className="ml-[-18rem] sm:ml-0 flex-shrink-0 absolute lg:relative -top-23 lg:-top-20 lg:left-2 md:-top-[10rem] -ml-[21em] md:-ml-[35rem] md:mt-[3rem] z-30">
              <span className="text-white text-[150px] md:text-[260px] lg:text-[260px] lg:text-9xl font-bold opacity-80">
                2
              </span>
              {/* <Image
                src={"/maletin_2.png"}
                width={600}
                height={600}
                alt="Computadora icono"
                className="lg:h-[202px] lg:w-[360px] md:h-[100px] md:w-[100px] h-24 w-24 object-contain absolute mt-[10rem] ml-[2rem] md:-mt-[8rem] md:ml-[6rem] lg:-mt-10 lg:-right-[3rem]"
                style={{ zIndex: 1 }}
              /> */}
            </div>
          </div>

          {/* Step 3 */}
          <div className="w-[13rem] sm:w-auto flex flex-row lg:items-center justify-center lg:justify-start gap-8 lg:gap-4 relative lg:px-[10rem] mt-16 md:mt-22">
            {/* Content Card */}
            <div className="bg-white rounded-lg p-6 lg:p-8 lg:max-w-md w-[15rem] md:w-[25rem] shadow-2xl">
              <h1 className="text-[25.76px] font-bold text-gray-800 mb-4 text-center">
              {t("hace_match_sin_vueltas")}
              </h1>
              <p className="text-gray-600 text-[16px] leading-relaxed text-center">
              {t("sin_intermediarios_vos")}
              </p>
            </div>

            {/* Step Number */}
            <div className="ml-[-3.5rem] sm:ml-0 flex-shrink-0 absolute lg:relative -top-23 lg:-top-12 lg:right-4 md:-top-[7rem] -mr-[20rem] md:-mr-[34rem] z-30">
              <span className="text-white text-[150px] md:text-[260px] lg:text-[260px] lg:text-9xl font-bold opacity-80">
                3
              </span>
            </div>
            
            <Image
              src={"/match.webp"}
              width={600}
              height={600}
              alt="Mundo icono"
              className="lg:h-[400px] lg:w-[300px] md:h-[100px] md:w-[100px] h-24 w-24 object-contain lg:ml-[-12rem] absolute mt-[14.3rem] md:mt-[9rem] md:-ml-[26rem] -ml-[15rem]"
              style={{ zIndex: 1 }}
            />
          </div>

          {/* <div className="w-[13rem] sm:w-auto flex flex-row-reverse lg:items-center justify-center gap-8 lg:gap-4 relative lg:px-[10rem] mt-12 lg:ml-[5rem]">
            <div className="flex-shrink-0 h-24 w-24 lg:h-[202px] lg:w-[360px] absolute lg:mr-[15rem]">
              <Image
                src={"/help_4.png"}
                width={600}
                height={600}
                alt="Computadora icono"
                className="lg:h-[102px] lg:w-[260px] md:h-[135px] md:w-[135px] h-24 w-24 object-contain absolute -top-10 left-25 md:-top-20 md:left-45 lg:-top-20 lg:left-100"
                style={{ zIndex: 1 }}
              />
            </div>

            <div style={{ backgroundColor: "#D3F1ED" }} className="rounded-lg p-6 lg:p-8 lg:max-w-md w-[15rem] md:w-[25rem] shadow-2xl">
              <h1 className="text-[25.76px] font-bold text-gray-800 mb-4 text-center">
                Es simple, gratis y sin intermediarios
              </h1>
              <p className="text-gray-600 text-[16px] leading-relaxed text-center">
                CargÃ¡ tu propuesta, contÃ¡ quÃ© ofrecÃ©s, cuÃ¡ndo y a quiÃ©n va dirigida. El viajero interesado puede contactarte o incluir tu servicio en su plan personalizado.
              </p>
            </div>

            <div className="flex-shrink-0 absolute h-24 w-24 lg:relative z-30">
              <Image
                src={"/phone_4.png"}
                width={600}
                height={600}
                alt="Telefono icono"
                className="lg:h-[202px] lg:w-[360px] md:h-[100px] md:w-[100px] mt-[18rem] -ml-[7rem] md:mt-[10rem] md:-ml-[12rem] h-24 w-24 object-contain absolute lg:ml-[5rem] lg:mt-[5rem]"
                style={{ zIndex: 1 }}
              />
            </div>
          </div>  */}
        </div>

        {/* Mobile/Tablet Carousel */}
        <div className="lg:hidden">
          <div className="relative overflow-hidden">
            <div 
              className="flex transition-transform duration-300 ease-in-out"
              style={{ transform: `translateX(-${currentSlide * 100}%)` }}
            >
              {steps.map((step, index) => (
                <div key={step.id} className="w-full flex-shrink-0 px-4">
                  <div className="relative min-h-[400px] flex items-center justify-center">
                    {/* Card */}
                    <div 
                      className="rounded-lg p-6 max-w-sm shadow-2xl relative z-10 w-[14rem] md:w-[24rem]"
                      style={{ backgroundColor: step.cardBg === "bg-white" ? "white" : step.cardBg }}
                    >
                      <h1 className="text-[25.76px] font-bold text-gray-800 mb-4 text-center">
                        {step.title}
                      </h1>
                      <p className="text-gray-600 text-[16px] leading-relaxed text-center">
                        {step.description}
                      </p>
                    </div>

                    {/* Step Number */}
                    
                    <div className={`absolute z-20 ${step.id > 1 ? "ml-[18rem] mb-[13rem] md:ml-[29rem] md:mb-[11rem]" : "ml-[18rem] mb-[13rem] md:ml-[26rem] md:mb-[11rem] "}`}>
                      <span className="text-white text-[120px] font-bold opacity-80">
                        {step.id}
                      </span>
                    </div>
                   

                    {/* Main Icon */}
                    <div className="absolute top-[-1rem] left-[-4rem] md:ml-[6rem] md:mt-[2rem] z-30">
                      <Image
                        src={step.iconSrc}
                        width={80}
                        height={80}
                        alt={`${step.title} icono`}
                        className="h-[200px] w-[200px] object-contain"
                      />
                    </div>

                    {/* Extra Icon for steps 2 and 4 */}
                    {step.extraIcon && (
                      <div className="absolute mt-[17rem] ml-[14rem] md:mt-[11rem] md:ml-[24rem] z-30">
                        <Image
                          src={step.extraIcon.src}
                          width={60}
                          height={60}
                          alt="Extra icono"
                          className="h-16 w-16 object-contain"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex justify-center items-center mt-8 space-x-6">
            {currentSlide > 0 && (
              <button
                onClick={prevSlide}
                className="group text-black bg-white bg-opacity-10 hover:bg-opacity-20  p-3 rounded-full transition-all duration-300 border border-white border-opacity-20 hover:border-opacity-40 shadow-lg backdrop-blur-sm"
              >
                <svg className="w-5 h-5 transform group-hover:-translate-x-0.5 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}

            {/* Dots   */}
            <div className="flex space-x-3 px-4">
              {steps.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  className={`transition-all duration-300 rounded-full border border-white border-opacity-30 ${
                    currentSlide === index 
                      ? 'w-8 h-3 bg-white shadow-lg' 
                      : 'w-3 h-3 bg-white bg-opacity-40 hover:bg-opacity-70 hover:scale-110'
                  }`}
                />
              ))}
            </div>

            {currentSlide < steps.length - 1 && (
              <button
                onClick={nextSlide}
                className="group text-black bg-white bg-opacity-10 hover:bg-opacity-20  p-3 rounded-full transition-all duration-300 border border-white border-opacity-20 hover:border-opacity-40 shadow-lg backdrop-blur-sm"
              >
                <svg className="w-5 h-5 transform group-hover:translate-x-0.5 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
