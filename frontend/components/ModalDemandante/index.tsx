import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import CountrySelectionModalForm from "../CountrySelectionModalForm";
import CategoriesSelect from "../CategoriesSelect";
import DestinationSelect from "../DestinationSelect";
import MaterialTextarea from "../MaterialTextarea";
import MaterialInputs from "../MaterialInput";
import Image from "next/image";
import { Search } from "lucide-react";
import ButtonSolid from "../ButtonSolid";
import toast from "react-hot-toast";
import { useTranslation } from "@/app/hooks/useTranslation";
import { pickI18nText } from "@/app/lib/i18nContent";
import TurnstileWidget from "@/components/TurnstileWidget";

type Props = {
  selectedCountry: string | null;
  setSelectedCountry: (country: string) => void;
  onClose: () => void;
  categorySelected?: string;
  destinationCountrySelected?: string;
};



export const LockClosedIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path
      fillRule="evenodd"
      d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
      clipRule="evenodd"
    />
  </svg>
);

type DemandanteData = {
  taxonomyType: string;
  category: string;
  country: string;
  destinationCountry: string;
  whatSearching: string;
  whatStop: string;
  email: string;
};

type Category = {
  id: string;
  description: string;
  descriptionI18n?: Record<string, string> | null;
  isPrimaryCategory?: boolean;
  visibleInCard?: boolean;
  isPublicVisible?: boolean;
  order?: number;
};

const getCountryName = (value: unknown) => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const country = value as { spanishName?: string; name?: { common?: string } };
    return country.spanishName || country.name?.common || "";
  }
  return "";
};

export default function ModalDemandante({
  selectedCountry,
  setSelectedCountry,
  onClose,
  categorySelected,
  destinationCountrySelected,
}: Props) {
  const { t, locale } = useTranslation()
  const [categoryItems, setCategoryItems] = React.useState<Category[]>([]);

  const categories = React.useMemo(
    () => categoryItems
      .filter((category) => (category.visibleInCard ?? category.isPrimaryCategory) === true && category.isPublicVisible !== false)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.description || "").localeCompare(b.description || ""))
      .map((category) => ({
        value: category.description,
        label: pickI18nText(category.descriptionI18n ?? null, locale, category.description),
      }))
      .filter((category) => category.value),
    [categoryItems, locale]
  );
  const [country, setCountry] = React.useState<string>("");
  const [destinationCountry, setDestinationCountry] = React.useState<string>(
    destinationCountrySelected || ""
  );
  const [selectedCategory, setCategory] = React.useState(
    categorySelected || ""
  );
  const [whatSearching, setWhatSearching] = React.useState("");
  const [whatStop, setWhatStop] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [isEmptyCountry, setIsEmptyCountry] = React.useState(false);
  const [isEmptyEmail, setIsEmptyEmail] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const [emailError, setEmailError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);

  // Hook para mounted state
  useEffect(() => {
    setMounted(true);
  }, []);

  // Hook para inicializar el país desde selectedCountry
  useEffect(() => {
    if (selectedCountry) {
      setCountry(selectedCountry);
    }
  }, [selectedCountry]);

  useEffect(() => {
    let active = true;
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        setCategoryItems(Array.isArray(data?.items) ? data.items : []);
      })
      .catch(() => {
        if (active) setCategoryItems([]);
      });

    return () => {
      active = false;
    };
  }, []);

  // Hook para bloquear el scroll del body y manejar iOS específico
  useEffect(() => {
    // Guardar el valor original del overflow
    const originalOverflow = document.body.style.overflow;
    const originalPosition = document.body.style.position;
    const originalTop = document.body.style.top;
    const scrollY = window.scrollY;

    // Bloquear el scroll específico para iOS
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";

    // Cleanup: restaurar el estado original cuando el modal se desmonte
    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.position = originalPosition;
      document.body.style.top = originalTop;
      document.body.style.width = "auto";
      window.scrollTo(0, scrollY);
    };
  }, []);

  const handleSelectCountry = (country: string) => {
    setSelectedCountry(country);
    setCountry(country);
  };

  const createTravelService = async (serviceData: DemandanteData) => {
    try {
      const response = await fetch("/api/travel-services", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(serviceData),
      });

      if (!response.ok) {
        throw new Error("Error al crear el servicio");
      }

      const newService = await response.json();
      return newService;
    } catch (error) {
      console.error("Error:", error);
      throw error;
    }
  };

  const onSubmit = async () => {
    if (emailError.length > 0) {
      toast.error(t("por_favor"));
      return;
    }
    const countryName = getCountryName(country);
    if (countryName.length === 0) {
      setIsEmptyCountry(true);
      toast.error(t("completar_pasaporte"));
      return;
    } else {
      setIsEmptyCountry(false);
    }

    if (email.length === 0) {
      setIsEmptyEmail(true);
      toast.error(t("completa_campo_email"));
      return;
    } else {
      setIsEmptyEmail(false);
    }
    if (!turnstileToken) {
      toast.error("Completa la verificacion.");
      return;
    }

    setIsLoading(true);
    const searchUrl =
      typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}`
        : "/buscar";
    const serviceData = {
      taxonomyType: "demandante",
      category: selectedCategory,
      country: countryName,
      destinationCountry: getCountryName(destinationCountry),
      whatSearching,
      whatStop,
      email,
      locale,
      typeProfile: "",
      isOfrezco: false,
      isIntermediario: false,
      contanos: "",
      website: "",
      matchAlertEnabled: true,
      matchAlertSearchUrl: searchUrl,
      matchAlertCreatedAt: new Date().toISOString(),
      interestSource: "demandante_search_form",
      turnstileToken,
    };
    
    try {
      await createTravelService(serviceData);
      setIsLoading(false);
      setTurnstileToken("");
      setTurnstileResetKey((value) => value + 1);
      onClose();
      toast.success(t("success_form"));
    } catch (error) {
      setIsLoading(false);
      toast.error(t("error_form"));
    }
  };

  const isDisabled =
    getCountryName(country).length === 0 ||
    email.length === 0 ||
    emailError.length > 0 ||
    !turnstileToken;

  // Función para manejar el cierre del modal
  const handleClose = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    onClose();
  };

  const modalContent = (
    <>
      {/* Portal-style backdrop */}
      <div 
        className="fixed inset-0 bg-black/60"
        style={{ 
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 450,
          touchAction: 'auto'
        }}
        onClick={handleClose}
      />

      {/* Modal container */}
      <div 
        className="fixed inset-0 flex items-start justify-center p-2 pt-2 md:p-4 md:pt-24"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 451,
          pointerEvents: 'none',
          touchAction: 'auto'
        }}
      >
        {/* Contenedor del modal con scroll */}
        <div 
          className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col transition-all duration-300 ease-out transform"
          style={{
            pointerEvents: 'auto',
            maxHeight: '90vh',
            zIndex: 1000000,
            isolation: 'isolate'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header fijo */}
          <div className="flex-shrink-0 p-6 pb-4 border-b border-gray-100">
            <div className="flex flex-row items-start justify-between">
              <Image
                src="/logo-degrade.png"
                width={200}
                height={200}
                className="object-cover w-[10rem] h-[5rem] mb-4"
                alt="logo degrade"
              />
              <button
                onClick={handleClose}
                className="ml-4 p-2 hover:bg-gray-100 rounded-full transition-colors duration-200 flex-shrink-0"
              >
                <svg
                  className="w-5 h-5 text-gray-500"
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

          {/* Contenido con scroll */}
          <div
            style={{ backgroundColor: "#EEEEEE" }}
            className="flex-1 overflow-y-auto p-6 space-y-6"
          >
            <div className="flex items-center justify-center">
              <h1
                style={{ color: "#273166" }}
                className="text-xl font-semibold text-gray-800 leading-tight"
              >
                {t("encontra_lo_que_necesitas")}
              </h1>
            </div>
            
            {/* Selección de país y categoría */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* REQUERIDO PAIS DE PASAPORTE */}
              <div 
                style={{ 
                  position: 'relative',
                  zIndex: 9999999
                }}
              >
                <CountrySelectionModalForm
                  selectedCountry={selectedCountry}
                  setSelectedCountry={handleSelectCountry}
                  isEmpty={isEmptyCountry}
                />
              </div>
              <div 
                style={{ 
                  position: 'relative',
                  zIndex: 9999998
                }}
              >
                <CategoriesSelect
                  categories={categories}
                  selectedCategory={selectedCategory}
                  setCategory={setCategory}
                  placeholder={t("categoria_que_te_interesa")}
                  textCampoRequerido={t("campo_requerido")}
                  
                />
              </div>
            </div>

            {/* Selección de destino */}
            <div 
              style={{ 
                position: 'relative',
                zIndex: 9999997,
                isolation: 'isolate'
              }}
            >
              <DestinationSelect
                destinationCountry={destinationCountry}
                setDestinationCountry={setDestinationCountry}
                label={t("destino_que_te_interesa")}
                customClass="mb-6"
                isInModal={true}
                textBuscarPais={t("buscar_pais")}
                noHayPaises={t("no_hay_paises")}
              />
            </div>

            {/* Textareas */}
            <div className="space-y-4">
              <div>
                <MaterialTextarea
                  value={whatSearching}
                  setValue={setWhatSearching}
                  placeholder={t("que_estas_buscando")}
                  isSearching
                  isContanos
                  textCharsRestantes={t("caracteres_restantes")}
                  textPerfecto={t("perfecto")}
                />
              </div>
              <div>
                <MaterialTextarea
                  value={whatStop}
                  setValue={setWhatStop}
                  placeholder={t("que_te_da")}
                  isStop
                  textCharsRestantes={t("caracteres_restantes")}
                  textPerfecto={t("perfecto")}
                />
              </div>
            </div>

            {/* Input adicional */}
            <div>
              {/* REQUERIDO EMAIL */}
              <MaterialInputs
                isEmpty={isEmptyEmail}
                required
                label={t("tu_email_para")}
                value={email}
                setValue={setEmail}
                setEmailError={setEmailError}
                emailError={emailError}
                isDemandante
                textPorfavor={t("por_favor")}
                textCampoRequerido={t("campo_requerido")}
              />
            </div>
            <div className="text-black flex text-sm space-y-4 text-center justify-center items-center flex-col">
              <TurnstileWidget
                resetKey={turnstileResetKey}
                onTokenChange={setTurnstileToken}
                className="w-full max-w-full rounded-2xl border border-white/80 bg-white/70 p-2 shadow-sm"
              />
              <p style={{ color: "#273166" }}>
                {t("hay_oportunidades_esperandote")}
              </p>
              <div className="flex flex-row items-center">
                <Image
                  src="/persons-3.svg"
                  alt="User Placeholder"
                  width={200}
                  height={100}
                  className="w-[6rem] h-14 rounded-full object-cover"
                />
                <p style={{ color: "#273166" }}>
                  {t("mil_personas_son_parte_form")}
                </p>
              </div>
              <div className="flex flex-row space-x-2 text-center justify-center items-center flex-col">
                <LockClosedIcon className="inline-block h-[2rem]" />
                <span style={{ color: "#273166" }}>{t("tus_datos_estan_protegidos")}</span>
              </div>
            </div>
          </div>

          {/* Footer fijo con botones */}
          <div className="flex-shrink-0 p-6 pt-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
            <div className="flex gap-3 justify-end">
              <ButtonSolid
                hexButton={"#15A4AE"}
                classStyle={`${
                  isLoading || isDisabled ? "text-gray-600" : "text-white"
                } w-full disabled:bg-gray-100 px-6 py-2.5 text-white font-medium rounded-lg hover:from-teal-600 hover:to-blue-600 transition-all duration-200 shadow-md hover:shadow-lg`}
                title={isLoading ? t("guardando"): t("quiero_descubrir")}
                onSubmit={onSubmit}
                hasSubmit
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );

  if (!mounted) return null;

  return createPortal(modalContent, document.body);
}
