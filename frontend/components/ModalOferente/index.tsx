"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import toast from "react-hot-toast";
import { Check, ChevronDown, Globe2, ImagePlus, Languages, Link as LinkIcon, MapPin, Tag, Upload, UserRound } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCountry } from "@/app/context/CountryProvider";
import { RoundedCheckbox } from "../MaterialCheckbox";
import DestinationSelect from "../DestinationSelect";
import MaterialTextarea from "../MaterialTextarea";
import MaterialInputs from "../MaterialInput";
import FloatingAIButton from "../FloatingAIButton";
import ModalAI from "../ModalAI";
import CountryMultiSelect from "../CountryMultiSelect";
import { uploadImageAsset, type ImageAsset } from "@/app/lib/cloudinaryUpload";

type Props = { onClose: () => void };
type Category = { id: string; description: string; taxonomyType: string; isPrimaryCategory?: boolean; isPublicVisible?: boolean; parentId?: string | null };
type FilterOptionLite = { value?: string; label?: string; labelI18n?: Record<string, string> | null };
type FilterGroupLite = { key?: string; label?: string; taxonomyType?: string | null; options?: FilterOptionLite[] };
type SelectOption = { value: string; label: string };
type Step = "basic" | "featured";

const FEATURED_ITEMS = [
  "Aparece primero en resultados",
  "Duración 120 días",
  "Sello destacado",
  "Descripción ampliada",
  "Varios link de contacto",
  "Disponible en 4 idiomas",
  "Galería hasta 5 imágenes",
];

const CURRENCY_OPTIONS = ["ARS", "USD", "EUR", "BRL", "CLP", "COP", "MXN", "PEN", "UYU", "JPY"];
type PriceEntry = { currency: string; amount: string };
type VenueEntry = { country: string; city: string; mapUrl: string };
type ContactKind = "web" | "email" | "youtube" | "instagram" | "facebook" | "whatsapp" | "cellphone" | "linkedin" | "other";
type ContactEntry = { kind: ContactKind; url: string; label: string };

const normalize = (value: string) => String(value ?? "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").trim();

function uniqueOptions(options: SelectOption[]) {
  const seen = new Set<string>();
  return options.filter((option) => {
    const key = normalize(option.value || option.label);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function fileToCompressedImageAsset(file: File) {
  return uploadImageAsset(file, { folder: "oferentes", maxSizeMB: 0.65, maxWidthOrHeight: 1600 });
}

function MultiOptionSelect({
  selectedValues,
  setSelectedValues,
  options,
  placeholder,
  icon = "languages",
  isEmpty = false,
}: {
  selectedValues: string[];
  setSelectedValues: (values: string[]) => void;
  options: SelectOption[];
  placeholder: string;
  icon?: "languages" | "tag" | "user";
  isEmpty?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedLabels = selectedValues
    .map((value) => options.find((option) => normalize(option.value) === normalize(value))?.label ?? value)
    .filter(Boolean);
  const Icon = icon === "tag" ? Tag : icon === "user" ? UserRound : Languages;

  const toggleValue = (value: string) => {
    const exists = selectedValues.some((entry) => normalize(entry) === normalize(value));
    setSelectedValues(exists ? selectedValues.filter((entry) => normalize(entry) !== normalize(value)) : [...selectedValues, value]);
  };

  return (
    <div className="relative w-full text-black">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-2xl bg-white p-4 pt-6 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl focus:scale-[1.01]"
        style={{
          boxShadow: isEmpty
            ? "0 8px 25px -8px rgba(220, 38, 38, 0.4), 0 4px 12px -4px rgba(220, 38, 38, 0.2)"
            : "0 12px 36px -18px rgba(8, 217, 189, 0.55), 0 6px 18px -9px rgba(4, 181, 189, 0.35)",
        }}
      >
        <span className="flex min-w-0 items-center gap-3">
          <Icon className="h-5 w-5 shrink-0 text-[#0B8FA3]" />
          <span className={`truncate ${selectedLabels.length ? "text-gray-700" : "text-gray-600"}`}>
            {selectedLabels.length ? selectedLabels.join(", ") : placeholder}
          </span>
        </span>
        <ChevronDown className={`h-5 w-5 text-gray-400 transition ${isOpen ? "rotate-180 text-teal-500" : ""}`} />
      </button>

      {isOpen ? (
        <div className="absolute left-0 right-0 top-full z-[9999999] mt-2 max-h-64 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-2xl">
          <div className="max-h-64 overflow-y-auto p-2">
            {options.length ? options.map((option) => {
              const checked = selectedValues.some((entry) => normalize(entry) === normalize(option.value));
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggleValue(option.value)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${checked ? "bg-teal-50 text-teal-700" : "text-gray-700 hover:bg-teal-50"}`}
                >
                  <span className={`flex h-4 w-4 items-center justify-center rounded border ${checked ? "border-teal-500 bg-teal-500" : "border-gray-300"}`}>
                    {checked ? <Check className="h-3 w-3 text-white" /> : null}
                  </span>
                  <span>{option.label}</span>
                </button>
              );
            }) : <div className="p-3 text-center text-sm text-gray-500">No hay opciones disponibles</div>}
          </div>
        </div>
      ) : null}

      {isOpen ? <div className="fixed inset-0 z-[9999998]" onClick={() => setIsOpen(false)} /> : null}
    </div>
  );
}

function SingleOptionSelect({
  selectedValue,
  setSelectedValue,
  options,
  placeholder,
}: {
  selectedValue: string;
  setSelectedValue: (value: string) => void;
  options: SelectOption[];
  placeholder: string;
}) {
  return (
    <MultiOptionSelect
      selectedValues={selectedValue ? [selectedValue] : []}
      setSelectedValues={(values) => setSelectedValue(values.at(-1) ?? "")}
      options={options}
      placeholder={placeholder}
      icon="user"
    />
  );
}

function PlanCard({
  title,
  tone,
  price,
  items,
  buttonLabel,
  onClick,
  disabled,
  showPromo = false,
  promoCode = "",
  onPromoCodeChange,
}: {
  title: string;
  tone: "free" | "featured";
  price: string;
  items: string[];
  buttonLabel: string;
  onClick: () => void;
  disabled?: boolean;
  showPromo?: boolean;
  promoCode?: string;
  onPromoCodeChange?: (value: string) => void;
}) {
  const isFeatured = tone === "featured";
  return (
    <div className={`flex h-full flex-col rounded-[1.35rem] border bg-white/95 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)] ${isFeatured ? "border-amber-300" : "border-emerald-300"}`}>
      <div className="flex items-center gap-2 text-sm font-bold text-[#273166]">
        <span className={`h-3 w-3 rounded-full ${isFeatured ? "bg-amber-400" : "bg-emerald-500"}`} />
        {title}
      </div>
      <ul className="mt-4 flex-1 space-y-1.5 text-sm text-slate-700">
        {items.map((item) => <li key={item}>• {item}</li>)}
      </ul>
      <div className="mt-5 text-center text-2xl font-extrabold text-slate-900">{price}</div>
      {showPromo ? (
        <input
          value={promoCode}
          onChange={(event) => onPromoCodeChange?.(event.target.value)}
          className="mt-3 h-9 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-[#00A9C6]/30"
          placeholder="Código promocional"
        />
      ) : null}
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`mt-3 rounded-xl px-4 py-2 text-sm font-bold text-white shadow transition disabled:cursor-not-allowed disabled:opacity-60 ${isFeatured ? "bg-[#D99A00] hover:bg-[#B98200]" : "bg-[#273166] hover:bg-[#1d2550]"}`}
      >
        {buttonLabel}
      </button>
    </div>
  );
}

export default function ModalOferente({ onClose }: Props) {
  const { t, locale } = useTranslation();
  const { selectedCountry } = useCountry();

  const [mounted, setMounted] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filterGroups, setFilterGroups] = useState<FilterGroupLite[]>([]);
  const [step, setStep] = useState<Step>("basic");
  const [isLoading, setIsLoading] = useState(false);
  const [isOpenModalAI, setIsOpenModalAI] = useState(false);

  const [profileName, setProfileName] = useState("");
  const [proposalCategories, setProposalCategories] = useState<string[]>([]);
  const [isOfrezco, setIsOfrezco] = useState(false);
  const [isIntermediario, setIsIntermediario] = useState(false);
  const [destinationCountry, setDestinationCountry] = useState("");
  const [languages, setLanguages] = useState<string[]>([]);
  const [primaryVenue, setPrimaryVenue] = useState<VenueEntry>({ country: "", city: "", mapUrl: "" });
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [providerLogo, setProviderLogo] = useState("");
  const [providerLogoAsset, setProviderLogoAsset] = useState<ImageAsset | null>(null);
  const [providerLogoName, setProviderLogoName] = useState("");
  const [providerType, setProviderType] = useState("");
  const [serviceImages, setServiceImages] = useState<string[]>([]);
  const [serviceImageAssets, setServiceImageAssets] = useState<ImageAsset[]>([]);
  const [serviceImageNames, setServiceImageNames] = useState<string[]>([]);
  const [passportCountries, setPassportCountries] = useState<string[]>([]);
  const [included, setIncluded] = useState("");
  const [notIncluded, setNotIncluded] = useState("");
  const [contactLinks, setContactLinks] = useState<ContactEntry[]>([{ kind: "web", url: "", label: "" }]);
  const [priceEntries, setPriceEntries] = useState<PriceEntry[]>([{ currency: "USD", amount: "" }]);
  const [priceNegotiable, setPriceNegotiable] = useState(false);
  const [pricePeriod, setPricePeriod] = useState("month");
  const [promoCode, setPromoCode] = useState("");

  const [isEmptyProfileName, setIsEmptyProfileName] = useState(false);
  const [isEmptyProposalCategory, setIsEmptyProposalCategory] = useState(false);
  const [isEmptyEmail, setIsEmptyEmail] = useState(false);
  const [isEmptyTerms, setIsEmptyTerms] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const originalPosition = document.body.style.position;
    const originalTop = document.body.style.top;
    const originalWidth = document.body.style.width;
    const scrollY = window.scrollY;
    const isMobile = window.matchMedia("(max-width: 768px)").matches;

    document.body.style.overflow = "hidden";
    if (!isMobile) {
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = "100%";
    }

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.position = originalPosition;
      document.body.style.top = originalTop;
      document.body.style.width = originalWidth;
      if (!isMobile) window.scrollTo(0, scrollY);
    };
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/categories").then((res) => res.json()).catch(() => ({ items: [] })),
      fetch("/api/filters").then((res) => res.json()).catch(() => ({ groups: [] })),
    ])
      .then(([categoryData, filterData]) => {
        setCategories(Array.isArray(categoryData?.items) ? categoryData.items : []);
        setFilterGroups(Array.isArray(filterData?.groups) ? filterData.groups : []);
      })
      .catch(() => {
        setCategories([]);
        setFilterGroups([]);
      });
  }, []);

  const taxonomyFor = (category: Category, byId: Map<string, Category>): string => {
    let current: Category | undefined = category;
    let depth = 0;
    while (current && depth < 10) {
      const own = normalize(current.taxonomyType);
      if (own && !["inherit", "predeterminado", "default"].includes(own)) return own;
      if (!current.parentId) break;
      current = byId.get(current.parentId);
      depth += 1;
    }
    return normalize(category.taxonomyType);
  };

  const byTaxonomy = useCallback((aliases: string[]) => {
    const wanted = aliases.map(normalize);
    const byId = new Map(categories.map((c) => [c.id, c]));
    return categories
      .filter((c) => wanted.includes(taxonomyFor(c, byId)))
      .map((c) => ({ value: c.description, label: c.description }))
      .filter((c) => c.value);
  }, [categories]);

  const categoriaOptions = useMemo(
    () => categories
      .filter((c) => c.isPrimaryCategory === true && c.isPublicVisible !== false)
      .map((c) => ({ value: c.description, label: c.description }))
      .filter((c) => c.value),
    [categories]
  );

  const optionsByTaxonomy = useCallback((taxonomyAliases: string[]) => {
    const fromCategories = byTaxonomy(taxonomyAliases);
    const wanted = taxonomyAliases.map(normalize);
    const fromFilters = filterGroups
      .filter((group) => [group.key, group.label, group.taxonomyType].some((value) => wanted.includes(normalize(String(value ?? "")))))
      .flatMap((group) => group.options ?? [])
      .map((option) => ({ value: String(option.value ?? option.label ?? "").trim(), label: String(option.label ?? option.value ?? "").trim() }))
      .filter((option) => option.value);
    return uniqueOptions([...fromCategories, ...fromFilters]);
  }, [byTaxonomy, filterGroups]);

  const languageOptions = useMemo(() => optionsByTaxonomy(["idioma", "idiomas", "language", "languages"]), [optionsByTaxonomy]);
  const typeOptions = useMemo(() => optionsByTaxonomy(["tipo", "tipos", "type", "types"]), [optionsByTaxonomy]);

  const validateBasic = () => {
    if (emailError.length > 0) {
      toast.error(t("email_valido"));
      return false;
    }
    if (!profileName.trim()) {
      setIsEmptyProfileName(true);
      toast.error("Completá el nombre de tu perfil o marca");
      return false;
    }
    setIsEmptyProfileName(false);

    if (!proposalCategories.length) {
      setIsEmptyProposalCategory(true);
      toast.error(t("elegir_categoria"));
      return false;
    }
    setIsEmptyProposalCategory(false);

    if (!email.trim()) {
      setIsEmptyEmail(true);
      toast.error(t("completa_campo_email"));
      return false;
    }
    setIsEmptyEmail(false);

    if (!isIntermediario && !isOfrezco) {
      toast.error(t("seleccionar_como_actuas"));
      return false;
    }

    if (!acceptedTerms) {
      setIsEmptyTerms(true);
      toast.error("Debés aceptar términos y condiciones");
      return false;
    }
    setIsEmptyTerms(false);
    return true;
  };

  const buildPayload = (publicationPlan: "basic_free" | "featured") => {
    const cleanVenue = {
      country: primaryVenue.country.trim(),
      city: primaryVenue.city.trim(),
      mapUrl: primaryVenue.mapUrl.trim(),
    };
    const venueEntries = cleanVenue.country || cleanVenue.city || cleanVenue.mapUrl ? [cleanVenue] : [];
    const socialLinksDetailed = contactLinks
      .map((entry) => ({
        kind: entry.kind,
        label: entry.label.trim(),
        url: entry.url.trim(),
      }))
      .filter((entry) => entry.url);
    const socialLinks = socialLinksDetailed.map((entry) => entry.url);
    const cleanPrices = priceNegotiable
      ? []
      : priceEntries
          .filter((entry) => entry.currency && entry.amount.trim())
          .filter((entry, index, self) => self.findIndex((item) => item.currency === entry.currency) === index);
    const primaryPrice = cleanPrices[0] ?? { currency: "", amount: "" };
    return {
      taxonomyType: "oferente",
      status: "pendiente",
      publicationPlan,
      name: profileName.trim(),
      phone: "",
      email,
      typeProfile: providerType ? [providerType] : [],
      category: proposalCategories,
      activity: [],
      modality: [],
      languages,
      isOfrezco,
      isIntermediario,
      destinationCountry,
      city: cleanVenue.city,
      destinationMapUrl: cleanVenue.mapUrl,
      headquarterCountry: cleanVenue.country || destinationCountry,
      headquarterCity: cleanVenue.city,
      headquarterMapUrl: cleanVenue.mapUrl,
      venues: venueEntries,
      receivingCountriesMode: passportCountries.length ? "only" : "all",
      receivingCountries: passportCountries,
      contanos: description.slice(0, 500),
      website,
      images: serviceImages,
      imageAssets: serviceImageAssets,
      providerLogo,
      providerLogoAsset,
      included,
      notIncluded,
      socialLinks,
      socialLinksDetailed,
      price: primaryPrice.amount,
      currency: primaryPrice.currency,
      priceByCurrency: cleanPrices,
      priceNegotiable,
      pricePeriod,
      promoCode,
      country: selectedCountry,
      locale,
      acceptedTerms: true,
    };
  };

  const submit = async (publicationPlan: "basic_free" | "featured") => {
    if (!validateBasic()) return;
    setIsLoading(true);
    try {
      const response = await fetch("/api/travel-services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(publicationPlan)),
      });
      if (!response.ok) throw new Error();
      toast.success("Tu publicación está en revisión", { duration: 6000 });
      onClose();
    } catch {
      toast.error(t("error_form"));
    } finally {
      setIsLoading(false);
    }
  };

  const goFeatured = () => {
    if (!validateBasic()) return;
    setStep("featured");
  };

  const handleProviderLogoUpload = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Subí una imagen válida");
      return;
    }
    try {
      const optimized = await fileToCompressedImageAsset(file);
      setProviderLogo(optimized.url);
      setProviderLogoAsset(optimized);
      setProviderLogoName(file.name.replace(/\.[^.]+$/, ".webp"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo comprimir la imagen");
    }
  };

  const handleServiceImagesUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    const remaining = Math.max(0, 5 - serviceImages.length);
    const fileList = Array.from(files);
    if (!remaining || fileList.length > remaining) {
      toast.error(`Podés subir hasta 5 imágenes. Te quedan ${remaining}.`);
      return;
    }
    if (fileList.some((file) => !file.type.startsWith("image/"))) {
      toast.error("Solo se permiten imágenes válidas");
      return;
    }
    try {
      const encoded = await Promise.all(fileList.map(fileToCompressedImageAsset));
      setServiceImages((prev) => [...prev, ...encoded.map((asset) => asset.url)]);
      setServiceImageAssets((prev) => [...prev, ...encoded]);
      setServiceImageNames((prev) => [...prev, ...fileList.map((file) => file.name.replace(/\.[^.]+$/, ".webp"))]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron comprimir las imágenes");
    }
  };

  if (!mounted) return null;

  const basicStep = (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="relative w-full">
          <Tag className="pointer-events-none absolute left-4 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-[#0B8FA3]" />
          <input
            value={profileName}
            onChange={(e) => setProfileName(e.target.value)}
            className="w-full rounded-2xl bg-white p-4 pb-5 pl-12 pt-5 text-black outline-none transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl focus:scale-[1.01]"
            style={{
              boxShadow: isEmptyProfileName
                ? "0 8px 25px -8px rgba(220, 38, 38, 0.4), 0 4px 12px -4px rgba(220, 38, 38, 0.2)"
                : "0 12px 36px -18px rgba(8, 217, 189, 0.55), 0 6px 18px -9px rgba(4, 181, 189, 0.35)",
            }}
            placeholder="* Nombre de tu perfil o marca"
          />
        </div>
        <div style={{ position: "relative", zIndex: 9999998 }}>
          <MultiOptionSelect
            selectedValues={proposalCategories}
            setSelectedValues={setProposalCategories}
            options={categoriaOptions}
            placeholder="¿En qué categoría encaja tu propuesta?"
            icon="tag"
            isEmpty={isEmptyProposalCategory}
          />
        </div>
      </div>

      <div className="rounded-2xl bg-white/60 p-4 shadow-inner">
        <p className="text-black text-md text-center">*{t("como_actuas")}</p>
        <div className="mt-4 flex flex-col items-start justify-start space-y-4 w-full lg:px-4">
          <RoundedCheckbox id="ofrezco" checked={isOfrezco} onChange={(e) => { setIsOfrezco(e.target.checked); setIsIntermediario(false); }} label={t("ofrezco_directamente")} />
          <div className="ml-5 md:-ml-0">
            <RoundedCheckbox id="intermediario" checked={isIntermediario} onChange={(e) => { setIsIntermediario(e.target.checked); setIsOfrezco(false); }} label={t("intermediario")} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div style={{ position: "relative", zIndex: 9999997, isolation: "isolate" }}>
          <DestinationSelect destinationCountry={destinationCountry} setDestinationCountry={setDestinationCountry} label="País destino que aplica tu propuesta" customClass="mb-0" isInModal textBuscarPais={t("buscar_pais")} noHayPaises={t("no_hay_paises")} />
        </div>
        <div style={{ position: "relative", zIndex: 9999996 }}>
          <MultiOptionSelect selectedValues={languages} setSelectedValues={setLanguages} options={languageOptions} placeholder="Idiomas que te comunicas" />
        </div>
      </div>

      <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-3">
        <div style={{ position: "relative", zIndex: 9999995 }}>
          <label className="mb-1 block text-sm font-medium text-slate-700">{locale === "en" ? "Headquarters" : locale === "pt" ? "Sede" : "Sede"}</label>
          <DestinationSelect
            destinationCountry={primaryVenue.country}
            setDestinationCountry={(country) => setPrimaryVenue((prev) => ({ ...prev, country }))}
            label="País de la sede principal"
            customClass="mb-0"
            isInModal
            textBuscarPais={t("buscar_pais")}
            noHayPaises={t("no_hay_paises")}
          />
        </div>
        <div className="rounded-2xl bg-white p-3 shadow-[0_12px_36px_-18px_rgba(8,217,189,0.55),0_6px_18px_-9px_rgba(4,181,189,0.35)]">
          <input value={primaryVenue.city} onChange={(event) => setPrimaryVenue((prev) => ({ ...prev, city: event.target.value }))} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#00A9C6]/30" placeholder={locale === "en" ? "Headquarter city" : locale === "pt" ? "Cidade da sede principal" : "Ciudad de la sede principal"} />
        </div>
        <div className="rounded-2xl bg-white p-3 shadow-[0_12px_36px_-18px_rgba(8,217,189,0.55),0_6px_18px_-9px_rgba(4,181,189,0.35)]">
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-4 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-[#0B8FA3]" />
            <input value={primaryVenue.mapUrl} onChange={(event) => setPrimaryVenue((prev) => ({ ...prev, mapUrl: event.target.value }))} className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#00A9C6]/30" placeholder={locale === "en" ? "Google Maps URL" : locale === "pt" ? "URL do Google Maps" : "URL de Google Maps"} />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <MaterialTextarea value={description} setValue={setDescription} isContanos placeholder={t("contanos")} textCharsRestantes={t("caracteres_restantes")} textPerfecto={t("perfecto")} />
        <MaterialTextarea value={website} setValue={setWebsite} placeholder={t("web")} isWeb textCharsRestantes={t("caracteres_restantes")} textPerfecto={t("perfecto")} />
      </div>

      <div>
        <MaterialInputs required label="Tu email de contacto con Travelgrin" value={email} setValue={setEmail} isEmpty={isEmptyEmail} setEmailError={setEmailError} emailError={emailError} textPorfavor={t("por_favor")} textCampoRequerido={t("campo_requerido")} />
      </div>

      <label className={`flex items-center gap-3 rounded-xl bg-white/80 p-3 text-sm shadow-sm ${isEmptyTerms ? "text-red-600 ring-1 ring-red-300" : "text-[#273166]"}`}>
        <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} className="h-4 w-4 rounded border-gray-300 accent-[#00A9C6]" />
        <span>* Aceptar términos y condiciones</span>
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <PlanCard
          title="Publicación Básica (gratis)"
          tone="free"
          price="$ 0"
          items={["Visible en el listado general", "Duración 60 días", "Descripción breve", "1 link contacto"]}
          buttonLabel={isLoading ? t("guardando") : "Publicar Gratis"}
          onClick={() => submit("basic_free")}
          disabled={isLoading}
        />
        <PlanCard
          title="Publicación Destacada"
          tone="featured"
          price="$ XX"
          items={FEATURED_ITEMS}
          buttonLabel="Continuar con destacado"
          onClick={goFeatured}
          showPromo
          promoCode={promoCode}
          onPromoCodeChange={setPromoCode}
        />
      </div>
    </>
  );

  const featuredStep = (
    <>
      <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900">
        Completá más información para destacarte y aumentar tus consultas. No se borra nada de lo que ya cargaste.
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-white p-4 shadow-[0_12px_36px_rgba(8,217,189,0.12)]">
          <label className="text-sm font-semibold text-[#273166]">Foto o logo del perfil</label>
          <div className="mt-3 flex items-center gap-3">
            <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl border border-[#BFEAF3] bg-[#F4FCFD]">
              {providerLogo ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={providerLogo} alt="Logo del perfil" className="h-full w-full object-cover" />
                </>
              ) : <Upload className="h-7 w-7 text-[#0B8FA3]" />}
            </div>
            <div className="min-w-0 flex-1">
              <input id="provider-logo-upload" type="file" accept="image/*" onChange={(event) => handleProviderLogoUpload(event.target.files?.[0] ?? null)} className="sr-only" />
              <label htmlFor="provider-logo-upload" className="inline-flex cursor-pointer items-center rounded-xl bg-[#EAF9FB] px-4 py-2 text-sm font-bold text-[#007D92] transition hover:bg-[#D8F3F0]">
                Seleccionar imagen
              </label>
              <p className="mt-2 truncate text-xs text-slate-500">{providerLogoName || "Ninguna imagen seleccionada"}</p>
            </div>
          </div>
        </div>
        <div style={{ position: "relative", zIndex: 9999995 }}>
          <SingleOptionSelect selectedValue={providerType} setSelectedValue={setProviderType} options={typeOptions} placeholder="Tipo" />
        </div>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-[0_12px_36px_rgba(8,217,189,0.12)]">
        <div className="flex items-center justify-between gap-3">
          <label className="text-sm font-semibold text-[#273166]">Imágenes del servicio (hasta 5)</label>
          <span className="text-xs text-slate-500">{serviceImages.length}/5</span>
        </div>
        <input id="service-images-upload" type="file" accept="image/*" multiple onChange={(event) => { handleServiceImagesUpload(event.target.files); event.currentTarget.value = ""; }} className="sr-only" />
        <label htmlFor="service-images-upload" className="mt-3 inline-flex cursor-pointer items-center rounded-xl bg-[#EAF9FB] px-4 py-2 text-sm font-bold text-[#007D92] transition hover:bg-[#D8F3F0]">
          Elegir imágenes
        </label>
        <p className="mt-2 text-xs text-slate-500">Seleccioná únicamente la cantidad restante; el límite es estricto de 5 imágenes.</p>
        {serviceImages.length ? (
          <div className="mt-3 grid grid-cols-3 gap-2 md:grid-cols-5">
            {serviceImages.map((image, index) => (
              <button key={`${index}-${image.slice(0, 20)}`} type="button" onClick={() => { setServiceImages((prev) => prev.filter((_, idx) => idx !== index)); setServiceImageAssets((prev) => prev.filter((_, idx) => idx !== index)); setServiceImageNames((prev) => prev.filter((_, idx) => idx !== index)); }} className="group relative h-20 overflow-hidden rounded-xl border border-slate-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt={`Servicio ${index + 1}`} className="h-full w-full object-cover" />
                <span className="absolute inset-0 hidden place-items-center bg-black/50 text-xs font-semibold text-white group-hover:grid">Quitar</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-2 text-sm text-slate-500"><ImagePlus className="h-4 w-4" /> Todavía no cargaste imágenes.</div>
        )}
        {serviceImageNames.length ? <p className="mt-2 text-xs text-slate-500">{serviceImageNames.join(", ")}</p> : null}
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-[0_12px_36px_rgba(8,217,189,0.12)]">
        <CountryMultiSelect
          label="¿Para viajeros de qué países querés aparecer?"
          selected={passportCountries}
          onChange={setPassportCountries}
          placeholder="Si no elegís ninguno, aparece para todos"
        />
        <p className="mt-2 text-xs text-slate-500">Si no elegís países, tu publicación aparece para todos. Si elegís uno o más, solo aparece para esos pasaportes.</p>
      </div>

      <div className="space-y-4">
        <MaterialTextarea value={included} setValue={setIncluded} placeholder="* ¿Qué incluye tu servicio o qué te diferencia?" textCharsRestantes={t("caracteres_restantes")} textPerfecto={t("perfecto")} />
        <MaterialTextarea value={notIncluded} setValue={setNotIncluded} placeholder="¿Qué no incluye o qué debe tener en cuenta el viajero?" textCharsRestantes={t("caracteres_restantes")} textPerfecto={t("perfecto")} />
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-[0_12px_36px_rgba(8,217,189,0.12)]">
        <div className="mb-3 flex items-center justify-between">
          <label className="text-sm font-semibold text-[#273166]">Links de contacto</label>
          <button type="button" onClick={() => setContactLinks((prev) => [...prev, { kind: "web", url: "", label: "" }])} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">+ Añadir link</button>
        </div>
        <div className="space-y-2">
          {contactLinks.map((entry, index) => (
            <div key={`contact-${index}`} className="grid grid-cols-1 gap-2 md:grid-cols-[140px_1fr_auto]">
              <select value={entry.kind} onChange={(event) => setContactLinks((prev) => prev.map((item, idx) => idx === index ? { ...item, kind: event.target.value as ContactKind } : item))} className="h-11 rounded-xl border border-slate-200 bg-white px-2 text-sm outline-none focus:ring-2 focus:ring-[#00A9C6]/30">
                <option value="web">Web</option><option value="email">Email</option><option value="youtube">YouTube</option><option value="instagram">Instagram</option><option value="facebook">Facebook</option><option value="whatsapp">WhatsApp</option><option value="cellphone">Celular</option><option value="linkedin">LinkedIn</option><option value="other">Otro</option>
              </select>
              <div className="relative">
                <LinkIcon className="pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[#0B8FA3]" />
                <input value={entry.url} onChange={(event) => setContactLinks((prev) => prev.map((item, idx) => idx === index ? { ...item, url: event.target.value } : item))} className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#00A9C6]/30" placeholder="Link o email" />
              </div>
              <button type="button" onClick={() => setContactLinks((prev) => prev.length > 1 ? prev.filter((_, idx) => idx !== index) : prev)} disabled={contactLinks.length <= 1} className="rounded-xl border border-slate-200 px-3 text-xs text-slate-600 disabled:opacity-40">Quitar</button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-[0_12px_36px_rgba(8,217,189,0.12)]">
        <div className="mb-3 flex items-center justify-between gap-3">
          <label className="text-sm font-semibold text-[#273166]">Precio de tu propuesta por moneda</label>
          <button type="button" onClick={() => setPriceEntries((prev) => [...prev, { currency: "", amount: "" }])} disabled={priceNegotiable} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">+ Agregar moneda</button>
        </div>
        <div className="space-y-2">
          {priceEntries.map((entry, index) => (
            <div key={`price-entry-${index}`} className="grid grid-cols-[110px_1fr_auto] gap-2">
              <select value={entry.currency} onChange={(event) => setPriceEntries((prev) => prev.map((item, idx) => idx === index ? { ...item, currency: event.target.value } : item))} disabled={priceNegotiable} className="h-11 rounded-xl border border-slate-200 bg-white px-2 text-sm outline-none focus:ring-2 focus:ring-[#00A9C6]/30 disabled:bg-slate-100">
                <option value="">Moneda</option>
                {CURRENCY_OPTIONS.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
              </select>
              <input value={entry.amount} onChange={(event) => setPriceEntries((prev) => prev.map((item, idx) => idx === index ? { ...item, amount: event.target.value } : item))} disabled={priceNegotiable} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#00A9C6]/30 disabled:bg-slate-100" placeholder="Monto" />
              <button type="button" onClick={() => setPriceEntries((prev) => prev.length > 1 ? prev.filter((_, idx) => idx !== index) : prev)} disabled={priceNegotiable || priceEntries.length <= 1} className="rounded-xl border border-slate-200 px-3 text-xs text-slate-600 disabled:opacity-40">Quitar</button>
            </div>
          ))}
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={priceNegotiable} onChange={(event) => setPriceNegotiable(event.target.checked)} className="h-4 w-4 accent-[#00A9C6]" /> *A convenir</label>
        <div className="mt-3">
          <label className="mb-1 block text-sm font-medium text-slate-700">Periodo del precio</label>
          <select value={pricePeriod} onChange={(event) => setPricePeriod(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#00A9C6]/30">
            <option value="month">Por mes</option><option value="week">Por semana</option><option value="day">Por día</option><option value="year">Por año</option><option value="once">Único</option>
          </select>
        </div>
      </div>

      <div className="mx-auto w-full max-w-sm">
        <PlanCard
          title="Publicación Destacada"
          tone="featured"
          price="$ XX"
          items={FEATURED_ITEMS}
          buttonLabel={isLoading ? t("guardando") : "Publicar Destacado"}
          onClick={() => submit("featured")}
          disabled={isLoading}
          showPromo
          promoCode={promoCode}
          onPromoCodeChange={setPromoCode}
        />
      </div>
      <div className="flex justify-center">
        <button type="button" onClick={() => setStep("basic")} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Volver atrás</button>
      </div>
    </>
  );

  const modalContent = (
    <>
      <div className="fixed inset-0 bg-black/60" style={{ zIndex: 400 }} onClick={onClose} />
      <div className="fixed inset-0 flex items-start justify-center p-3 pt-2 sm:p-4 sm:pt-6" style={{ zIndex: 410, pointerEvents: "none" }}>
        <div
          className="relative bg-white rounded-[1.7rem] shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden"
          style={{ pointerEvents: "auto", zIndex: 1000000, isolation: "isolate" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex-shrink-0 p-6 pb-4 border-b border-gray-100 bg-white">
            <div className="flex flex-row items-start justify-between">
              <Image src="/logo-degrade.png" width={200} height={200} className="object-cover w-[10rem] h-[5rem] mb-4" alt="logo degrade" />
              <button onClick={onClose} className="ml-4 p-2 hover:bg-gray-100 rounded-full transition-colors duration-200 flex-shrink-0">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-gradient-to-b from-[#F5FBFB] via-[#EEEEEE] to-[#F8FAFC] p-6 space-y-6">
            <div className="flex items-center justify-center flex-col text-center">
              <h1 style={{ color: "#273166" }} className="text-xl font-semibold text-gray-800 leading-tight">{t("conecta_con_viajeros")}</h1>
              <h2 className="mt-2" style={{ color: "#323232" }}>{step === "featured" ? "Completá más información para destacar y aumentar tus consultas" : t("cambiamos_la_manera")}</h2>
            </div>
            {step === "basic" ? basicStep : featuredStep}
            <div className="flex items-center justify-center gap-2 text-xs text-slate-600">
              <Globe2 className="h-4 w-4" />
              Tus datos están seguros.
            </div>
          </div>

          <div className="pointer-events-none absolute bottom-4 right-4 z-[2147483000] h-16 w-16 md:h-14 md:w-14">
            <div className="pointer-events-auto relative h-full w-full">
              <FloatingAIButton is425w={false} onClick={() => setIsOpenModalAI(true)} isInFooter />
            </div>
          </div>
        </div>
      </div>

      {isOpenModalAI ? (
        <ModalAI
          onClose={() => setIsOpenModalAI(false)}
          description={description}
          setDescription={setDescription}
          typeProfile={providerType}
          selectedCategory={proposalCategories[0] ?? ""}
          isOfrezco={isOfrezco}
          isIntermediario={isIntermediario}
          destinationCountry={destinationCountry}
          contanos={description}
          website={website}
          country={selectedCountry}
        />
      ) : null}
    </>
  );

  return createPortal(modalContent, document.body);
}
