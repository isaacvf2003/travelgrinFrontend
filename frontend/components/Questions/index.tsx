"use client";
import { useState } from "react";
import { ChevronDown, Sparkles, Globe, Heart, Lightbulb } from "lucide-react";
import Image from "next/image";
import { useTranslation } from "@/app/hooks/useTranslation";
const FAQItem = ({ question, answer, isOpen, onToggle }) => (
  <div className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 hover:scale-[1.01] group border border-gray-100">
    {/*STYLOS CARD:  shadow-lg  hover:shadow-xl transition-all duration-300 hover:scale-[1.01] */}
    <button
      onClick={onToggle}
      className="w-full p-6 text-left flex items-center justify-between hover:bg-gray-50 transition-all duration-300"
    >
      <div className="flex items-center gap-4">
        <div
          
          className="p-3 w-[10rem] md:w-[5rem] rounded-full text-white group-hover:scale-110 transition-transform duration-300"
        >
          <Image width={100} height={100} alt="question icon" src={"/question-icon.svg"}/>
        </div>
        <h3 className="text-[16px] md:text-lg font-semibold text-gray-800 group-hover:text-[#15A4AE] transition-colors">
          {question}
        </h3>
      </div>
      <ChevronDown
        size={24}
        className={`text-[#15A4AE] transition-transform duration-300 ${
          isOpen ? "rotate-180" : ""
        }`}
      />
    </button>

    <div
      className={`overflow-hidden transition-all duration-500 ease-in-out ${
        isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
      }`}
    >
      <div className="px-6 pb-6 pl-20">
        <div className=" rounded-xl p-4 bg-gray-100">
          <p className="text-gray-700 leading-relaxed">{answer}</p>
        </div>
      </div>
    </div>
  </div>
);

export default function TravelgrinFAQ() {
  const {t} = useTranslation()
  const [openItems, setOpenItems] = useState({});

  const toggleItem = (index) => {
    setOpenItems((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const faqs = [
    {
      question:
        t("tengo_que_pagar"),
      answer:
        t("no_el_uso"),
    },
    {
      question:t("que_tipo_de"),
      answer:
      t("cualquier_servicio_que"),
    },
    {
      question: t("puedo_usar_travelgrin"),
      answer:
      t("si_aqui_no"),
    },
    {
      question: t("que_diferencia_a"),
      answer:
      t("no_somos_turismo"),
    },
  ];

  return (
    <div className=" bg-gray-50  md:py-16 px-4 pt-[2rem]">
      <div className="max-w-4xl mx-auto">
        {/* Header matching the teal-purple gradient style */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-3 mb-6">
            <h1 style={{ color: "#273166" }} className="text-[22px] md:text-[25.76px] font-bold">
              {t("preguntas_frecuentes")}
            </h1>
          </div>
          <p className="text-[14px] md:text-[16px] text-gray-600 mb-6">
            {t("resolvemos")}
          </p>
          <div
            style={{
              background:
                "linear-gradient(90deg, #08D9BD 0%, #04B5BD 50%, #009ABC 100%)",
            }}
            className="w-24 h-1  mx-auto rounded-full"
          ></div>
        </div>

        {/* FAQ Items with white cards like the design */}
        <div className="space-y-4 mb-16">
          {faqs.map((faq, index) => (
            <FAQItem
              key={index}
              question={faq.question}
              answer={faq.answer}
              icon={faq.icon}
              isOpen={openItems[index]}
              onToggle={() => toggleItem(index)}
            />
          ))}
        </div>

      </div>
    </div>
  );
}
