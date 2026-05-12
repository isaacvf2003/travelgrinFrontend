"use client";
import { ChevronDown, Search, User } from "lucide-react";
import React, { useState } from "react";
import Image from "next/image";
import { useTranslation } from "@/app/hooks/useTranslation";

type Props = {
  selectedCategory?: string | null;
  setCategory: (category: string) => void;
  categories: { value: string; label: string }[];
  placeholder?: string;
  isEmpty?: boolean;
  required?: boolean;
  showLabel?: boolean;
  containerClass?: string;
  textCampoRequerido?: string;
};

export default function CategoriesSelect({
  selectedCategory,
  setCategory,
  categories,
  placeholder,
  isEmpty = false,
  required = false,
  showLabel = true,
  containerClass = "",
  textCampoRequerido,
}: Props) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
const {t} = useTranslation()
  const selectedOption = categories.find((category) => category.value === selectedCategory);
  const selectedLabel = selectedOption?.label ?? selectedCategory ?? "";
  // Determinar si mostrar error
  const showError = isEmpty;

  const getCategoryIcon = (categoria) => {
    

    const iconMap = {
      [t("educacion_y_centros_de_estudios_name")]: "/educacion.png",
      [t("voluntariados_y_centros_de_ayuda_name")]: "/voluntariados.png",
      [t("gestiones_migratorias_y_visas_name")]: "/gestiones.png",
      [t("salud_y_centros_medicos_name")]: "/salud.png",
      [t("emprendimientos_y_negocios_name")]: "/emprender.png",
      [t("empleos_temporales_name")]: "/empleos.png",
      [t("deportes_y_entrenamientos_name")]: "/deportes.png",
      [t("profesional_independiente")]: "/eco-1-only.svg",
      [t("empresa_privada")]: "/eco-2-only.svg",
      [t("organismo_publico")]: "/eco-3-only.svg",
      [t("ongs")]: "/eco-4-only.svg",
    };

    const iconSrc = iconMap[categoria] || "";

    if (!iconSrc) {
      return null;
    }

    return (
      <Image
        src={iconSrc}
        alt={categoria}
        width={20}
        height={20}
        className="w-10 h-10 object-contain"
      />
    );
  };

  return (
    <div className=" relative flex flex-row w-full text-black">
      <div className="relative w-full">
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className={`${containerClass} w-full flex items-center justify-between p-4 pt-6 rounded-xl transition-all duration-300 bg-white group transform hover:scale-[1.02] focus:scale-[1.02]`}
          style={{
            boxShadow: showError
              ? "0 8px 25px -8px rgba(220, 38, 38, 0.4), 0 4px 12px -4px rgba(220, 38, 38, 0.2)"
              : "0 8px 32px -12px rgba(8, 217, 189, 0.3), 0 4px 16px -6px rgba(4, 181, 189, 0.25), 0 2px 8px -3px rgba(0, 154, 188, 0.2)",
            filter: showError
              ? "drop-shadow(0 4px 8px rgba(220, 38, 38, 0.15))"
              : "drop-shadow(0 4px 12px rgba(8, 217, 189, 0.2))",
          }}
        >
          <div className="flex items-center gap-3">
            {selectedCategory ? (
              <span
                className={`font-medium text-[12px] flex flex-row items-center justify-start text-start space-x-2 ${
                  showError ? "text-red-700" : "text-gray-700"
                }`}
              >
                <span>{getCategoryIcon(selectedLabel)}</span>
                <span>{selectedLabel}</span>
              </span>
            ) : (
              <>
                {placeholder !== "Tipo de perfil" ? (
                  <Search className=" w-5 h-5 text-black relative " />
                ) : (
                  <User className=" w-5 h-5 text-black relative" />
                )}

                <span className="text-gray-600 select-none">{placeholder}</span>
              </>
            )}
          </div>
          <ChevronDown
            className={`w-5 h-5 transition-all duration-200 ${
              showError
                ? "text-red-500"
                : isDropdownOpen
                ? "rotate-180 text-teal-500"
                : "text-gray-400 group-hover:text-teal-500"
            }`}
          />
        </button>

        {/* Label flotante con estado de error */}
        {required && (
          <label
            className={`absolute left-3 bottom-[2rem] transition-all duration-200 pointer-events-none ${
              selectedCategory || isDropdownOpen
                ? "-top-2 text-xs bg-white px-1 font-medium"
                : "top-4 text-base"
            } ${
              showError
                ? "text-red-600"
                : isDropdownOpen
                ? "text-teal-600"
                : "text-gray-600"
            }`}
          >
            {required && " *"}
          </label>
        )}

        {showLabel && (
          <label
            className={`absolute left-3 transition-all duration-200 pointer-events-none ${
              selectedCategory || isDropdownOpen
                ? "-top-2 text-xs bg-white px-1 font-medium"
                : "top-4 text-base"
            } ${
              showError
                ? "text-red-600"
                : isDropdownOpen
                ? "text-teal-600"
                : "text-gray-600"
            }`}
          >
            {required && " *"}
          </label>
        )}

        {/* Mensaje de error */}
        {showError && (
          <div className="flex items-center gap-1 mt-2 text-red-600 text-sm px-1">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            {t("campo_requerido")}
          </div>
        )}
      </div>

      {/* Dropdown con animación */}
      {isDropdownOpen && (
        <div
          className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl z-20 overflow-hidden animate-in slide-in-from-top-2 duration-200"
          style={{
            boxShadow:
              "0 20px 40px -12px rgba(8, 217, 189, 0.25), 0 8px 24px -8px rgba(4, 181, 189, 0.2), 0 4px 12px -4px rgba(0, 154, 188, 0.15)",
            filter: "drop-shadow(0 6px 20px rgba(8, 217, 189, 0.15))",
          }}
        >
          {/* Lista de categorías */}
          <div className="max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
            {categories.map((category, index) => (
              <button
                key={category.value}
                onClick={() => {
                  setCategory(category.value);
                  setIsDropdownOpen(false);
                }}
                className={`w-full flex items-center gap-4 px-4 py-3 hover:bg-gradient-to-r hover:from-teal-50 hover:to-blue-50 transition-all duration-150 text-left border-b border-gray-50 last:border-b-0 group/item ${
                  selectedCategory === category.value
                    ? "bg-gradient-to-r from-teal-100 to-blue-100 text-teal-800"
                    : "text-gray-700 hover:text-teal-700"
                }`}
                style={{
                  animationDelay: `${index * 30}ms`,
                }}
              >
                <span className="font-medium group-hover/item:translate-x-1 transition-transform duration-200 flex flex-row items-center">
                  <span>{getCategoryIcon(category.label)}</span>
                  <span className="text-[14px] ml-2">{category.label}</span>
                </span>
                {selectedCategory === category && (
                  <div className="ml-auto">
                    <svg
                      className="w-5 h-5 text-teal-600"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Footer opcional */}
          {categories.length === 0 && (
            <div className="p-4 text-center text-gray-500 text-sm">
              No hay categorías disponibles
            </div>
          )}
        </div>
      )}

      {/* Backdrop para cerrar dropdown al hacer click fuera */}
      {isDropdownOpen && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setIsDropdownOpen(false)}
        />
      )}
    </div>
  );
}
