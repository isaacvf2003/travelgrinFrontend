"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import toast from "react-hot-toast";
import { Check, CheckCircle2, ChevronDown, Globe2, ImagePlus, Languages, Link as LinkIcon, Loader2, MapPin, Tag, Upload, UserRound, XCircle } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCountry } from "@/app/context/CountryProvider";
import { RoundedCheckbox } from "../MaterialCheckbox";
import DestinationSelect from "../DestinationSelect";
import MaterialTextarea from "../MaterialTextarea";
import MaterialInputs from "../MaterialInput";
import FloatingAIButton from "../FloatingAIButton";
import ModalAI from "../ModalAI";
import CountryMultiSelect from "../CountryMultiSelect";
import TurnstileWidget from "@/components/TurnstileWidget";
import { uploadImageAsset, type ImageAsset } from "@/app/lib/cloudinaryUpload";

type Props = {
  onClose: () => void;
  initialEmail?: string;
  lockEmail?: boolean;
  showMonthlyPlanOption?: boolean;
  visiblePlans?: Array<"basic_free" | "featured" | "monthly">;
  fixedCountry?: string;
  initialPlan?: "basic_free" | "featured" | "monthly";
  preferredPaidPlanType?: "featured_120d" | "featured_monthly";
  requestKind?: "new_publication" | "renew_free" | "renew_featured_120d" | "renew_featured_monthly" | "upgrade_featured_120d" | "upgrade_featured_monthly" | "downgrade_free" | "edit_publication";
  previousPlan?: "basic_free" | "featured" | "monthly";
  sourceServiceId?: string;
  sourcePublicationId?: string;
  publicationChangeMode?: boolean;
  initialData?: Record<string, any> | null;
  resumeMode?: boolean;
  resumeSubmissionId?: string;
  resumePaymentState?: string;
  resumeStatusReason?: string;
  compactPlanCards?: boolean;
  onSubmitted?: (info: { serviceId: string; plan: "basic_free" | "featured" | "monthly" }) => void;
  onPaymentResolved?: (info: { serviceId: string; plan: "featured" | "monthly"; status: "success" | "cancel" | "pending" }) => void;
};
type Category = { id: string; description: string; taxonomyType: string; isPrimaryCategory?: boolean; visibleInCard?: boolean; isPublicVisible?: boolean; parentId?: string | null };
type FilterOptionLite = { value?: string; label?: string; labelI18n?: Record<string, string> | null };
type FilterGroupLite = { key?: string; label?: string; taxonomyType?: string | null; options?: FilterOptionLite[] };
type SelectOption = { value: string; label: string };
type SelectOptionGroup = { value: string; label: string; children: SelectOption[] };
type Step = "basic" | "featured";
type PromoValidationState = {
  applied: boolean;
  code: string;
  discountPercent: number;
  originalAmount: number | null;
  discountedAmount: number | null;
  message: string;
  error: boolean;
};
type PriceBreakdown = {
  baseLabel: string;
  finalLabel: string;
  showStrikethrough: boolean;
};
type FeaturedPlanPricing = {
  country: string | null;
  planType?: "featured_120d" | "featured_monthly";
  currency: "ARS" | "USD";
  amount: number;
};

const FEATURED_PLAN_AMOUNT = Number(process.env.NEXT_PUBLIC_FEATURED_MONTHLY_PRICE ?? 0);

function formatMoneyLabel(amount: number | null, currency: "ARS" | "USD" = "USD") {
  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) return "$ XX";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(amount));
}

const OFERENTE_MODAL_TEXT = {
  es: {
    oferente_nombre_perfil: "* Nombre de tu perfil o marca",
    oferente_categoria_placeholder: "¿En qué categoría encaja tu propuesta?",
    oferente_destino_label: "País destino que aplica tu propuesta",
    oferente_idiomas_placeholder: "Idiomas que te comunicas",
    oferente_email_label: "Tu email de contacto con Travelgrin",
    oferente_aceptar_terminos: "* Aceptar términos y condiciones",
    oferente_publicacion_basica: "Publicación Básica (gratis)",
    oferente_publicacion_destacada: "Publicación Destacada",
    oferente_plan_visible_listado: "Visible en el listado general",
    oferente_plan_duracion_60: "Duración 60 días",
    oferente_plan_descripcion_breve: "Descripción breve",
    oferente_plan_link_contacto: "1 link contacto",
    oferente_featured_item_results: "Aparece primero en resultados",
    oferente_featured_item_duration: "Duración 120 días",
    oferente_featured_item_badge: "Sello destacado",
    oferente_featured_item_description: "Descripción ampliada",
    oferente_featured_item_links: "Varios link de contacto",
    oferente_featured_item_languages: "Disponible en 4 idiomas",
    oferente_featured_item_gallery: "Galería hasta 5 imágenes",
    oferente_publicar_gratis: "Publicar Gratis",
    oferente_continuar_destacado: "Continuar con destacado",
    oferente_codigo_promocional: "Código promocional",
    oferente_destacado_intro: "Completá más información para destacarte y aumentar tus consultas. No se borra nada de lo que ya cargaste.",
    oferente_destacado_heading: "Completá más información para destacar y aumentar tus consultas",
    oferente_logo_label: "Foto o logo del perfil",
    oferente_tipo_perfil: "Tipo de perfil",
    oferente_seleccionar_imagen: "Seleccionar imagen",
    oferente_ninguna_imagen: "Ninguna imagen seleccionada",
    oferente_sede: "Ubicación donde se cumple tu propuesta",
    oferente_pais_sede: "País de la sede principal",
    oferente_ciudad_sede: "Ciudad de la sede principal",
    oferente_url_maps: "URL de Google Maps",
    oferente_imagenes_servicio: "Imágenes del servicio (hasta 5)",
    oferente_elegir_imagenes: "Elegir imágenes",
    oferente_limite_imagenes: "Seleccioná únicamente la cantidad restante; el límite es estricto de 5 imágenes.",
    oferente_sin_imagenes: "Todavía no cargaste imágenes.",
    oferente_pasaportes_label: "¿Para viajeros de qué países querés aparecer?",
    oferente_pasaportes_placeholder: "Si no elegís ninguno, aparece para todos",
    oferente_pasaportes_helper: "Si no elegís países, tu publicación aparece para todos. Si elegís uno o más, solo aparece para esos pasaportes.",
    oferente_incluye_placeholder: "* ¿Qué incluye tu servicio o qué te diferencia?",
    oferente_no_incluye_placeholder: "¿Qué no incluye o qué debe tener en cuenta el viajero?",
    oferente_links_contacto: "Links para que el viajero se contacte con usted",
    oferente_anadir_link: "+ Añadir link",
    oferente_link_email_placeholder: "Link o email",
    oferente_precio_moneda: "Precio de tu propuesta por moneda",
    oferente_agregar_moneda: "+ Agregar moneda",
    oferente_moneda: "Moneda",
    oferente_monto: "Monto",
    oferente_quitar: "Quitar",
    oferente_a_convenir: "*A convenir",
    oferente_periodo_precio: "Periodo del precio",
    oferente_periodo_mes: "Por mes",
    oferente_periodo_semana: "Por semana",
    oferente_periodo_dia: "Por día",
    oferente_periodo_anio: "Por año",
    oferente_periodo_unico: "Único",
    oferente_publicar_destacado: "Publicar Destacado",
    oferente_volver_atras: "Volver atrás",
    oferente_datos_seguros: "Tus datos están seguros.",
    oferente_sin_opciones: "No hay opciones disponibles",
    oferente_servicio_alt: "Servicio",
    oferente_contact_cellphone: "Celular",
    oferente_contact_other: "Otro",
    oferente_toast_nombre: "Completá el nombre de tu perfil o marca",
    oferente_toast_destino: "Elegí un país destino",
    oferente_toast_idioma: "Elegí al menos un idioma",
    oferente_toast_descripcion: "Completá la descripción",
    oferente_toast_web: "Completá el sitio web",
    oferente_toast_terminos: "Debés aceptar términos y condiciones",
    oferente_turnstile_required: "Completa la verificacion.",
    oferente_toast_sede: "Completá el país donde se cumple tu propuesta",
    oferente_toast_categoria_limite: "Podés elegir hasta 3 categorías o subcategorías.",
    oferente_toast_revision: "Tu publicación está en revisión",
    oferente_toast_pago_pestana: "Te abrimos una nueva pestaña para completar el pago.",
    oferente_toast_pago_exitoso: "Pago exitoso. Pronto verás la publicación en la web.",
    oferente_toast_pago_cancelado: "Pago no completado o cancelado. Podés intentarlo nuevamente.",
    oferente_toast_nueva_publicacion: "Nueva publicacion enviada. En breve nos pondremos en contacto con usted.",
    oferente_toast_cambios_enviados: "Solicitud de cambios enviada. El admin la revisara antes de actualizar la publicacion.",
    oferente_toast_cambios_error: "No se pudo enviar la solicitud de cambios. Intenta nuevamente.",
    oferente_solicitar_cambios: "Solicitar cambios",
    oferente_toast_imagen_valida: "Subí una imagen válida",
    oferente_toast_imagen_limite: "Podés subir hasta 5 imágenes. Te quedan {remaining}.",
    oferente_toast_imagen_tipo: "Solo se permiten imágenes válidas",
    oferente_toast_comprimir_imagenes: "No se pudieron comprimir las imágenes",
    oferente_promo_aplicar: "Aplicar",
    oferente_promo_empty_code: "Ingresá un código promocional.",
    oferente_promo_invalid: "Código promocional inválido.",
    oferente_promo_partner_only: "Este código promocional aplica solo a partners/intermediarios.",
    oferente_promo_expired: "El código promocional ya venció.",
    oferente_promo_max_uses_reached: "El código promocional ya alcanzó su límite de uso.",
    oferente_promo_inactive: "El código promocional no está activo.",
    oferente_promo_validate_error: "No se pudo validar el código.",
    oferente_promo_applied: "Código aplicado. Descuento: {discount}%.",
    oferente_pago_preparando: "Preparando tu pago...",
    oferente_pago_redirigiendo: "Te estamos llevando al checkout seguro.",
    oferente_pago_completado: "Pago completado correctamente.",
    oferente_pago_no_completado: "El pago no fue completado.",
    oferente_pago_error: "No se pudo iniciar el pago. Intentá nuevamente.",
    oferente_pago_popup_error: "No se pudo abrir el checkout. Habilitá ventanas emergentes e intentá nuevamente.",
    oferente_pago_verificando: "Verificando el estado del pago...",
    oferente_opcional: "opcional",
    oferente_sede_helper: "La ciudad y el link de Google Maps son opcionales. Podés completarlos si querés sumar más contexto.",
  },
  en: {
    oferente_nombre_perfil: "* Profile or brand name",
    oferente_categoria_placeholder: "Which category fits your proposal?",
    oferente_destino_label: "Destination country for your proposal",
    oferente_idiomas_placeholder: "Languages you communicate in",
    oferente_email_label: "Your contact email with Travelgrin",
    oferente_aceptar_terminos: "* Accept terms and conditions",
    oferente_publicacion_basica: "Basic Publication (free)",
    oferente_publicacion_destacada: "Featured Publication",
    oferente_plan_visible_listado: "Visible in the general listing",
    oferente_plan_duracion_60: "60-day duration",
    oferente_plan_descripcion_breve: "Brief description",
    oferente_plan_link_contacto: "1 contact link",
    oferente_featured_item_results: "Appears first in results",
    oferente_featured_item_duration: "120-day duration",
    oferente_featured_item_badge: "Featured badge",
    oferente_featured_item_description: "Expanded description",
    oferente_featured_item_links: "Several contact links",
    oferente_featured_item_languages: "Available in 4 languages",
    oferente_featured_item_gallery: "Gallery up to 5 images",
    oferente_publicar_gratis: "Post for Free",
    oferente_continuar_destacado: "Continue with featured",
    oferente_codigo_promocional: "Promo code",
    oferente_destacado_intro: "Complete more information to stand out and increase your inquiries. Nothing you already entered will be deleted.",
    oferente_destacado_heading: "Complete more information to stand out and increase your inquiries",
    oferente_logo_label: "Profile photo or logo",
    oferente_tipo_perfil: "Profile type",
    oferente_seleccionar_imagen: "Select image",
    oferente_ninguna_imagen: "No image selected",
    oferente_sede: "Location where your proposal takes place",
    oferente_pais_sede: "Main headquarters country",
    oferente_ciudad_sede: "Headquarter city",
    oferente_url_maps: "Google Maps URL",
    oferente_imagenes_servicio: "Service images (up to 5)",
    oferente_elegir_imagenes: "Choose images",
    oferente_limite_imagenes: "Select only the remaining amount; the limit is exactly 5 images.",
    oferente_sin_imagenes: "You have not uploaded images yet.",
    oferente_pasaportes_label: "Which travelers' countries do you want to appear for?",
    oferente_pasaportes_placeholder: "If you do not choose any, it appears for everyone",
    oferente_pasaportes_helper: "If you do not choose countries, your publication appears for everyone. If you choose one or more, it only appears for those passports.",
    oferente_incluye_placeholder: "* What does your service include or what makes it different?",
    oferente_no_incluye_placeholder: "What is not included or what should the traveler keep in mind?",
    oferente_links_contacto: "Links so travelers can contact you",
    oferente_anadir_link: "+ Add link",
    oferente_link_email_placeholder: "Link or email",
    oferente_precio_moneda: "Price of your proposal by currency",
    oferente_agregar_moneda: "+ Add currency",
    oferente_moneda: "Currency",
    oferente_monto: "Amount",
    oferente_quitar: "Remove",
    oferente_a_convenir: "*To be agreed",
    oferente_periodo_precio: "Price period",
    oferente_periodo_mes: "Per month",
    oferente_periodo_semana: "Per week",
    oferente_periodo_dia: "Per day",
    oferente_periodo_anio: "Per year",
    oferente_periodo_unico: "One time",
    oferente_publicar_destacado: "Post Featured",
    oferente_volver_atras: "Go back",
    oferente_datos_seguros: "Your data is safe.",
    oferente_sin_opciones: "No options available",
    oferente_servicio_alt: "Service",
    oferente_contact_cellphone: "Mobile phone",
    oferente_contact_other: "Other",
    oferente_toast_nombre: "Complete your profile or brand name",
    oferente_toast_destino: "Choose a destination country",
    oferente_toast_idioma: "Choose at least one language",
    oferente_toast_descripcion: "Complete the description",
    oferente_toast_web: "Complete the website",
    oferente_toast_terminos: "You must accept terms and conditions",
    oferente_turnstile_required: "Please complete the verification.",
    oferente_toast_sede: "Complete the country where your proposal takes place",
    oferente_toast_categoria_limite: "You can choose up to 3 categories or subcategories.",
    oferente_toast_revision: "Your publication is under review",
    oferente_toast_pago_pestana: "We opened a new tab for you to complete the payment.",
    oferente_toast_pago_exitoso: "Payment successful. You will soon see the publication on the website.",
    oferente_toast_pago_cancelado: "Payment not completed or cancelled. You can try again.",
    oferente_toast_nueva_publicacion: "New publication sent. We will contact you shortly.",
    oferente_toast_cambios_enviados: "Change request sent. The admin will review it before updating the publication.",
    oferente_toast_cambios_error: "The change request could not be sent. Please try again.",
    oferente_solicitar_cambios: "Request changes",
    oferente_toast_imagen_valida: "Upload a valid image",
    oferente_toast_imagen_limite: "You can upload up to 5 images. You have {remaining} left.",
    oferente_toast_imagen_tipo: "Only valid images are allowed",
    oferente_toast_comprimir_imagenes: "The images could not be compressed",
    oferente_promo_aplicar: "Apply",
    oferente_promo_empty_code: "Enter a promo code.",
    oferente_promo_invalid: "Invalid promo code.",
    oferente_promo_partner_only: "This promo code applies only to partners/intermediaries.",
    oferente_promo_expired: "This promo code has expired.",
    oferente_promo_max_uses_reached: "This promo code has reached its usage limit.",
    oferente_promo_inactive: "This promo code is not active.",
    oferente_promo_validate_error: "The promo code could not be validated.",
    oferente_promo_applied: "Code applied. Discount: {discount}%.",
    oferente_pago_preparando: "Preparing your payment...",
    oferente_pago_redirigiendo: "Taking you to the secure checkout.",
    oferente_pago_completado: "Payment completed successfully.",
    oferente_pago_no_completado: "The payment was not completed.",
    oferente_pago_error: "The payment could not be started. Please try again.",
    oferente_pago_popup_error: "The checkout could not be opened. Enable pop-ups and try again.",
    oferente_pago_verificando: "Checking payment status...",
    oferente_opcional: "optional",
    oferente_sede_helper: "The city and Google Maps link are optional. You can add them if you want to provide more context.",
  },
  pt: {
    oferente_nombre_perfil: "* Nome do seu perfil ou marca",
    oferente_categoria_placeholder: "Em qual categoria sua proposta se encaixa?",
    oferente_destino_label: "País de destino da sua proposta",
    oferente_idiomas_placeholder: "Idiomas em que você se comunica",
    oferente_email_label: "Seu email de contato com a Travelgrin",
    oferente_aceptar_terminos: "* Aceitar termos e condições",
    oferente_publicacion_basica: "Publicação Básica (grátis)",
    oferente_publicacion_destacada: "Publicação em Destaque",
    oferente_plan_visible_listado: "Visível na listagem geral",
    oferente_plan_duracion_60: "Duração de 60 dias",
    oferente_plan_descripcion_breve: "Descrição breve",
    oferente_plan_link_contacto: "1 link de contato",
    oferente_featured_item_results: "Aparece primeiro nos resultados",
    oferente_featured_item_duration: "Duração de 120 dias",
    oferente_featured_item_badge: "Selo de destaque",
    oferente_featured_item_description: "Descrição ampliada",
    oferente_featured_item_links: "Vários links de contato",
    oferente_featured_item_languages: "Disponível em 4 idiomas",
    oferente_featured_item_gallery: "Galeria de até 5 imagens",
    oferente_publicar_gratis: "Publicar Grátis",
    oferente_continuar_destacado: "Continuar com destaque",
    oferente_codigo_promocional: "Código promocional",
    oferente_destacado_intro: "Complete mais informações para se destacar e aumentar suas consultas. Nada do que você já preencheu será apagado.",
    oferente_destacado_heading: "Complete mais informações para se destacar e aumentar suas consultas",
    oferente_logo_label: "Foto ou logo do perfil",
    oferente_tipo_perfil: "Tipo de perfil",
    oferente_seleccionar_imagen: "Selecionar imagem",
    oferente_ninguna_imagen: "Nenhuma imagem selecionada",
    oferente_sede: "Local onde sua proposta acontece",
    oferente_pais_sede: "País da sede principal",
    oferente_ciudad_sede: "Cidade da sede principal",
    oferente_url_maps: "URL do Google Maps",
    oferente_imagenes_servicio: "Imagens do serviço (até 5)",
    oferente_elegir_imagenes: "Escolher imagens",
    oferente_limite_imagenes: "Selecione apenas a quantidade restante; o limite é exatamente 5 imagens.",
    oferente_sin_imagenes: "Você ainda não carregou imagens.",
    oferente_pasaportes_label: "Para viajantes de quais países você quer aparecer?",
    oferente_pasaportes_placeholder: "Se não escolher nenhum, aparece para todos",
    oferente_pasaportes_helper: "Se não escolher países, sua publicação aparece para todos. Se escolher um ou mais, aparece apenas para esses passaportes.",
    oferente_incluye_placeholder: "* O que seu serviço inclui ou o que o diferencia?",
    oferente_no_incluye_placeholder: "O que não inclui ou o que o viajante deve considerar?",
    oferente_links_contacto: "Links para que o viajante entre em contato com você",
    oferente_anadir_link: "+ Adicionar link",
    oferente_link_email_placeholder: "Link ou email",
    oferente_precio_moneda: "Preço da sua proposta por moeda",
    oferente_agregar_moneda: "+ Adicionar moeda",
    oferente_moneda: "Moeda",
    oferente_monto: "Valor",
    oferente_quitar: "Remover",
    oferente_a_convenir: "*A combinar",
    oferente_periodo_precio: "Período do preço",
    oferente_periodo_mes: "Por mês",
    oferente_periodo_semana: "Por semana",
    oferente_periodo_dia: "Por dia",
    oferente_periodo_anio: "Por ano",
    oferente_periodo_unico: "Único",
    oferente_publicar_destacado: "Publicar em Destaque",
    oferente_volver_atras: "Voltar",
    oferente_datos_seguros: "Seus dados estão seguros.",
    oferente_sin_opciones: "Não há opções disponíveis",
    oferente_servicio_alt: "Serviço",
    oferente_contact_cellphone: "Celular",
    oferente_contact_other: "Outro",
    oferente_toast_nombre: "Complete o nome do seu perfil ou marca",
    oferente_toast_destino: "Escolha um país de destino",
    oferente_toast_idioma: "Escolha pelo menos um idioma",
    oferente_toast_descripcion: "Complete a descrição",
    oferente_toast_web: "Complete o site",
    oferente_toast_terminos: "Você deve aceitar os termos e condições",
    oferente_turnstile_required: "Complete a verificacao.",
    oferente_toast_sede: "Preencha o país onde sua proposta acontece",
    oferente_toast_categoria_limite: "Você pode escolher até 3 categorias ou subcategorias.",
    oferente_toast_revision: "Sua publicação está em revisão",
    oferente_toast_pago_pestana: "Abrimos uma nova aba para você concluir o pagamento.",
    oferente_toast_pago_exitoso: "Pagamento realizado com sucesso. Em breve você verá a publicação no site.",
    oferente_toast_pago_cancelado: "Pagamento não concluído ou cancelado. Você pode tentar novamente.",
    oferente_toast_nueva_publicacion: "Nova publicacao enviada. Entraremos em contato em breve.",
    oferente_toast_cambios_enviados: "Solicitacao de alteracoes enviada. O admin vai revisar antes de atualizar a publicacao.",
    oferente_toast_cambios_error: "Nao foi possivel enviar a solicitacao de alteracoes. Tente novamente.",
    oferente_solicitar_cambios: "Solicitar alteracoes",
    oferente_toast_imagen_valida: "Carregue uma imagem válida",
    oferente_toast_imagen_limite: "Você pode carregar até 5 imagens. Restam {remaining}.",
    oferente_toast_imagen_tipo: "Somente imagens válidas são permitidas",
    oferente_toast_comprimir_imagenes: "Não foi possível comprimir as imagens",
    oferente_promo_aplicar: "Aplicar",
    oferente_promo_empty_code: "Insira um código promocional.",
    oferente_promo_invalid: "Código promocional inválido.",
    oferente_promo_partner_only: "Este código promocional se aplica apenas a partners/intermediários.",
    oferente_promo_expired: "Este código promocional expirou.",
    oferente_promo_max_uses_reached: "Este código promocional atingiu seu limite de uso.",
    oferente_promo_inactive: "Este código promocional não está ativo.",
    oferente_promo_validate_error: "Não foi possível validar o código.",
    oferente_promo_applied: "Código aplicado. Desconto: {discount}%.",
    oferente_pago_preparando: "Preparando seu pagamento...",
    oferente_pago_redirigiendo: "Levando você ao checkout seguro.",
    oferente_pago_completado: "Pagamento concluído corretamente.",
    oferente_pago_no_completado: "O pagamento não foi concluído.",
    oferente_pago_error: "Não foi possível iniciar o pagamento. Tente novamente.",
    oferente_pago_popup_error: "Não foi possível abrir o checkout. Ative pop-ups e tente novamente.",
    oferente_pago_verificando: "Verificando o estado do pagamento...",
    oferente_opcional: "opcional",
    oferente_sede_helper: "A cidade e o link do Google Maps são opcionais. Você pode preenchê-los se quiser adicionar mais contexto.",
  },
  it: {
    oferente_nombre_perfil: "* Nome del tuo profilo o brand",
    oferente_categoria_placeholder: "In quale categoria rientra la tua proposta?",
    oferente_destino_label: "Paese di destinazione della tua proposta",
    oferente_idiomas_placeholder: "Lingue in cui comunichi",
    oferente_email_label: "La tua email di contatto con Travelgrin",
    oferente_aceptar_terminos: "* Accetta termini e condizioni",
    oferente_publicacion_basica: "Pubblicazione Base (gratis)",
    oferente_publicacion_destacada: "Pubblicazione in Evidenza",
    oferente_plan_visible_listado: "Visibile nell'elenco generale",
    oferente_plan_duracion_60: "Durata 60 giorni",
    oferente_plan_descripcion_breve: "Descrizione breve",
    oferente_plan_link_contacto: "1 link di contatto",
    oferente_featured_item_results: "Appare per prima nei risultati",
    oferente_featured_item_duration: "Durata 120 giorni",
    oferente_featured_item_badge: "Badge in evidenza",
    oferente_featured_item_description: "Descrizione ampliata",
    oferente_featured_item_links: "Vari link di contatto",
    oferente_featured_item_languages: "Disponibile in 4 lingue",
    oferente_featured_item_gallery: "Galleria fino a 5 immagini",
    oferente_publicar_gratis: "Pubblica Gratis",
    oferente_continuar_destacado: "Continua in evidenza",
    oferente_codigo_promocional: "Codice promozionale",
    oferente_destacado_intro: "Completa più informazioni per distinguerti e aumentare le richieste. Nulla di ciò che hai già inserito verrà cancellato.",
    oferente_destacado_heading: "Completa più informazioni per distinguerti e aumentare le richieste",
    oferente_logo_label: "Foto o logo del profilo",
    oferente_tipo_perfil: "Tipo di profilo",
    oferente_seleccionar_imagen: "Seleziona immagine",
    oferente_ninguna_imagen: "Nessuna immagine selezionata",
    oferente_sede: "Luogo in cui si svolge la tua proposta",
    oferente_pais_sede: "Paese della sede principale",
    oferente_ciudad_sede: "Città della sede principale",
    oferente_url_maps: "URL di Google Maps",
    oferente_imagenes_servicio: "Immagini del servizio (fino a 5)",
    oferente_elegir_imagenes: "Scegli immagini",
    oferente_limite_imagenes: "Seleziona solo la quantità restante; il limite è esattamente 5 immagini.",
    oferente_sin_imagenes: "Non hai ancora caricato immagini.",
    oferente_pasaportes_label: "Per viaggiatori di quali paesi vuoi apparire?",
    oferente_pasaportes_placeholder: "Se non scegli nessuno, appare per tutti",
    oferente_pasaportes_helper: "Se non scegli paesi, la tua pubblicazione appare per tutti. Se ne scegli uno o più, appare solo per quei passaporti.",
    oferente_incluye_placeholder: "* Cosa include il tuo servizio o cosa lo rende diverso?",
    oferente_no_incluye_placeholder: "Cosa non include o cosa deve tenere presente il viaggiatore?",
    oferente_links_contacto: "Link per permettere al viaggiatore di contattarti",
    oferente_anadir_link: "+ Aggiungi link",
    oferente_link_email_placeholder: "Link o email",
    oferente_precio_moneda: "Prezzo della tua proposta per valuta",
    oferente_agregar_moneda: "+ Aggiungi valuta",
    oferente_moneda: "Valuta",
    oferente_monto: "Importo",
    oferente_quitar: "Rimuovi",
    oferente_a_convenir: "*Da concordare",
    oferente_periodo_precio: "Periodo del prezzo",
    oferente_periodo_mes: "Al mese",
    oferente_periodo_semana: "A settimana",
    oferente_periodo_dia: "Al giorno",
    oferente_periodo_anio: "All'anno",
    oferente_periodo_unico: "Una volta",
    oferente_publicar_destacado: "Pubblica in Evidenza",
    oferente_volver_atras: "Torna indietro",
    oferente_datos_seguros: "I tuoi dati sono al sicuro.",
    oferente_sin_opciones: "Nessuna opzione disponibile",
    oferente_servicio_alt: "Servizio",
    oferente_contact_cellphone: "Cellulare",
    oferente_contact_other: "Altro",
    oferente_toast_nombre: "Completa il nome del profilo o del brand",
    oferente_toast_destino: "Scegli un paese di destinazione",
    oferente_toast_idioma: "Scegli almeno una lingua",
    oferente_toast_descripcion: "Completa la descrizione",
    oferente_toast_web: "Completa il sito web",
    oferente_toast_terminos: "Devi accettare termini e condizioni",
    oferente_turnstile_required: "Completa la verifica.",
    oferente_toast_sede: "Completa il paese in cui si svolge la tua proposta",
    oferente_toast_categoria_limite: "Puoi scegliere fino a 3 categorie o sottocategorie.",
    oferente_toast_revision: "La tua pubblicazione è in revisione",
    oferente_toast_pago_pestana: "Abbiamo aperto una nuova scheda per completare il pagamento.",
    oferente_toast_pago_exitoso: "Pagamento riuscito. Presto vedrai la pubblicazione sul sito.",
    oferente_toast_pago_cancelado: "Pagamento non completato o annullato. Puoi riprovare.",
    oferente_toast_nueva_publicacion: "Nuova pubblicazione inviata. Ti contatteremo a breve.",
    oferente_toast_cambios_enviados: "Richiesta di modifiche inviata. L'admin la esaminera prima di aggiornare la pubblicazione.",
    oferente_toast_cambios_error: "Non e stato possibile inviare la richiesta di modifiche. Riprova.",
    oferente_solicitar_cambios: "Richiedi modifiche",
    oferente_toast_imagen_valida: "Carica un'immagine valida",
    oferente_toast_imagen_limite: "Puoi caricare fino a 5 immagini. Ne restano {remaining}.",
    oferente_toast_imagen_tipo: "Sono consentite solo immagini valide",
    oferente_toast_comprimir_imagenes: "Non è stato possibile comprimere le immagini",
    oferente_promo_aplicar: "Applica",
    oferente_promo_empty_code: "Inserisci un codice promozionale.",
    oferente_promo_invalid: "Codice promozionale non valido.",
    oferente_promo_partner_only: "Questo codice promozionale si applica solo a partner/intermediari.",
    oferente_promo_expired: "Questo codice promozionale è scaduto.",
    oferente_promo_max_uses_reached: "Questo codice promozionale ha raggiunto il limite di utilizzo.",
    oferente_promo_inactive: "Questo codice promozionale non è attivo.",
    oferente_promo_validate_error: "Non è stato possibile validare il codice.",
    oferente_promo_applied: "Codice applicato. Sconto: {discount}%.",
    oferente_pago_preparando: "Preparazione del pagamento...",
    oferente_pago_redirigiendo: "Ti stiamo portando al checkout sicuro.",
    oferente_pago_completado: "Pagamento completato correttamente.",
    oferente_pago_no_completado: "Il pagamento non è stato completato.",
    oferente_pago_error: "Non è stato possibile avviare il pagamento. Riprova.",
    oferente_pago_popup_error: "Non è stato possibile aprire il checkout. Abilita i pop-up e riprova.",
    oferente_pago_verificando: "Verifica dello stato del pagamento...",
    oferente_opcional: "opzionale",
    oferente_sede_helper: "La città e il link di Google Maps sono opzionali. Puoi aggiungerli se vuoi fornire più contesto.",
  },
} as const;

type OferenteModalLocale = keyof typeof OFERENTE_MODAL_TEXT;
type OferenteModalTextKey = keyof typeof OFERENTE_MODAL_TEXT.es;
type PaymentUiState = {
  status: "idle" | "preparing" | "redirected" | "success" | "cancel" | "error";
  messageKey?: OferenteModalTextKey;
  detail?: string;
};

const CURRENCY_OPTIONS = ["ARS", "USD", "EUR", "BRL", "CLP", "COP", "MXN", "PEN", "UYU", "JPY"];
type PriceEntry = { currency: string; amount: string };
type VenueEntry = { country: string; city: string; mapUrl: string };
type ContactKind = "web" | "email" | "youtube" | "instagram" | "facebook" | "whatsapp" | "cellphone" | "linkedin" | "other";
type ContactEntry = { kind: ContactKind; url: string; label: string };
type AiFieldTarget = "description" | "included" | "notIncluded";
type ProviderFormDraft = {
  version: number;
  updatedAt: number;
  step: Step;
  selectedPlan: "basic_free" | "featured" | "monthly";
  selectedPaidPlanType: "featured_120d" | "featured_monthly";
  profileName: string;
  proposalCategories: string[];
  isOfrezco: boolean;
  isIntermediario: boolean;
  destinationCountry: string;
  destinationAvailabilityMode: "all" | "some";
  destinationAvailabilityCountries: string[];
  languages: string[];
  primaryVenue: VenueEntry;
  description: string;
  website: string;
  email: string;
  acceptedTerms: boolean;
  providerLogo: string;
  providerLogoAsset: ImageAsset | null;
  providerLogoName: string;
  providerType: string;
  serviceImages: string[];
  serviceImageAssets: ImageAsset[];
  serviceImageNames: string[];
  passportCountries: string[];
  included: string;
  notIncluded: string;
  contactLinks: ContactEntry[];
  priceEntries: PriceEntry[];
  priceNegotiable: boolean;
  pricePeriod: string;
  promoCode: string;
};

const MAX_PROVIDER_CATEGORIES = 3;
const PROVIDER_DRAFT_VERSION = 1;

const normalize = (value: string) => String(value ?? "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").trim();

function parseUnknownJsonObject(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  try {
    const parsed = JSON.parse(String(value ?? "{}"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch {}
  return {};
}

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
  optionGroups,
  placeholder,
  icon = "languages",
  isEmpty = false,
  emptyText,
  maxSelections,
  onLimitReached,
}: {
  selectedValues: string[];
  setSelectedValues: (values: string[]) => void;
  options: SelectOption[];
  optionGroups?: SelectOptionGroup[];
  placeholder: string;
  icon?: "languages" | "tag" | "user";
  isEmpty?: boolean;
  emptyText: string;
  maxSelections?: number;
  onLimitReached?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const selectedLabels = selectedValues
    .map((value) => options.find((option) => normalize(option.value) === normalize(value))?.label ?? value)
    .filter(Boolean);
  const Icon = icon === "tag" ? Tag : icon === "user" ? UserRound : Languages;
  const displayText = selectedLabels.length ? selectedLabels.join(", ") : placeholder;
  const hasGroupedOptions = Boolean(optionGroups?.length);

  useEffect(() => {
    if (!isOpen || !optionGroups?.length) return;
    setExpandedGroups((prev) => {
      const next = { ...prev };
      optionGroups.forEach((group) => {
        const shouldExpand = group.children.some((child) =>
          selectedValues.some((entry) => normalize(entry) === normalize(child.value))
        );
        if (shouldExpand && next[group.value] === undefined) {
          next[group.value] = true;
        }
      });
      return next;
    });
  }, [isOpen, optionGroups, selectedValues]);

  const toggleValue = (value: string) => {
    const exists = selectedValues.some((entry) => normalize(entry) === normalize(value));
    if (!exists && typeof maxSelections === "number" && selectedValues.length >= maxSelections) {
      onLimitReached?.();
      return;
    }
    setSelectedValues(exists ? selectedValues.filter((entry) => normalize(entry) !== normalize(value)) : [...selectedValues, value]);
  };

  const toggleGroup = (value: string) => {
    setExpandedGroups((prev) => ({ ...prev, [value]: !prev[value] }));
  };

  return (
    <div className="relative w-full text-black">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        title={displayText}
        className="flex w-full items-center justify-between rounded-2xl bg-white p-4 pt-6 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl focus:scale-[1.01]"
        style={{
          boxShadow: isEmpty
            ? "0 8px 25px -8px rgba(220, 38, 38, 0.4), 0 4px 12px -4px rgba(220, 38, 38, 0.2)"
            : "0 12px 36px -18px rgba(8, 217, 189, 0.55), 0 6px 18px -9px rgba(4, 181, 189, 0.35)",
        }}
      >
        <span className="flex min-w-0 items-center gap-3">
          <Icon className="h-5 w-5 shrink-0 text-[#0B8FA3]" />
          <span title={displayText} className={`truncate ${selectedLabels.length ? "text-gray-700" : "text-gray-600"}`}>
            {displayText}
          </span>
        </span>
        <ChevronDown className={`h-5 w-5 text-gray-400 transition ${isOpen ? "rotate-180 text-teal-500" : ""}`} />
      </button>

      {isOpen ? (
        <div className="absolute left-0 right-0 top-full z-[9999999] mt-2 max-h-64 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-2xl">
          <div className="max-h-64 overflow-y-auto p-2">
            {hasGroupedOptions ? (
              optionGroups?.length ? optionGroups.map((group) => {
                const checked = selectedValues.some((entry) => normalize(entry) === normalize(group.value));
                const isExpanded = expandedGroups[group.value] ?? false;
                const hasChildren = group.children.length > 0;
                return (
                  <div key={group.value} className="mb-1 rounded-xl border border-transparent last:mb-0">
                    <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${checked ? "bg-teal-50 text-teal-700" : "text-gray-700 hover:bg-teal-50"}`}>
                      <button type="button" onClick={() => toggleValue(group.value)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                        <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${checked ? "border-teal-500 bg-teal-500" : "border-gray-300"}`}>
                          {checked ? <Check className="h-3 w-3 text-white" /> : null}
                        </span>
                        <span className="truncate">{group.label}</span>
                      </button>
                      {hasChildren ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleGroup(group.value);
                          }}
                          aria-label={isExpanded ? "Contraer subcategorias" : "Expandir subcategorias"}
                          className="rounded-md p-1 text-slate-400 transition hover:bg-white/70 hover:text-teal-600"
                        >
                          <ChevronDown className={`h-4 w-4 transition ${isExpanded ? "rotate-180" : ""}`} />
                        </button>
                      ) : null}
                    </div>
                    {hasChildren && isExpanded ? (
                      <div className="mt-1 space-y-1 border-l border-slate-200 pl-3">
                        {group.children.map((child) => {
                          const childChecked = selectedValues.some((entry) => normalize(entry) === normalize(child.value));
                          return (
                            <button
                              key={child.value}
                              type="button"
                              onClick={() => toggleValue(child.value)}
                              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${childChecked ? "bg-teal-50 text-teal-700" : "text-gray-600 hover:bg-slate-50 hover:text-teal-700"}`}
                            >
                              <span className={`flex h-4 w-4 items-center justify-center rounded border ${childChecked ? "border-teal-500 bg-teal-500" : "border-gray-300"}`}>
                                {childChecked ? <Check className="h-3 w-3 text-white" /> : null}
                              </span>
                              <span>{child.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              }) : <div className="p-3 text-center text-sm text-gray-500">{emptyText}</div>
            ) : options.length ? options.map((option) => {
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
            }) : <div className="p-3 text-center text-sm text-gray-500">{emptyText}</div>}
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
  emptyText,
}: {
  selectedValue: string;
  setSelectedValue: (value: string) => void;
  options: SelectOption[];
  placeholder: string;
  emptyText: string;
}) {
  return (
    <MultiOptionSelect
      selectedValues={selectedValue ? [selectedValue] : []}
      setSelectedValues={(values) => setSelectedValue(values.at(-1) ?? "")}
      options={options}
      placeholder={placeholder}
      icon="user"
      emptyText={emptyText}
    />
  );
}

function PlanCard({
  title,
  tone,
  price,
  basePrice,
  showStrikethroughPrice = false,
  priceCaption,
  items,
  buttonLabel,
  onClick,
  disabled,
  showPromo = false,
  promoCode = "",
  onPromoCodeChange,
  onApplyPromo,
  promoPlaceholder,
  promoApplyLabel,
  promoDisabled = false,
  promoStatusText,
  promoStatusError = false,
  compact = false,
}: {
  title: string;
  tone: "free" | "featured";
  price: string;
  basePrice?: string;
  showStrikethroughPrice?: boolean;
  priceCaption?: string;
  items: string[];
  buttonLabel: string;
  onClick: () => void;
  disabled?: boolean;
  showPromo?: boolean;
  promoCode?: string;
  onPromoCodeChange?: (value: string) => void;
  onApplyPromo?: () => void;
  promoPlaceholder: string;
  promoApplyLabel?: string;
  promoDisabled?: boolean;
  promoStatusText?: string;
  promoStatusError?: boolean;
  compact?: boolean;
}) {
  const isFeatured = tone === "featured";
  return (
    <div className={`flex h-full flex-col rounded-[1.5rem] border text-sm shadow-[0_18px_45px_rgba(15,23,42,0.10)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(15,23,42,0.16)] ${compact ? "min-h-[24rem] p-4 md:p-5" : "min-h-[30rem] p-5 md:p-6"} ${isFeatured ? "border-[#67E8F9] bg-gradient-to-br from-[#102A6B] via-[#0B8FA3] to-[#00A9C6] text-white" : "border-emerald-300 bg-white/95 text-slate-800"}`}>
      <div className={`flex items-center gap-2 text-sm font-bold ${isFeatured ? "text-white" : "text-[#273166]"}`}>
        <span className={`h-3 w-3 rounded-full ${isFeatured ? "bg-cyan-200 shadow-[0_0_18px_rgba(165,243,252,0.95)]" : "bg-emerald-500"}`} />
        {title}
      </div>
      <ul className={`mt-4 flex-1 space-y-2 text-sm ${compact ? "leading-5" : "leading-6"} ${isFeatured ? "text-cyan-50" : "text-slate-700"}`}>
        {items.map((item) => <li key={item}>• {item}</li>)}
      </ul>
      <div className={`${compact ? "mt-4" : "mt-5"} text-center`}>
        {showStrikethroughPrice && basePrice ? (
          <div className={`text-sm font-semibold line-through ${isFeatured ? "text-cyan-100/90" : "text-slate-500"}`}>{basePrice}</div>
        ) : null}
        <div className={`${compact ? "text-[1.55rem]" : "text-2xl"} font-extrabold ${isFeatured ? "text-white" : "text-slate-900"}`}>{price}</div>
        {priceCaption ? <div className={`text-xs ${isFeatured ? "text-cyan-100" : "text-slate-500"}`}>{priceCaption}</div> : null}
      </div>
      {showPromo ? (
        <>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              value={promoCode}
              onChange={(event) => onPromoCodeChange?.(event.target.value)}
              className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-[#00A9C6]/30"
              style={{ colorScheme: "light" }}
              placeholder={promoPlaceholder}
            />
            <button
              type="button"
              onClick={onApplyPromo}
              className={`h-10 w-full rounded-xl border px-4 text-sm font-semibold transition hover:brightness-105 disabled:opacity-60 sm:w-auto ${isFeatured ? "border-white/30 bg-white/20 text-white hover:bg-white/30" : "border-[#273166]/15 bg-[#273166] text-white hover:bg-[#1d2550]"}`}
              disabled={!onApplyPromo || promoDisabled || disabled}
            >
              {promoApplyLabel ?? "Aplicar"}
            </button>
          </div>
          {promoStatusText ? (
            <p className={`mt-2 text-xs ${promoStatusError ? "text-rose-100" : "text-emerald-100"}`}>{promoStatusText}</p>
          ) : null}
        </>
      ) : null}
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`group relative mt-3 overflow-hidden rounded-xl px-4 py-2 text-sm font-bold shadow transition before:absolute before:inset-y-0 before:-left-1/2 before:w-1/2 before:skew-x-[-18deg] before:bg-white/35 before:opacity-0 before:transition-all before:duration-700 hover:before:left-[120%] hover:before:opacity-100 disabled:cursor-not-allowed disabled:opacity-60 ${isFeatured ? "bg-[#273166] text-white shadow-[0_0_26px_rgba(39,49,102,0.35)] hover:bg-[#1d2550] hover:shadow-[0_0_36px_rgba(39,49,102,0.45)]" : "bg-[#273166] text-white hover:bg-[#1d2550]"}`}
      >
        <span className="relative z-10">{buttonLabel}</span>
      </button>
    </div>
  );
}

function PaymentStatusPanel({
  state,
  text,
}: {
  state: PaymentUiState;
  text: (key: OferenteModalTextKey) => string;
}) {
  if (state.status === "idle") return null;

  const isLoadingState = state.status === "preparing" || state.status === "redirected";
  const isSuccess = state.status === "success";
  const Icon = isLoadingState ? Loader2 : isSuccess ? CheckCircle2 : XCircle;
  const messageKey =
    state.messageKey ??
    (isLoadingState
      ? "oferente_pago_preparando"
      : isSuccess
        ? "oferente_pago_completado"
        : "oferente_pago_no_completado");

  return (
    <div
      className={`rounded-2xl border px-4 py-5 text-center shadow-sm ${
        isLoadingState
          ? "border-cyan-200 bg-cyan-50 text-[#0B7187]"
          : isSuccess
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-rose-200 bg-rose-50 text-rose-700"
      }`}
      role="status"
      aria-live="polite"
    >
      <Icon className={`mx-auto h-10 w-10 ${isLoadingState ? "animate-spin" : ""}`} />
      <p className="mt-3 text-sm font-bold">{text(messageKey)}</p>
      {state.detail ? <p className="mt-1 text-xs opacity-80">{state.detail}</p> : null}
    </div>
  );
}

export default function ModalOferente({
  onClose,
  initialEmail = "",
  lockEmail = false,
  showMonthlyPlanOption = false,
  visiblePlans = ["basic_free", "featured", "monthly"],
  fixedCountry = "",
  initialPlan = "basic_free",
  preferredPaidPlanType = "featured_120d",
  requestKind = "new_publication",
  previousPlan,
  sourceServiceId = "",
  sourcePublicationId = "",
  publicationChangeMode = false,
  initialData = null,
  resumeMode = false,
  resumeSubmissionId = "",
  resumePaymentState = "",
  resumeStatusReason = "",
  compactPlanCards = false,
  onSubmitted,
  onPaymentResolved,
}: Props) {
  const { t, locale } = useTranslation();
  const { selectedCountry, setIsOpenModal } = useCountry();
  const modalLocale: OferenteModalLocale = locale in OFERENTE_MODAL_TEXT ? (locale as OferenteModalLocale) : "es";
  const mt = (key: OferenteModalTextKey) => OFERENTE_MODAL_TEXT[modalLocale][key] ?? OFERENTE_MODAL_TEXT.es[key];
  const fillText = (key: OferenteModalTextKey, replacements: Record<string, string>) =>
    (Object.entries(replacements) as Array<[string, string]>).reduce<string>(
      (text, [token, value]) => text.replace(`{${token}}`, value),
      mt(key),
    );
  const promoMessageKey = (payload: any): OferenteModalTextKey => {
    const code = String(payload?.errorCode ?? payload?.reason ?? "").trim().toLowerCase();
    if (code.includes("empty")) return "oferente_promo_empty_code";
    if (code.includes("partner")) return "oferente_promo_partner_only";
    if (code.includes("expired")) return "oferente_promo_expired";
    if (code.includes("max_uses") || code.includes("limit")) return "oferente_promo_max_uses_reached";
    if (code.includes("inactive")) return "oferente_promo_inactive";
    if (code.includes("invalid")) return "oferente_promo_invalid";
    const raw = normalize(String(payload?.error ?? ""));
    if (raw.includes("partner") || raw.includes("intermediario")) return "oferente_promo_partner_only";
    if (raw.includes("limite") || raw.includes("uso")) return "oferente_promo_max_uses_reached";
    if (raw.includes("vencio") || raw.includes("expired")) return "oferente_promo_expired";
    if (raw.includes("activo") || raw.includes("active")) return "oferente_promo_inactive";
    if (raw.includes("invalido") || raw.includes("invalid")) return "oferente_promo_invalid";
    return "oferente_promo_validate_error";
  };
  const featuredItems = [
    mt("oferente_featured_item_results"),
    mt("oferente_featured_item_duration"),
    mt("oferente_featured_item_badge"),
    mt("oferente_featured_item_description"),
    mt("oferente_featured_item_links"),
    mt("oferente_featured_item_languages"),
    mt("oferente_featured_item_gallery"),
  ];
  const basicItems = [
    mt("oferente_plan_visible_listado"),
    mt("oferente_plan_duracion_60"),
    mt("oferente_plan_descripcion_breve"),
    mt("oferente_plan_link_contacto"),
  ];

  const [mounted, setMounted] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filterGroups, setFilterGroups] = useState<FilterGroupLite[]>([]);
  const [step, setStep] = useState<Step>("basic");
  const [isLoading, setIsLoading] = useState(false);
  const [paymentUi, setPaymentUi] = useState<PaymentUiState>({ status: "idle" });
  const paymentTabRef = useRef<Window | null>(null);
  const paymentWatcherRef = useRef<number | null>(null);
  const paymentResultReceivedRef = useRef(false);
  const submittedServiceIdRef = useRef<string | null>(null);
  const [isOpenModalAI, setIsOpenModalAI] = useState(false);
  const modalBodyRef = useRef<HTMLDivElement | null>(null);
  const draftLoadedRef = useRef(false);
  const [hasHydratedInitialData, setHasHydratedInitialData] = useState(false);
  const autoFilledVenueCountryRef = useRef("");

  const draftStorageKey = useMemo(() => {
    const keyParts = [
      "travelgrin_oferente_draft",
      requestKind,
      resumeSubmissionId || sourcePublicationId || sourceServiceId || initialEmail || "new",
      initialPlan,
    ].map((entry) => String(entry ?? "").trim()).filter(Boolean);
    return keyParts.join("__");
  }, [initialEmail, initialPlan, requestKind, resumeSubmissionId, sourcePublicationId, sourceServiceId]);

  const [profileName, setProfileName] = useState("");
  const [proposalCategories, setProposalCategories] = useState<string[]>([]);
  const [isOfrezco, setIsOfrezco] = useState(false);
  const [isIntermediario, setIsIntermediario] = useState(false);
  const previousIntermediarioRef = useRef(isIntermediario);
  const [destinationCountry, setDestinationCountry] = useState("");
  const [destinationAvailabilityMode, setDestinationAvailabilityMode] = useState<"all" | "some">("all");
  const [destinationAvailabilityCountries, setDestinationAvailabilityCountries] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [primaryVenue, setPrimaryVenue] = useState<VenueEntry>({ country: "", city: "", mapUrl: "" });
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [email, setEmail] = useState(initialEmail);
  const [emailError, setEmailError] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);

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
  const [venueCitySuggestions, setVenueCitySuggestions] = useState<string[]>([]);
  const [priceEntries, setPriceEntries] = useState<PriceEntry[]>([{ currency: "USD", amount: "" }]);
  const [priceNegotiable, setPriceNegotiable] = useState(false);
  const [pricePeriod, setPricePeriod] = useState("month");
  const [promoCode, setPromoCode] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<"basic_free" | "featured" | "monthly">(initialPlan);
  const [selectedPaidPlanType, setSelectedPaidPlanType] = useState<"featured_120d" | "featured_monthly">(preferredPaidPlanType);
  const [featured120PlanPricing, setFeatured120PlanPricing] = useState<FeaturedPlanPricing>({
    country: null,
    planType: "featured_120d",
    currency: "USD",
    amount: FEATURED_PLAN_AMOUNT > 0 ? FEATURED_PLAN_AMOUNT : 0,
  });
  const [monthlyPlanPricing, setMonthlyPlanPricing] = useState<FeaturedPlanPricing>({
    country: null,
    planType: "featured_monthly",
    currency: "USD",
    amount: FEATURED_PLAN_AMOUNT > 0 ? FEATURED_PLAN_AMOUNT : 0,
  });
  const [promoValidation, setPromoValidation] = useState<PromoValidationState>({
    applied: false,
    code: "",
    discountPercent: 0,
    originalAmount: FEATURED_PLAN_AMOUNT > 0 ? FEATURED_PLAN_AMOUNT : null,
    discountedAmount: FEATURED_PLAN_AMOUNT > 0 ? FEATURED_PLAN_AMOUNT : null,
    message: "",
    error: false,
  });

  const [isEmptyProfileName, setIsEmptyProfileName] = useState(false);
  const [isEmptyProposalCategory, setIsEmptyProposalCategory] = useState(false);
  const [isEmptyEmail, setIsEmptyEmail] = useState(false);
  const [isEmptyTerms, setIsEmptyTerms] = useState(false);
  const [featuredTypeFocusKey, setFeaturedTypeFocusKey] = useState(0);
  const effectiveResumePaymentState = String(resumePaymentState || initialData?.paymentStatus || initialData?.paymentReturnStatus || "").trim().toLowerCase();
  const canReuseCompletedPayment = resumeMode && ["paid", "approved", "completed", "success", "ok"].includes(effectiveResumePaymentState);

  const effectiveCountry = String(fixedCountry || selectedCountry || "").trim();
  const effectivePlanPricing = selectedPlan === "monthly" ? monthlyPlanPricing : featured120PlanPricing;

  const featuredPriceBreakdown = useMemo<PriceBreakdown>(() => {
    const baseAmount = effectivePlanPricing.amount > 0 ? effectivePlanPricing.amount : null;
    if (promoValidation.applied && !promoValidation.error && baseAmount !== null && promoValidation.discountedAmount !== null) {
      return {
        baseLabel: formatMoneyLabel(baseAmount, effectivePlanPricing.currency),
        finalLabel: formatMoneyLabel(promoValidation.discountedAmount, effectivePlanPricing.currency),
        showStrikethrough: true,
      };
    }
    return {
      baseLabel: formatMoneyLabel(baseAmount, effectivePlanPricing.currency),
      finalLabel: formatMoneyLabel(baseAmount, effectivePlanPricing.currency),
      showStrikethrough: false,
    };
  }, [effectivePlanPricing.amount, effectivePlanPricing.currency, promoValidation]);

  const featured120PriceBreakdown = useMemo<PriceBreakdown>(() => ({
    baseLabel: formatMoneyLabel(featured120PlanPricing.amount > 0 ? featured120PlanPricing.amount : null, featured120PlanPricing.currency),
    finalLabel: formatMoneyLabel(featured120PlanPricing.amount > 0 ? featured120PlanPricing.amount : null, featured120PlanPricing.currency),
    showStrikethrough: false,
  }), [featured120PlanPricing.amount, featured120PlanPricing.currency]);

  const monthlyPriceBreakdown = useMemo<PriceBreakdown>(() => ({
    baseLabel: formatMoneyLabel(monthlyPlanPricing.amount > 0 ? monthlyPlanPricing.amount : null, monthlyPlanPricing.currency),
    finalLabel: formatMoneyLabel(monthlyPlanPricing.amount > 0 ? monthlyPlanPricing.amount : null, monthlyPlanPricing.currency),
    showStrikethrough: false,
  }), [monthlyPlanPricing.amount, monthlyPlanPricing.currency]);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!initialEmail) return;
    setEmail(initialEmail);
    setEmailError("");
    setIsEmptyEmail(false);
  }, [initialEmail]);
  useEffect(() => {
    if (!resumeMode) return;
    setSelectedPlan(initialPlan);
    setSelectedPaidPlanType(preferredPaidPlanType);
    setStep("basic");
  }, [initialPlan, preferredPaidPlanType, resumeMode]);
  useEffect(() => {
    if (!initialData) {
      setHasHydratedInitialData(true);
      return;
    }
    const fallbackExtra = parseUnknownJsonObject(initialData.whatSearchingRaw ?? initialData.whatSearching ?? null);
    const mergedInitialData = { ...fallbackExtra, ...initialData };
    setProfileName(String(mergedInitialData.name ?? mergedInitialData.profileName ?? "").trim());
    setProposalCategories(
      Array.isArray(mergedInitialData.category)
        ? mergedInitialData.category.map((entry: unknown) => String(entry ?? "").trim()).filter(Boolean)
        : [],
    );
    setIsOfrezco(Boolean(mergedInitialData.isOfrezco));
    setIsIntermediario(Boolean(mergedInitialData.isIntermediario));
    setDestinationCountry(String(mergedInitialData.destinationCountry ?? "").trim());
    setDestinationAvailabilityMode(mergedInitialData.receivingCountriesMode === "only" ? "some" : "all");
    setDestinationAvailabilityCountries(
      Array.isArray(mergedInitialData.receivingCountries)
        ? mergedInitialData.receivingCountries.map((entry: unknown) => String(entry ?? "").trim()).filter(Boolean)
        : [],
    );
    setPassportCountries(
      Array.isArray(mergedInitialData.receivingCountries)
        ? mergedInitialData.receivingCountries.map((entry: unknown) => String(entry ?? "").trim()).filter(Boolean)
        : [],
    );
    setLanguages(
      Array.isArray(mergedInitialData.languages)
        ? mergedInitialData.languages.map((entry: unknown) => String(entry ?? "").trim()).filter(Boolean)
        : [],
    );
    const firstVenue =
      Array.isArray(mergedInitialData.venues) && mergedInitialData.venues[0] && typeof mergedInitialData.venues[0] === "object"
        ? (mergedInitialData.venues[0] as Record<string, unknown>)
        : null;
    setPrimaryVenue({
      country: String(firstVenue?.country ?? mergedInitialData.headquarterCountry ?? "").trim(),
      city: String(firstVenue?.city ?? mergedInitialData.headquarterCity ?? mergedInitialData.city ?? "").trim(),
      mapUrl: String(firstVenue?.mapUrl ?? mergedInitialData.headquarterMapUrl ?? mergedInitialData.destinationMapUrl ?? "").trim(),
    });
    setDescription(String(mergedInitialData.contanos ?? mergedInitialData.description ?? "").trim());
    setWebsite(String(mergedInitialData.website ?? "").trim());
    setProviderLogo(String(mergedInitialData.providerLogo ?? "").trim());
    setProviderLogoAsset(mergedInitialData.providerLogoAsset && typeof mergedInitialData.providerLogoAsset === "object" ? mergedInitialData.providerLogoAsset as ImageAsset : null);
    setProviderType(
      Array.isArray(mergedInitialData.typeProfile)
        ? String(mergedInitialData.typeProfile[0] ?? "").trim()
        : String(mergedInitialData.providerType ?? "").trim(),
    );
    setServiceImages(
      Array.isArray(mergedInitialData.images)
        ? mergedInitialData.images.map((entry: unknown) => String(entry ?? "").trim()).filter(Boolean)
        : [],
    );
    setServiceImageAssets(
      Array.isArray(mergedInitialData.imageAssets)
        ? mergedInitialData.imageAssets.filter((entry: unknown) => entry && typeof entry === "object") as ImageAsset[]
        : [],
    );
    setIncluded(
      Array.isArray(mergedInitialData.included)
        ? mergedInitialData.included.map((entry: unknown) => String(entry ?? "").trim()).filter(Boolean).join("\n")
        : String(mergedInitialData.included ?? "").trim(),
    );
    setNotIncluded(
      Array.isArray(mergedInitialData.notIncluded)
        ? mergedInitialData.notIncluded.map((entry: unknown) => String(entry ?? "").trim()).filter(Boolean).join("\n")
        : String(mergedInitialData.notIncluded ?? "").trim(),
    );
    const detailedLinks = Array.isArray(mergedInitialData.socialLinksDetailed)
      ? mergedInitialData.socialLinksDetailed
          .map((entry: unknown) => {
            if (!entry || typeof entry !== "object") return null;
            const item = entry as Record<string, unknown>;
            return {
              kind: String(item.kind ?? "web") as ContactKind,
              label: String(item.label ?? "").trim(),
              url: String(item.url ?? "").trim(),
            };
          })
          .filter(Boolean) as ContactEntry[]
      : [];
    setContactLinks(detailedLinks.length ? detailedLinks : [{ kind: "web", url: "", label: "" }]);
    const nextPrices = Array.isArray(mergedInitialData.priceByCurrency)
      ? mergedInitialData.priceByCurrency
          .map((entry: unknown) => {
            if (!entry || typeof entry !== "object") return null;
            const item = entry as Record<string, unknown>;
            const currency = String(item.currency ?? "").trim().toUpperCase();
            const amount = String(item.amount ?? "").trim();
            if (!currency || !amount) return null;
            return { currency, amount };
          })
          .filter(Boolean) as PriceEntry[]
      : [];
    setPriceEntries(nextPrices.length ? nextPrices : [{ currency: "USD", amount: "" }]);
    setPriceNegotiable(Boolean(mergedInitialData.priceNegotiable));
    setPricePeriod(String(mergedInitialData.pricePeriod ?? "month").trim() || "month");
    setAcceptedTerms(Boolean(mergedInitialData.acceptedTerms ?? true));
    autoFilledVenueCountryRef.current = String(firstVenue?.country ?? mergedInitialData.headquarterCountry ?? "").trim();
    setHasHydratedInitialData(true);
  }, [initialData]);

  const clearDraft = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(draftStorageKey);
    } catch {}
  }, [draftStorageKey]);

  useEffect(() => {
    if (!mounted || !hasHydratedInitialData || draftLoadedRef.current || typeof window === "undefined") return;
    draftLoadedRef.current = true;
    if (initialData && (publicationChangeMode || requestKind === "edit_publication" || sourcePublicationId.trim())) return;
    try {
      const stored = window.localStorage.getItem(draftStorageKey);
      if (!stored) return;
      const parsed = JSON.parse(stored) as Partial<ProviderFormDraft> | null;
      if (!parsed || parsed.version !== PROVIDER_DRAFT_VERSION) return;
      setStep(parsed.step === "featured" ? "featured" : "basic");
      setSelectedPlan(parsed.selectedPlan === "monthly" || parsed.selectedPlan === "featured" ? parsed.selectedPlan : "basic_free");
      setSelectedPaidPlanType(parsed.selectedPaidPlanType === "featured_monthly" ? "featured_monthly" : "featured_120d");
      setProfileName(String(parsed.profileName ?? "").trim());
      setProposalCategories(Array.isArray(parsed.proposalCategories) ? parsed.proposalCategories.map((entry) => String(entry ?? "").trim()).filter(Boolean) : []);
      setIsOfrezco(Boolean(parsed.isOfrezco));
      setIsIntermediario(Boolean(parsed.isIntermediario));
      setDestinationCountry(String(parsed.destinationCountry ?? "").trim());
      setDestinationAvailabilityMode(parsed.destinationAvailabilityMode === "some" ? "some" : "all");
      setDestinationAvailabilityCountries(Array.isArray(parsed.destinationAvailabilityCountries) ? parsed.destinationAvailabilityCountries.map((entry) => String(entry ?? "").trim()).filter(Boolean) : []);
      setLanguages(Array.isArray(parsed.languages) ? parsed.languages.map((entry) => String(entry ?? "").trim()).filter(Boolean) : []);
      const nextVenue = parsed.primaryVenue && typeof parsed.primaryVenue === "object"
        ? {
            country: String(parsed.primaryVenue.country ?? "").trim(),
            city: String(parsed.primaryVenue.city ?? "").trim(),
            mapUrl: String(parsed.primaryVenue.mapUrl ?? "").trim(),
          }
        : { country: "", city: "", mapUrl: "" };
      autoFilledVenueCountryRef.current = nextVenue.country;
      setPrimaryVenue(nextVenue);
      setDescription(String(parsed.description ?? "").trim());
      setWebsite(String(parsed.website ?? "").trim());
      if (!lockEmail) setEmail(String(parsed.email ?? initialEmail ?? "").trim());
      setAcceptedTerms(Boolean(parsed.acceptedTerms));
      setProviderLogo(String(parsed.providerLogo ?? "").trim());
      setProviderLogoAsset(parsed.providerLogoAsset && typeof parsed.providerLogoAsset === "object" ? parsed.providerLogoAsset as ImageAsset : null);
      setProviderLogoName(String(parsed.providerLogoName ?? "").trim());
      setProviderType(String(parsed.providerType ?? "").trim());
      setServiceImages(Array.isArray(parsed.serviceImages) ? parsed.serviceImages.map((entry) => String(entry ?? "").trim()).filter(Boolean) : []);
      setServiceImageAssets(Array.isArray(parsed.serviceImageAssets) ? parsed.serviceImageAssets.filter((entry): entry is ImageAsset => Boolean(entry && typeof entry === "object")) : []);
      setServiceImageNames(Array.isArray(parsed.serviceImageNames) ? parsed.serviceImageNames.map((entry) => String(entry ?? "").trim()).filter(Boolean) : []);
      setPassportCountries(Array.isArray(parsed.passportCountries) ? parsed.passportCountries.map((entry) => String(entry ?? "").trim()).filter(Boolean) : []);
      setIncluded(String(parsed.included ?? "").trim());
      setNotIncluded(String(parsed.notIncluded ?? "").trim());
      setContactLinks(Array.isArray(parsed.contactLinks) && parsed.contactLinks.length
        ? parsed.contactLinks.map((entry) => ({
            kind: String(entry?.kind ?? "web") as ContactKind,
            url: String(entry?.url ?? "").trim(),
            label: String(entry?.label ?? "").trim(),
          }))
        : [{ kind: "web", url: "", label: "" }]);
      setPriceEntries(Array.isArray(parsed.priceEntries) && parsed.priceEntries.length
        ? parsed.priceEntries.map((entry) => ({ currency: String(entry?.currency ?? "").trim(), amount: String(entry?.amount ?? "").trim() }))
        : [{ currency: "USD", amount: "" }]);
      setPriceNegotiable(Boolean(parsed.priceNegotiable));
      setPricePeriod(String(parsed.pricePeriod ?? "month").trim() || "month");
      setPromoCode(String(parsed.promoCode ?? "").trim());
    } catch {}
  }, [draftStorageKey, hasHydratedInitialData, initialData, initialEmail, lockEmail, mounted, publicationChangeMode, requestKind, sourcePublicationId]);

  useEffect(() => {
    if (!mounted || !draftLoadedRef.current || typeof window === "undefined") return;
    if (publicationChangeMode || requestKind === "edit_publication" || sourcePublicationId.trim()) return;
    const draft: ProviderFormDraft = {
      version: PROVIDER_DRAFT_VERSION,
      updatedAt: Date.now(),
      step,
      selectedPlan,
      selectedPaidPlanType,
      profileName,
      proposalCategories,
      isOfrezco,
      isIntermediario,
      destinationCountry,
      destinationAvailabilityMode,
      destinationAvailabilityCountries,
      languages,
      primaryVenue,
      description,
      website,
      email,
      acceptedTerms,
      providerLogo,
      providerLogoAsset,
      providerLogoName,
      providerType,
      serviceImages,
      serviceImageAssets,
      serviceImageNames,
      passportCountries,
      included,
      notIncluded,
      contactLinks,
      priceEntries,
      priceNegotiable,
      pricePeriod,
      promoCode,
    };
    try {
      window.localStorage.setItem(draftStorageKey, JSON.stringify(draft));
    } catch {}
  }, [
    acceptedTerms,
    contactLinks,
    description,
    destinationAvailabilityCountries,
    destinationAvailabilityMode,
    destinationCountry,
    draftStorageKey,
    email,
    included,
    isIntermediario,
    isOfrezco,
    languages,
    mounted,
    notIncluded,
    passportCountries,
    priceEntries,
    priceNegotiable,
    pricePeriod,
    profileName,
    promoCode,
    proposalCategories,
    providerLogo,
    providerLogoAsset,
    providerLogoName,
    providerType,
    primaryVenue,
    selectedPaidPlanType,
    selectedPlan,
    serviceImageAssets,
    serviceImageNames,
    serviceImages,
    publicationChangeMode,
    requestKind,
    sourcePublicationId,
    step,
    website,
  ]);

  useEffect(() => {
    const nextDestinationCountry = String(destinationCountry ?? "").trim();
    if (!nextDestinationCountry) return;
    setPrimaryVenue((prev) => {
      const currentCountry = String(prev.country ?? "").trim();
      if (!currentCountry) {
        autoFilledVenueCountryRef.current = nextDestinationCountry;
        return { ...prev, country: nextDestinationCountry };
      }
      if (autoFilledVenueCountryRef.current && normalize(currentCountry) === normalize(autoFilledVenueCountryRef.current)) {
        autoFilledVenueCountryRef.current = nextDestinationCountry;
        if (normalize(currentCountry) === normalize(nextDestinationCountry)) return prev;
        return { ...prev, country: nextDestinationCountry };
      }
      return prev;
    });
  }, [destinationCountry]);

  useEffect(() => {
    const venueCountry = String(primaryVenue.country ?? "").trim();
    if (!venueCountry) {
      setVenueCitySuggestions([]);
      return;
    }

    let isCancelled = false;
    const loadCitySuggestions = async () => {
      try {
        const params = new URLSearchParams({
          status: "active",
          destinationCountry: venueCountry,
          perPage: "50",
          page: "1",
        });
        const response = await fetch(`/api/publications?${params.toString()}`, { cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        const items = Array.isArray(data?.items) ? data.items : [];
        const seen = new Set<string>();
        const nextSuggestions = items
          .flatMap((item: any) => [
            String(item?.city ?? "").trim(),
            String(item?.headquarterCity ?? "").trim(),
            ...(Array.isArray(item?.fields?.headquarterLocations)
              ? item.fields.headquarterLocations.map((location: any) => String(location?.city ?? "").trim())
              : []),
          ])
          .filter(Boolean)
          .filter((city: string) => {
            const key = normalize(city);
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .sort((a: string, b: string) => a.localeCompare(b, locale === "en" ? "en" : locale === "pt" ? "pt" : locale === "it" ? "it" : "es"));
        if (!isCancelled) setVenueCitySuggestions(nextSuggestions);
      } catch {
        if (!isCancelled) setVenueCitySuggestions([]);
      }
    };

    void loadCitySuggestions();
    return () => {
      isCancelled = true;
    };
  }, [locale, primaryVenue.country]);
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
      fetch("/api/oferente-destinations").then((res) => res.json()).catch(() => ({ mode: "all", countries: [] })),
    ])
      .then(([categoryData, filterData, destinationData]) => {
        setCategories(Array.isArray(categoryData?.items) ? categoryData.items : []);
        setFilterGroups(Array.isArray(filterData?.groups) ? filterData.groups : []);
        const mode = destinationData?.mode === "some" ? "some" : "all";
        const countries = Array.isArray(destinationData?.countries)
          ? destinationData.countries.map((entry: unknown) => String(entry ?? "").trim()).filter(Boolean)
          : [];
        setDestinationAvailabilityMode(mode);
        setDestinationAvailabilityCountries(countries);
      })
      .catch(() => {
        setCategories([]);
        setFilterGroups([]);
        setDestinationAvailabilityMode("all");
        setDestinationAvailabilityCountries([]);
      });
  }, []);

  useEffect(() => {
    if (destinationAvailabilityMode !== "some") return;
    if (!destinationCountry.trim()) return;
    const normalized = destinationCountry.trim().toLowerCase();
    const allowed = new Set(destinationAvailabilityCountries.map((country) => country.trim().toLowerCase()));
    if (!allowed.has(normalized)) setDestinationCountry("");
  }, [destinationAvailabilityMode, destinationAvailabilityCountries, destinationCountry]);

  useEffect(() => {
    const country = effectiveCountry;
    if (!country) return;
    Promise.all([
      fetch(`/api/featured-plan-pricing?country=${encodeURIComponent(country)}&planType=featured_120d`, { cache: "no-store" }).then((res) => res.json()).catch(() => ({})),
      fetch(`/api/featured-plan-pricing?country=${encodeURIComponent(country)}&planType=featured_monthly`, { cache: "no-store" }).then((res) => res.json()).catch(() => ({})),
    ])
      .then(([featuredData, monthlyData]) => {
        const parsePricing = (raw: any, fallbackPlanType: "featured_120d" | "featured_monthly"): FeaturedPlanPricing => {
          const item = raw?.item ?? {};
          const amount = Number(item?.amount ?? 0);
          const currency = String(item?.currency ?? "USD").toUpperCase() === "ARS" ? "ARS" : "USD";
          return {
            country: item?.country ? String(item.country) : null,
            planType: fallbackPlanType,
            currency,
            amount: Number.isFinite(amount) ? amount : 0,
          };
        };
        const nextFeatured120 = parsePricing(featuredData, "featured_120d");
        const nextMonthly = parsePricing(monthlyData, "featured_monthly");
        setFeatured120PlanPricing(nextFeatured120);
        setMonthlyPlanPricing(nextMonthly);
        const currentPlanPricing = selectedPlan === "monthly" ? nextMonthly : nextFeatured120;
        setPromoValidation((prev) => ({
          ...prev,
          originalAmount: currentPlanPricing.amount > 0 ? currentPlanPricing.amount : null,
          discountedAmount: prev.applied && !prev.error
            ? Number((currentPlanPricing.amount * (1 - Number(prev.discountPercent || 0) / 100)).toFixed(2))
            : (currentPlanPricing.amount > 0 ? currentPlanPricing.amount : null),
        }));
      })
      .catch(() => null);
  }, [effectiveCountry, selectedPlan]);

  useEffect(() => {
    if (!promoCode.trim()) {
      setPromoValidation((prev) => ({
        ...prev,
        applied: false,
        code: "",
        discountPercent: 0,
        discountedAmount: effectivePlanPricing.amount > 0 ? effectivePlanPricing.amount : null,
        message: "",
        error: false,
      }));
      return;
    }
    if (!promoValidation.applied) return;
    if (promoValidation.code.trim().toUpperCase() !== promoCode.trim().toUpperCase()) {
      setPromoValidation((prev) => ({
        ...prev,
        applied: false,
        code: "",
        discountPercent: 0,
        discountedAmount: effectivePlanPricing.amount > 0 ? effectivePlanPricing.amount : null,
        message: "",
        error: false,
      }));
    }
  }, [effectivePlanPricing.amount, promoCode, promoValidation.applied, promoValidation.code]);

  useEffect(() => {
    if (previousIntermediarioRef.current === isIntermediario) return;
    previousIntermediarioRef.current = isIntermediario;
    if (!promoValidation.applied) return;
    setPromoValidation((prev) => ({
      ...prev,
      applied: false,
      code: "",
      discountPercent: 0,
      discountedAmount: effectivePlanPricing.amount > 0 ? effectivePlanPricing.amount : null,
      message: "",
      error: false,
    }));
  }, [effectivePlanPricing.amount, isIntermediario, promoValidation.applied]);

  const clearPaymentWatcher = useCallback(() => {
    if (paymentWatcherRef.current !== null) {
      window.clearInterval(paymentWatcherRef.current);
      paymentWatcherRef.current = null;
    }
  }, []);

  const normalizePaymentResult = useCallback((rawStatus: string): "success" | "cancel" | "pending" => {
    const value = String(rawStatus ?? "").trim().toLowerCase();
    if (["success", "approved", "paid", "completed", "ok"].includes(value)) return "success";
    if (["pending", "processing", "in_process", "authorized"].includes(value)) return "pending";
    if (["cancel", "cancelled", "canceled", "back", "failed", "rejected", "not_found", "no_payment", "error"].includes(value)) return "cancel";
    return "pending";
  }, []);

  const verifyPaymentStatus = useCallback(async (serviceId: string, returnStatus = "check") => {
    try {
      const response = await fetch("/api/payments/featured/return", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId, status: returnStatus }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) return returnStatus === "cancel" ? "cancel" as const : "pending" as const;
      return normalizePaymentResult(String(data?.status ?? ""));
    } catch {
      return returnStatus === "cancel" ? "cancel" as const : "pending" as const;
    }
  }, [normalizePaymentResult]);

  const verifyPaymentWithRetries = useCallback(async (serviceId: string, returnStatus = "check") => {
    setPaymentUi({ status: "preparing", messageKey: "oferente_pago_verificando" });
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const result = await verifyPaymentStatus(serviceId, returnStatus);
      if (result !== "pending") return result;
      await new Promise((resolve) => window.setTimeout(resolve, 1200));
    }
    return "pending" as const;
  }, [verifyPaymentStatus]);

  const keepCheckingPendingPayment = useCallback((serviceId: string, paidPlan: "featured" | "monthly") => {
    clearPaymentWatcher();
    let attempts = 0;
    paymentWatcherRef.current = window.setInterval(() => {
      attempts += 1;
      void verifyPaymentStatus(serviceId, "check").then((nextResult) => {
        if (nextResult === "success") {
          clearPaymentWatcher();
          setPaymentUi({ status: "success", messageKey: "oferente_pago_completado" });
          clearDraft();
          onSubmitted?.({ serviceId, plan: paidPlan });
          submittedServiceIdRef.current = null;
          return;
        }
        if (nextResult === "cancel") {
          clearPaymentWatcher();
          setPaymentUi({ status: "cancel", messageKey: "oferente_pago_no_completado" });
          onPaymentResolved?.({ serviceId, plan: paidPlan, status: "cancel" });
          submittedServiceIdRef.current = null;
        }
      });
      if (attempts >= 80) {
        clearPaymentWatcher();
      }
    }, 3000);
  }, [clearDraft, clearPaymentWatcher, onPaymentResolved, onSubmitted, verifyPaymentStatus]);

  const handleResolvedPaymentResult = useCallback((
    result: "success" | "cancel" | "pending",
    serviceId: string,
    paidPlan: "featured" | "monthly",
  ) => {
    paymentResultReceivedRef.current = true;
    clearPaymentWatcher();
    setIsLoading(false);
    setStep("featured");
    setFeaturedTypeFocusKey((prev) => prev + 1);
    if (result === "success") {
      setPaymentUi({ status: "success", messageKey: "oferente_pago_completado" });
      clearDraft();
      onSubmitted?.({ serviceId, plan: paidPlan });
      submittedServiceIdRef.current = null;
      return;
    }
    if (result === "pending") {
      setPaymentUi({ status: "preparing", messageKey: "oferente_pago_verificando" });
      keepCheckingPendingPayment(serviceId, paidPlan);
      return;
    }
    setPaymentUi({ status: "cancel", messageKey: "oferente_pago_no_completado" });
    onPaymentResolved?.({ serviceId, plan: paidPlan, status: "cancel" });
    submittedServiceIdRef.current = null;
  }, [clearDraft, clearPaymentWatcher, keepCheckingPendingPayment, onPaymentResolved, onSubmitted]);

  useEffect(() => {
    const handlePaymentResult = async (rawStatus: string, payloadServiceId?: string) => {
      const paidPlan = selectedPlan === "monthly" ? "monthly" : "featured";
      const currentServiceId = String(payloadServiceId || submittedServiceIdRef.current || "").trim();
      if (!currentServiceId) {
        setIsLoading(false);
        setPaymentUi({ status: "cancel", messageKey: "oferente_pago_no_completado" });
        return;
      }
      paymentResultReceivedRef.current = true;
      clearPaymentWatcher();
      const normalizedFromPayload = normalizePaymentResult(rawStatus);
      const result = normalizedFromPayload === "pending"
        ? await verifyPaymentWithRetries(currentServiceId, "check")
        : await verifyPaymentWithRetries(currentServiceId, rawStatus);
      handleResolvedPaymentResult(result, currentServiceId, paidPlan);
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key !== "tg-featured-payment-result" || !event.newValue) return;
      try {
        const parsed = JSON.parse(event.newValue) as { status?: string; serviceId?: string };
        void handlePaymentResult(String(parsed?.status ?? ""), String(parsed?.serviceId ?? ""));
      } catch {}
    };

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; status?: string; serviceId?: string } | null;
      if (!data || data.type !== "tg-featured-payment-result") return;
      void handlePaymentResult(String(data.status ?? ""), String(data.serviceId ?? ""));
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("message", onMessage);
    return () => {
      clearPaymentWatcher();
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("message", onMessage);
    };
  }, [clearPaymentWatcher, handleResolvedPaymentResult, normalizePaymentResult, selectedPlan, verifyPaymentWithRetries]);

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

  const resolveCategoryRoot = useCallback((category: Category, byId: Map<string, Category>) => {
    let current: Category | undefined = category;
    let depth = 0;
    while (current?.parentId && depth < 10) {
      const parent = byId.get(current.parentId);
      if (!parent) break;
      current = parent;
      depth += 1;
    }
    return current ?? category;
  }, []);

  const byTaxonomy = useCallback((aliases: string[]) => {
    const wanted = aliases.map(normalize);
    const byId = new Map(categories.map((c) => [c.id, c]));
    return categories
      .filter((c) => wanted.includes(taxonomyFor(c, byId)))
      .map((c) => ({ value: c.description, label: c.description }))
      .filter((c) => c.value);
  }, [categories]);

  const categoriaOptionGroups = useMemo<SelectOptionGroup[]>(() => {
    const byId = new Map(categories.map((category) => [category.id, category]));
    const rootMap = new Map<string, SelectOptionGroup>();

    categories
      .filter((category) => {
        if (category.isPublicVisible === false) return false;
        if (normalize(taxonomyFor(category, byId)) !== "categoria") return false;
        const root = resolveCategoryRoot(category, byId);
        return (root.visibleInCard ?? root.isPrimaryCategory) === true && root.isPublicVisible !== false;
      })
      .forEach((category) => {
        const root = resolveCategoryRoot(category, byId);
        const rootKey = root.id || root.description;
        if (!rootMap.has(rootKey)) {
          rootMap.set(rootKey, {
            value: root.description,
            label: root.description,
            children: [],
          });
        }
        if (category.parentId) {
          rootMap.get(rootKey)?.children.push({
            value: category.description,
            label: category.description,
          });
        }
      });

    return Array.from(rootMap.values()).map((group) => ({
      ...group,
      children: uniqueOptions(group.children),
    }));
  }, [categories, resolveCategoryRoot]);

  const categoriaOptions = useMemo(
    () => uniqueOptions(
      categoriaOptionGroups.flatMap((group) => [
        { value: group.value, label: group.label },
        ...group.children.map((child) => ({
          value: child.value,
          label: `${group.label} / ${child.label}`,
        })),
      ])
    ),
    [categoriaOptionGroups]
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
  const typeOptions = useMemo(() => optionsByTaxonomy(["tipo", "tipos", "type", "types", "tipo perfil", "tipoperfil", "profile type", "profile_type"]), [optionsByTaxonomy]);

  const validateBasic = () => {
    if (!effectiveCountry) {
      setIsOpenModal?.(true);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("tg-open-country-modal"));
      }
      toast.error("Elegi tu pais de pasaporte para continuar.");
      return false;
    }
    if (emailError.length > 0) {
      toast.error(t("email_valido"));
      return false;
    }
    if (!profileName.trim()) {
      setIsEmptyProfileName(true);
      toast.error(mt("oferente_toast_nombre"));
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
    if (!destinationCountry.trim()) {
      toast.error(mt("oferente_toast_destino"));
      return false;
    }
    if (!languages.length) {
      toast.error(mt("oferente_toast_idioma"));
      return false;
    }
    if (!description.trim()) {
      toast.error(mt("oferente_toast_descripcion"));
      return false;
    }
    if (!website.trim()) {
      toast.error(mt("oferente_toast_web"));
      return false;
    }

    if (!acceptedTerms) {
      setIsEmptyTerms(true);
      toast.error(mt("oferente_toast_terminos"));
      return false;
    }
    setIsEmptyTerms(false);
    return true;
  };

  const validateFeatured = () => {
    if (!primaryVenue.country.trim()) {
      toast.error(mt("oferente_toast_sede"));
      return false;
    }
    return true;
  };

  const applyPromoCode = async () => {
    const code = promoCode.trim();
    if (!code) {
      setPromoValidation((prev) => ({ ...prev, applied: false, message: mt("oferente_promo_empty_code"), error: true }));
      return false;
    }
    try {
      const response = await fetch("/api/promo-codes/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, planAmount: effectivePlanPricing.amount, isIntermediario }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) {
        setPromoValidation((prev) => ({
          ...prev,
          applied: false,
          code: "",
          discountPercent: 0,
          discountedAmount: effectivePlanPricing.amount > 0 ? effectivePlanPricing.amount : null,
          message: mt(promoMessageKey(data)),
          error: true,
        }));
        return false;
      }
      const discountPercent = Number(data?.promo?.discountPercent ?? 0);
      const discountedAmount = data?.pricing?.discountedAmount === null || data?.pricing?.discountedAmount === undefined
        ? effectivePlanPricing.amount
        : Number(data.pricing.discountedAmount);
      setPromoValidation({
        applied: true,
        code: String(data?.promo?.code ?? code).toUpperCase(),
        discountPercent,
        originalAmount: effectivePlanPricing.amount > 0 ? effectivePlanPricing.amount : null,
        discountedAmount: Number.isFinite(discountedAmount) ? discountedAmount : effectivePlanPricing.amount,
        message: fillText("oferente_promo_applied", { discount: String(discountPercent) }),
        error: false,
      });
      setPromoCode(String(data?.promo?.code ?? code).toUpperCase());
      return true;
    } catch {
      setPromoValidation((prev) => ({ ...prev, applied: false, message: mt("oferente_promo_validate_error"), error: true }));
      return false;
    }
  };

  const buildPayload = (publicationPlan: "basic_free" | "featured" | "monthly") => {
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
    const currentPlanPricing = publicationPlan === "monthly" ? monthlyPlanPricing : featured120PlanPricing;
    const effectivePlanAmount = currentPlanPricing.amount > 0 ? currentPlanPricing.amount : 0;
    const discountedPlanAmount = promoValidation.applied && !promoValidation.error && promoValidation.discountedAmount !== null
      ? Number(promoValidation.discountedAmount)
      : effectivePlanAmount;
    const isPaidPlan = publicationPlan === "featured" || publicationPlan === "monthly";
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
      planAmount: isPaidPlan ? effectivePlanAmount : 0,
      planCurrency: isPaidPlan ? currentPlanPricing.currency : "USD",
      discountedPlanAmount: isPaidPlan ? discountedPlanAmount : 0,
      paymentType: publicationPlan === "monthly" ? "monthly" : publicationPlan === "featured" ? "one_time" : "",
      planType: publicationPlan === "monthly" ? "featured_monthly" : publicationPlan === "featured" ? "featured_120d" : "",
      requestKind,
      previousPlan: previousPlan ?? "",
      requestedPlan: publicationPlan === "monthly" ? "featured_monthly" : publicationPlan === "featured" ? "featured_120d" : "basic_free",
      sourceServiceId: sourceServiceId.trim(),
      sourcePublicationId: sourcePublicationId.trim(),
      country: effectiveCountry,
      locale,
      acceptedTerms: true,
      submittedViaPortal: Boolean(initialEmail.trim()),
      portalOwnerEmail: initialEmail.trim().toLowerCase(),
      turnstileToken,
    };
  };

  const submit = async (publicationPlan: "basic_free" | "featured" | "monthly") => {
    if (isLoading) return;
    if (!validateBasic()) return;
    const isPaidPlan = publicationPlan === "featured" || publicationPlan === "monthly";
    if (isPaidPlan && !validateFeatured()) return;
    if (!turnstileToken) {
      toast.error(mt("oferente_turnstile_required"));
      return;
    }
    const isPublicationChangeRequest = publicationChangeMode || requestKind === "edit_publication";
    const isResumePaidWithoutNewCharge = isPaidPlan && (canReuseCompletedPayment || isPublicationChangeRequest);

    let preparedPaymentTab: Window | null = null;
    let keepPaymentLoading = false;
    if (isPaidPlan && !isResumePaidWithoutNewCharge) {
      setPaymentUi({ status: "preparing", messageKey: "oferente_pago_preparando" });
      const pendingServiceId = String((resumeMode ? resumeSubmissionId : submittedServiceIdRef.current) || "pending").trim() || "pending";
      const preparingUrl = `${window.location.origin}/featured-payment-launch?serviceId=${encodeURIComponent(pendingServiceId)}&locale=${encodeURIComponent(locale)}&state=preparing`;
      preparedPaymentTab = window.open(preparingUrl, "_blank");
      if (!preparedPaymentTab) {
        setPaymentUi({ status: "error", messageKey: "oferente_pago_popup_error" });
        return;
      }
      setIsLoading(true);
    } else {
      setPaymentUi({ status: "idle" });
    }

    if (isPaidPlan && !isResumePaidWithoutNewCharge && promoCode.trim()) {
      const valid = await applyPromoCode();
      if (!valid) {
        try {
          preparedPaymentTab?.close();
        } catch {}
        setPaymentUi({ status: "idle" });
        setIsLoading(false);
        return;
      }
    }
    setIsLoading(true);
    try {
      if (resumeMode && !String(resumeSubmissionId || "").trim()) {
        throw new Error(t("enlace_reanudacion_invalido"));
      }
      const endpoint = resumeMode
        ? `/api/provider-portal/submissions/${encodeURIComponent(String(resumeSubmissionId || "").trim())}`
        : isPublicationChangeRequest && sourcePublicationId.trim()
          ? `/api/provider-portal/publications/${encodeURIComponent(sourcePublicationId.trim())}/change-request`
        : "/api/travel-services";
      const response = await fetch(endpoint, {
        method: resumeMode ? "PUT" : "POST",
        credentials: resumeMode || isPublicationChangeRequest ? "include" : undefined,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(publicationPlan)),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (isPaidPlan && (data?.errorCode || data?.reason)) {
          setPromoValidation((prev) => ({
            ...prev,
            applied: false,
            code: "",
            discountPercent: 0,
            discountedAmount: effectivePlanPricing.amount > 0 ? effectivePlanPricing.amount : null,
            message: mt(promoMessageKey(data)),
            error: true,
          }));
          try {
            preparedPaymentTab?.close();
          } catch {}
          setPaymentUi({ status: "idle" });
          return;
        }
        throw new Error(String(data?.details ?? data?.error ?? "") || (isPublicationChangeRequest ? mt("oferente_toast_cambios_error") : t("error_form")));
      }
      const serviceId = String(data?.item?.id ?? data?.id ?? resumeSubmissionId ?? "").trim();
      submittedServiceIdRef.current = serviceId;
      if (publicationPlan === "basic_free" || isResumePaidWithoutNewCharge) {
        clearDraft();
        toast.success(
          isPublicationChangeRequest
            ? mt("oferente_toast_cambios_enviados")
            : resumeMode
              ? t("solicitud_reenviada")
              : mt("oferente_toast_nueva_publicacion"),
          { duration: 7000 },
        );
        onSubmitted?.({ serviceId, plan: publicationPlan });
        submittedServiceIdRef.current = null;
        setTurnstileToken("");
        setTurnstileResetKey((value) => value + 1);
        setIsLoading(false);
        return;
      }

      if (isPaidPlan) {
        const paidPayload = buildPayload(publicationPlan);
        const checkoutResponse = await fetch("/api/payments/featured/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            serviceId,
            country: effectiveCountry,
            amount: paidPayload.discountedPlanAmount,
            currency: paidPayload.planCurrency,
            promoCode,
            email,
            paymentType: publicationPlan === "monthly" ? "monthly" : "one_time",
            planType: publicationPlan === "monthly" ? "featured_monthly" : "featured_120d",
            locale,
          }),
        });
        const checkoutData = await checkoutResponse.json().catch(() => ({}));
        if (!checkoutResponse.ok || !checkoutData?.redirectUrl) {
          throw new Error(String(checkoutData?.error ?? "payment_checkout_failed"));
        }
        const redirectUrl = String(checkoutData.redirectUrl);
        const launchUrl = `${window.location.origin}/featured-payment-launch?serviceId=${encodeURIComponent(serviceId)}&locale=${encodeURIComponent(locale)}&redirect=${encodeURIComponent(btoa(redirectUrl))}&state=connecting`;
        const paymentTab = preparedPaymentTab ?? window.open(launchUrl, "_blank");
        if (!paymentTab) {
          if (submittedServiceIdRef.current) {
            void fetch("/api/payments/featured/return", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ serviceId: submittedServiceIdRef.current, status: "cancel" }),
            }).catch(() => null);
            submittedServiceIdRef.current = null;
          }
          setPaymentUi({ status: "error", messageKey: "oferente_pago_popup_error" });
          return;
        }
        try {
          paymentTab.location.replace(launchUrl);
        } catch {
          if (submittedServiceIdRef.current) {
            void fetch("/api/payments/featured/return", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ serviceId: submittedServiceIdRef.current, status: "cancel" }),
            }).catch(() => null);
            submittedServiceIdRef.current = null;
          }
          try {
            paymentTab.close();
          } catch {}
          setPaymentUi({ status: "error", messageKey: "oferente_pago_popup_error" });
          return;
        }
        paymentResultReceivedRef.current = false;
        paymentTabRef.current = paymentTab;
        setPaymentUi({ status: "redirected", messageKey: "oferente_pago_redirigiendo" });
        if (paymentWatcherRef.current !== null) {
          window.clearInterval(paymentWatcherRef.current);
        }
        paymentWatcherRef.current = window.setInterval(() => {
          const opened = paymentTabRef.current;
          if (!opened) return;
          if (opened.closed) {
            if (paymentWatcherRef.current !== null) {
              window.clearInterval(paymentWatcherRef.current);
              paymentWatcherRef.current = null;
            }
            if (!paymentResultReceivedRef.current) {
              const currentServiceId = submittedServiceIdRef.current;
              if (currentServiceId) {
                void verifyPaymentWithRetries(currentServiceId, "check").then((result) => {
                  handleResolvedPaymentResult(result, currentServiceId, publicationPlan === "monthly" ? "monthly" : "featured");
                });
              }
            }
          }
        }, 700);
        setStep("featured");
        keepPaymentLoading = true;
        return;
      }
      clearDraft();
      toast.success(mt("oferente_toast_revision"), { duration: 6000 });
      onClose();
    } catch (error) {
      try {
        preparedPaymentTab?.close();
      } catch {}
      if (isPaidPlan) {
        const detail = error instanceof Error && error.message && error.message !== "payment_checkout_failed"
          ? error.message
          : undefined;
        setPaymentUi({ status: "error", messageKey: "oferente_pago_error", detail });
      } else {
        toast.error(error instanceof Error && error.message ? error.message : (isPublicationChangeRequest ? mt("oferente_toast_cambios_error") : t("error_form")));
      }
    } finally {
      if (!keepPaymentLoading) setIsLoading(false);
    }
  };

  const goPaid = async (plan: "featured" | "monthly", planType: "featured_120d" | "featured_monthly") => {
    if (isLoading) return;
    if (!validateBasic()) return;
    if (!turnstileToken) {
      toast.error(mt("oferente_turnstile_required"));
      return;
    }
    setPaymentUi({ status: "idle" });
    setSelectedPlan(plan);
    setSelectedPaidPlanType(planType);
    if (promoCode.trim()) {
      const valid = await applyPromoCode();
      if (!valid) return;
    }
    setStep("featured");
    setFeaturedTypeFocusKey((prev) => prev + 1);
  };

  useEffect(() => {
    setSelectedPlan(initialPlan);
  }, [initialPlan]);

  useEffect(() => {
    setSelectedPaidPlanType(preferredPaidPlanType);
  }, [preferredPaidPlanType]);

  const paidPlanTitle = selectedPlan === "monthly"
    ? (locale === "en" ? "Monthly plan" : locale === "pt" ? "Plano mensal" : locale === "it" ? "Piano mensile" : "Plan mensual")
    : mt("oferente_publicacion_destacada");
  const aiFieldTarget: AiFieldTarget = step === "featured" ? "included" : "description";
  const isPublicationChangeRequestMode = publicationChangeMode || requestKind === "edit_publication";
  const resumeSubmitLabel = locale === "en"
    ? "Update publication"
    : locale === "pt"
      ? "Atualizar publicação"
      : locale === "it"
        ? "Aggiorna pubblicazione"
        : "Actualizar publicación";
  const basicSubmitLabel = isPublicationChangeRequestMode
    ? mt("oferente_solicitar_cambios")
    : resumeMode
      ? resumeSubmitLabel
      : mt("oferente_publicar_gratis");
  const monthlyContinueLabel = locale === "en" ? "Continue monthly" : locale === "pt" ? "Continuar mensal" : locale === "it" ? "Continua mensile" : "Continuar mensual";
  const monthlySubmitLabel = locale === "en" ? "Subscribe monthly" : locale === "pt" ? "Assinar mensal" : locale === "it" ? "Attiva piano mensile" : "Contratar mensual";
  const visiblePlanSet = new Set(visiblePlans);
  const hasMonthlyPlanVisible = showMonthlyPlanOption && visiblePlanSet.has("monthly");
  const visiblePlanCount =
    (visiblePlanSet.has("basic_free") ? 1 : 0) +
    (visiblePlanSet.has("featured") ? 1 : 0) +
    (hasMonthlyPlanVisible ? 1 : 0);
  const useCompactPlanCards =
    compactPlanCards &&
    visiblePlanSet.has("basic_free") &&
    visiblePlanSet.has("featured") &&
    !hasMonthlyPlanVisible;
  const useSinglePlanCard = visiblePlanCount === 1;
  const useCompactPlanCardSize = useCompactPlanCards || useSinglePlanCard;
  const planCardsGridClass = useCompactPlanCards
    ? "max-w-[38rem] md:grid-cols-2"
    : useSinglePlanCard
      ? "max-w-[21rem] md:grid-cols-1"
      : `max-w-[920px] xl:gap-5 ${visiblePlanCount >= 3 ? "lg:grid-cols-3" : visiblePlanCount === 2 ? "md:grid-cols-2" : "md:grid-cols-1"}`;

  useEffect(() => {
    if (step !== "featured") return;
    const frame = window.requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>("[data-featured-type='1'] select, [data-featured-type='1'] button");
      el?.focus();
      modalBodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [step, featuredTypeFocusKey]);

  const handleProviderLogoUpload = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(mt("oferente_toast_imagen_valida"));
      return;
    }
    try {
      const optimized = await fileToCompressedImageAsset(file);
      setProviderLogo(optimized.url);
      setProviderLogoAsset(optimized);
      setProviderLogoName(file.name.replace(/\.[^.]+$/, ".webp"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : mt("oferente_toast_comprimir_imagenes"));
    }
  };

  const handleServiceImagesUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    const remaining = Math.max(0, 5 - serviceImages.length);
    const fileList = Array.from(files);
    if (!remaining || fileList.length > remaining) {
      toast.error(mt("oferente_toast_imagen_limite").replace("{remaining}", String(remaining)));
      return;
    }
    if (fileList.some((file) => !file.type.startsWith("image/"))) {
      toast.error(mt("oferente_toast_imagen_tipo"));
      return;
    }
    try {
      const encoded = await Promise.all(fileList.map(fileToCompressedImageAsset));
      setServiceImages((prev) => [...prev, ...encoded.map((asset) => asset.url)]);
      setServiceImageAssets((prev) => [...prev, ...encoded]);
      setServiceImageNames((prev) => [...prev, ...fileList.map((file) => file.name.replace(/\.[^.]+$/, ".webp"))]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : mt("oferente_toast_comprimir_imagenes"));
    }
  };

  if (!mounted) return null;
  const isPaymentBusy = paymentUi.status === "preparing" || paymentUi.status === "redirected";

  const basicStep = (
    <>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="relative w-full">
          <Tag className="pointer-events-none absolute left-4 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-[#0B8FA3]" />
          <input
            value={profileName}
            onChange={(e) => setProfileName(e.target.value)}
            title={mt("oferente_nombre_perfil")}
            className="w-full rounded-2xl bg-white p-4 pb-5 pl-12 pt-5 text-black outline-none transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl focus:scale-[1.01]"
            style={{
              boxShadow: isEmptyProfileName
                ? "0 8px 25px -8px rgba(220, 38, 38, 0.4), 0 4px 12px -4px rgba(220, 38, 38, 0.2)"
                : "0 12px 36px -18px rgba(8, 217, 189, 0.55), 0 6px 18px -9px rgba(4, 181, 189, 0.35)",
            }}
            placeholder={mt("oferente_nombre_perfil")}
          />
        </div>
        <div style={{ position: "relative", zIndex: 9999998 }}>
          <MultiOptionSelect
            selectedValues={proposalCategories}
            setSelectedValues={setProposalCategories}
            options={categoriaOptions}
            optionGroups={categoriaOptionGroups}
            placeholder={mt("oferente_categoria_placeholder")}
            icon="tag"
            isEmpty={isEmptyProposalCategory}
            emptyText={mt("oferente_sin_opciones")}
            maxSelections={MAX_PROVIDER_CATEGORIES}
            onLimitReached={() => toast.error(mt("oferente_toast_categoria_limite"))}
          />
        </div>
      </div>

      <div className="rounded-2xl bg-white/60 p-4 shadow-inner">
        <p className="text-black text-md text-center">*{t("como_actuas")}</p>
        <div className="mt-4 flex flex-col items-start justify-start space-y-4 w-full lg:px-4">
          <RoundedCheckbox id="ofrezco" checked={isOfrezco} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setIsOfrezco(e.target.checked); setIsIntermediario(false); }} label={t("ofrezco_directamente")} />
          <div className="ml-5 md:-ml-0">
            <RoundedCheckbox id="intermediario" checked={isIntermediario} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setIsIntermediario(e.target.checked); setIsOfrezco(false); }} label={t("intermediario")} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div style={{ position: "relative", zIndex: 9999997, isolation: "isolate" }}>
          <DestinationSelect destinationCountry={destinationCountry} setDestinationCountry={setDestinationCountry} label={mt("oferente_destino_label")} customClass="mb-0" isInModal textBuscarPais={t("buscar_pais")} noHayPaises={t("no_hay_paises")} allowedCountries={destinationAvailabilityMode === "some" ? destinationAvailabilityCountries : []} />
        </div>
        <div style={{ position: "relative", zIndex: 9999996 }}>
          <MultiOptionSelect selectedValues={languages} setSelectedValues={setLanguages} options={languageOptions} placeholder={mt("oferente_idiomas_placeholder")} emptyText={mt("oferente_sin_opciones")} />
        </div>
      </div>

      <div className="space-y-4">
        <MaterialTextarea value={description} setValue={setDescription} isContanos placeholder={t("contanos")} textCharsRestantes={t("caracteres_restantes")} textPerfecto={t("perfecto")} />
        <MaterialTextarea value={website} setValue={setWebsite} placeholder={t("web")} isWeb textCharsRestantes={t("caracteres_restantes")} textPerfecto={t("perfecto")} />
      </div>

      <div>
        <MaterialInputs required disabled={lockEmail} label={mt("oferente_email_label")} value={email} setValue={setEmail} isEmpty={isEmptyEmail} setEmailError={setEmailError} emailError={emailError} textPorfavor={t("por_favor")} textCampoRequerido={t("campo_requerido")} />
      </div>

      <label className={`flex items-center gap-3 rounded-xl bg-white/80 p-3 text-sm shadow-sm ${isEmptyTerms ? "text-red-600 ring-1 ring-red-300" : "text-[#273166]"}`}>
        <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} className="h-4 w-4 rounded border-gray-300 accent-[#00A9C6]" />
        <Link href="/term-condicion" target="_blank" className="font-medium underline decoration-[#00A9C6]/50 underline-offset-4 hover:text-[#00A9C6]" onClick={(event) => event.stopPropagation()}>
          {mt("oferente_aceptar_terminos")}
        </Link>
      </label>

      <TurnstileWidget
        resetKey={turnstileResetKey}
        onTokenChange={setTurnstileToken}
        className="rounded-2xl border border-[#BFEAF3] bg-white/80 p-2 shadow-sm"
      />

      <div className={`mx-auto grid w-full gap-4 ${planCardsGridClass}`}>
        {visiblePlanSet.has("basic_free") ? (
          <PlanCard
            title={mt("oferente_publicacion_basica")}
            tone="free"
            price="$ 0"
            items={basicItems}
            buttonLabel={isLoading ? t("guardando") : basicSubmitLabel}
            onClick={() => submit("basic_free")}
            disabled={isLoading || isPaymentBusy || !turnstileToken}
            promoPlaceholder={mt("oferente_codigo_promocional")}
            compact={useCompactPlanCardSize}
          />
        ) : null}
        {visiblePlanSet.has("featured") ? (
          <PlanCard
            title={mt("oferente_publicacion_destacada")}
            tone="featured"
            price={featured120PriceBreakdown.finalLabel}
            basePrice={featured120PriceBreakdown.baseLabel}
            showStrikethroughPrice={featured120PriceBreakdown.showStrikethrough}
            priceCaption={`Moneda: ${featured120PlanPricing.currency}`}
            items={featuredItems}
            buttonLabel={mt("oferente_continuar_destacado")}
            onClick={() => { void goPaid("featured", "featured_120d"); }}
            disabled={isLoading || isPaymentBusy || !turnstileToken}
            showPromo
            promoCode={promoCode}
            onPromoCodeChange={setPromoCode}
            onApplyPromo={() => { void applyPromoCode(); }}
            promoPlaceholder={mt("oferente_codigo_promocional")}
            promoApplyLabel={mt("oferente_promo_aplicar")}
            promoDisabled={isLoading || isPaymentBusy}
            promoStatusText={promoValidation.message}
            promoStatusError={promoValidation.error}
            compact={useCompactPlanCardSize}
          />
        ) : null}
        {showMonthlyPlanOption && visiblePlanSet.has("monthly") ? (
          <PlanCard
            title={locale === "en" ? "Monthly plan" : locale === "pt" ? "Plano mensal" : locale === "it" ? "Piano mensile" : "Plan mensual"}
            tone="featured"
            price={monthlyPriceBreakdown.finalLabel}
            basePrice={monthlyPriceBreakdown.baseLabel}
            showStrikethroughPrice={monthlyPriceBreakdown.showStrikethrough}
            priceCaption={`Moneda: ${monthlyPlanPricing.currency}`}
            items={featuredItems}
            buttonLabel={monthlyContinueLabel}
            onClick={() => { void goPaid("monthly", "featured_monthly"); }}
            disabled={isLoading || isPaymentBusy || !turnstileToken}
            showPromo
            promoCode={promoCode}
            onPromoCodeChange={setPromoCode}
            onApplyPromo={() => { void applyPromoCode(); }}
            promoPlaceholder={mt("oferente_codigo_promocional")}
            promoApplyLabel={mt("oferente_promo_aplicar")}
            promoDisabled={isLoading || isPaymentBusy}
            promoStatusText={promoValidation.message}
            promoStatusError={promoValidation.error}
            compact={useCompactPlanCardSize}
          />
        ) : null}
      </div>
    </>
  );

  const featuredStep = (
    <>
      <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900">
        {mt("oferente_destacado_intro")}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-white p-4 shadow-[0_12px_36px_rgba(8,217,189,0.12)]">
          <label className="text-sm font-semibold text-[#273166]">{mt("oferente_logo_label")}</label>
          <div className="mt-3 flex items-center gap-3">
            <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl border border-[#BFEAF3] bg-[#F4FCFD]">
              {providerLogo ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={providerLogo} alt={mt("oferente_logo_label")} className="h-full w-full object-cover" />
                </>
              ) : <Upload className="h-7 w-7 text-[#0B8FA3]" />}
            </div>
            <div className="min-w-0 flex-1">
              <input id="provider-logo-upload" type="file" accept="image/*" onChange={(event) => handleProviderLogoUpload(event.target.files?.[0] ?? null)} className="sr-only" />
              <label htmlFor="provider-logo-upload" className="inline-flex cursor-pointer items-center rounded-xl bg-[#EAF9FB] px-4 py-2 text-sm font-bold text-[#007D92] transition hover:bg-[#D8F3F0]">
                {mt("oferente_seleccionar_imagen")}
              </label>
              <p className="mt-2 truncate text-xs text-slate-500">{providerLogoName || mt("oferente_ninguna_imagen")}</p>
            </div>
          </div>
        </div>
        <div data-featured-type="1" key={featuredTypeFocusKey} style={{ position: "relative", zIndex: 9999995 }}>
          <SingleOptionSelect selectedValue={providerType} setSelectedValue={setProviderType} options={typeOptions} placeholder={mt("oferente_tipo_perfil")} emptyText={mt("oferente_sin_opciones")} />
        </div>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-[0_12px_36px_rgba(8,217,189,0.12)]">
        <div className="mb-3 text-sm font-semibold text-[#273166]">{mt("oferente_sede")}</div>
        <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-3">
          <div style={{ position: "relative", zIndex: 9999995 }}>
            <label className="mb-1 block text-sm font-medium text-slate-700">{mt("oferente_pais_sede")}</label>
            <DestinationSelect
              destinationCountry={primaryVenue.country}
              setDestinationCountry={(country) => {
                const nextCountry = String(country ?? "").trim();
                if (autoFilledVenueCountryRef.current && normalize(nextCountry) !== normalize(autoFilledVenueCountryRef.current)) {
                  autoFilledVenueCountryRef.current = "";
                }
                setPrimaryVenue((prev) => ({ ...prev, country: nextCountry }));
              }}
              label={mt("oferente_pais_sede")}
              customClass="mb-0"
              isInModal
              textBuscarPais={t("buscar_pais")}
              noHayPaises={t("no_hay_paises")}
            />
          </div>
          <div className="rounded-2xl bg-white p-3 shadow-[0_12px_36px_-18px_rgba(8,217,189,0.55),0_6px_18px_-9px_rgba(4,181,189,0.35)]">
            <input value={primaryVenue.city} onChange={(event) => setPrimaryVenue((prev) => ({ ...prev, city: event.target.value }))} list="provider-venue-city-suggestions" autoComplete="address-level2" title={`${mt("oferente_ciudad_sede")} (${mt("oferente_opcional")})`} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-[#00A9C6]/30 dark:bg-white dark:text-slate-900" style={{ colorScheme: "light" }} placeholder={`${mt("oferente_ciudad_sede")} (${mt("oferente_opcional")})`} />
            {venueCitySuggestions.length ? (
              <datalist id="provider-venue-city-suggestions">
                {venueCitySuggestions.map((city) => (
                  <option key={city} value={city} />
                ))}
              </datalist>
            ) : null}
          </div>
          <div className="rounded-2xl bg-white p-3 shadow-[0_12px_36px_-18px_rgba(8,217,189,0.55),0_6px_18px_-9px_rgba(4,181,189,0.35)]">
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-4 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-[#0B8FA3]" />
              <input value={primaryVenue.mapUrl} onChange={(event) => setPrimaryVenue((prev) => ({ ...prev, mapUrl: event.target.value }))} title={`${mt("oferente_url_maps")} (${mt("oferente_opcional")})`} className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-[#00A9C6]/30 dark:bg-white dark:text-slate-900" style={{ colorScheme: "light" }} placeholder={`${mt("oferente_url_maps")} (${mt("oferente_opcional")})`} />
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">{mt("oferente_sede_helper")}</p>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-[0_12px_36px_rgba(8,217,189,0.12)]">
        <div className="flex items-center justify-between gap-3">
          <label className="text-sm font-semibold text-[#273166]">{mt("oferente_imagenes_servicio")}</label>
          <span className="text-xs text-slate-500">{serviceImages.length}/5</span>
        </div>
        <input id="service-images-upload" type="file" accept="image/*" multiple onChange={(event) => { handleServiceImagesUpload(event.target.files); event.currentTarget.value = ""; }} className="sr-only" />
        <label htmlFor="service-images-upload" className="mt-3 inline-flex cursor-pointer items-center rounded-xl bg-[#EAF9FB] px-4 py-2 text-sm font-bold text-[#007D92] transition hover:bg-[#D8F3F0]">
          {mt("oferente_elegir_imagenes")}
        </label>
        <p className="mt-2 text-xs text-slate-500">{mt("oferente_limite_imagenes")}</p>
        {serviceImages.length ? (
          <div className="mt-3 grid grid-cols-3 gap-2 md:grid-cols-5">
            {serviceImages.map((image, index) => (
              <button key={`${index}-${image.slice(0, 20)}`} type="button" onClick={() => { setServiceImages((prev) => prev.filter((_, idx) => idx !== index)); setServiceImageAssets((prev) => prev.filter((_, idx) => idx !== index)); setServiceImageNames((prev) => prev.filter((_, idx) => idx !== index)); }} className="group relative h-20 overflow-hidden rounded-xl border border-slate-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt={`${mt("oferente_servicio_alt")} ${index + 1}`} className="h-full w-full object-cover" />
                <span className="absolute inset-0 hidden place-items-center bg-black/50 text-xs font-semibold text-white group-hover:grid">{mt("oferente_quitar")}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-2 text-sm text-slate-500"><ImagePlus className="h-4 w-4" /> {mt("oferente_sin_imagenes")}</div>
        )}
        {serviceImageNames.length ? <p className="mt-2 text-xs text-slate-500">{serviceImageNames.join(", ")}</p> : null}
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-[0_12px_36px_rgba(8,217,189,0.12)]">
        <CountryMultiSelect
          label={mt("oferente_pasaportes_label")}
          selected={passportCountries}
          onChange={setPassportCountries}
          placeholder={mt("oferente_pasaportes_placeholder")}
        />
        <p className="mt-2 text-xs text-slate-500">{mt("oferente_pasaportes_helper")}</p>
      </div>

      <div className="space-y-4">
        <MaterialTextarea value={included} setValue={setIncluded} placeholder={mt("oferente_incluye_placeholder")} textCharsRestantes={t("caracteres_restantes")} textPerfecto={t("perfecto")} />
        <MaterialTextarea value={notIncluded} setValue={setNotIncluded} placeholder={mt("oferente_no_incluye_placeholder")} textCharsRestantes={t("caracteres_restantes")} textPerfecto={t("perfecto")} />
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-[0_12px_36px_rgba(8,217,189,0.12)]">
        <div className="mb-3 flex items-center justify-between">
          <label className="text-sm font-semibold text-[#273166]">{mt("oferente_links_contacto")}</label>
          <button type="button" onClick={() => setContactLinks((prev) => [...prev, { kind: "web", url: "", label: "" }])} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">{mt("oferente_anadir_link")}</button>
        </div>
        <div className="space-y-2">
          {contactLinks.map((entry, index) => (
            <div key={`contact-${index}`} className="grid grid-cols-1 gap-2 md:grid-cols-[140px_1fr_auto]">
              <select value={entry.kind} onChange={(event) => setContactLinks((prev) => prev.map((item, idx) => idx === index ? { ...item, kind: event.target.value as ContactKind } : item))} className="h-11 rounded-xl border border-slate-200 bg-white px-2 text-sm outline-none focus:ring-2 focus:ring-[#00A9C6]/30">
                <option value="web">Web</option><option value="email">Email</option><option value="youtube">YouTube</option><option value="instagram">Instagram</option><option value="facebook">Facebook</option><option value="whatsapp">WhatsApp</option><option value="cellphone">{mt("oferente_contact_cellphone")}</option><option value="linkedin">LinkedIn</option><option value="other">{mt("oferente_contact_other")}</option>
              </select>
              <div className="relative">
                <LinkIcon className="pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[#0B8FA3]" />
                <input value={entry.url} onChange={(event) => setContactLinks((prev) => prev.map((item, idx) => idx === index ? { ...item, url: event.target.value } : item))} title={mt("oferente_link_email_placeholder")} className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#00A9C6]/30" placeholder={mt("oferente_link_email_placeholder")} />
              </div>
              <button type="button" onClick={() => setContactLinks((prev) => prev.length > 1 ? prev.filter((_, idx) => idx !== index) : prev)} disabled={contactLinks.length <= 1} className="rounded-xl border border-slate-200 px-3 text-xs text-slate-600 disabled:opacity-40">{mt("oferente_quitar")}</button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-[0_12px_36px_rgba(8,217,189,0.12)]">
        <div className="mb-3 flex items-center justify-between gap-3">
          <label className="text-sm font-semibold text-[#273166]">{mt("oferente_precio_moneda")}</label>
          <button type="button" onClick={() => setPriceEntries((prev) => [...prev, { currency: "", amount: "" }])} disabled={priceNegotiable} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{mt("oferente_agregar_moneda")}</button>
        </div>
        <div className="space-y-2">
          {priceEntries.map((entry, index) => (
            <div key={`price-entry-${index}`} className="grid grid-cols-[110px_1fr_auto] gap-2">
              <select value={entry.currency} onChange={(event) => setPriceEntries((prev) => prev.map((item, idx) => idx === index ? { ...item, currency: event.target.value } : item))} disabled={priceNegotiable} className="h-11 rounded-xl border border-slate-200 bg-white px-2 text-sm outline-none focus:ring-2 focus:ring-[#00A9C6]/30 disabled:bg-slate-100">
                <option value="">{mt("oferente_moneda")}</option>
                {CURRENCY_OPTIONS.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
              </select>
              <input value={entry.amount} onChange={(event) => setPriceEntries((prev) => prev.map((item, idx) => idx === index ? { ...item, amount: event.target.value } : item))} disabled={priceNegotiable} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#00A9C6]/30 disabled:bg-slate-100" placeholder={mt("oferente_monto")} />
              <button type="button" onClick={() => setPriceEntries((prev) => prev.length > 1 ? prev.filter((_, idx) => idx !== index) : prev)} disabled={priceNegotiable || priceEntries.length <= 1} className="rounded-xl border border-slate-200 px-3 text-xs text-slate-600 disabled:opacity-40">{mt("oferente_quitar")}</button>
            </div>
          ))}
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={priceNegotiable} onChange={(event) => setPriceNegotiable(event.target.checked)} className="h-4 w-4 accent-[#00A9C6]" /> {mt("oferente_a_convenir")}</label>
        <div className="mt-3">
          <label className="mb-1 block text-sm font-medium text-slate-700">{mt("oferente_periodo_precio")}</label>
          <select value={pricePeriod} onChange={(event) => setPricePeriod(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#00A9C6]/30">
            <option value="month">{mt("oferente_periodo_mes")}</option><option value="week">{mt("oferente_periodo_semana")}</option><option value="day">{mt("oferente_periodo_dia")}</option><option value="year">{mt("oferente_periodo_anio")}</option><option value="once">{mt("oferente_periodo_unico")}</option>
          </select>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[21rem]">
        <PlanCard
          title={paidPlanTitle}
          tone="featured"
          price={featuredPriceBreakdown.finalLabel}
          basePrice={featuredPriceBreakdown.baseLabel}
          showStrikethroughPrice={featuredPriceBreakdown.showStrikethrough}
          priceCaption={`Moneda: ${effectivePlanPricing.currency}`}
          items={featuredItems}
          buttonLabel={isLoading ? t("guardando") : (isPublicationChangeRequestMode ? mt("oferente_solicitar_cambios") : resumeMode ? resumeSubmitLabel : (selectedPlan === "monthly" ? monthlySubmitLabel : mt("oferente_publicar_destacado")))}
          onClick={() => submit(selectedPlan === "monthly" ? "monthly" : "featured")}
          disabled={isLoading || isPaymentBusy || !turnstileToken}
          showPromo
          promoCode={promoCode}
          onPromoCodeChange={setPromoCode}
          onApplyPromo={() => { void applyPromoCode(); }}
          promoPlaceholder={mt("oferente_codigo_promocional")}
          promoApplyLabel={mt("oferente_promo_aplicar")}
          promoDisabled={isLoading || isPaymentBusy}
          promoStatusText={promoValidation.message}
          promoStatusError={promoValidation.error}
          compact
        />
      </div>
    </>
  );

  const modalContent = (
    <>
      <div className="fixed inset-0 bg-black/60" style={{ zIndex: 400 }} onClick={isPaymentBusy ? undefined : onClose} />
      <div className="fixed inset-0 flex items-start justify-center p-3 pt-2 sm:p-4 sm:pt-6" style={{ zIndex: 410, pointerEvents: "none" }}>
        <div
          className="relative flex max-h-[90vh] w-full max-w-[42rem] flex-col overflow-hidden rounded-[1.7rem] bg-white shadow-2xl"
          style={{ pointerEvents: "auto", zIndex: 1000000, isolation: "isolate" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex-shrink-0 p-6 pb-4 border-b border-gray-100 bg-white">
            <div className="flex flex-row items-start justify-between">
              <Image src="/logo-degrade.png" width={200} height={200} className="object-cover w-[10rem] h-[5rem] mb-4" alt="logo degrade" />
              <div className="flex items-center gap-2">
                {step === "featured" ? (
                  <button type="button" onClick={() => setStep("basic")} disabled={isPaymentBusy} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
                    {mt("oferente_volver_atras")}
                  </button>
                ) : null}
                <button onClick={onClose} disabled={isPaymentBusy} className="p-2 hover:bg-gray-100 rounded-full transition-colors duration-200 flex-shrink-0 disabled:cursor-not-allowed disabled:opacity-50">
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
          </div>

          <div ref={modalBodyRef} className="flex-1 overflow-y-auto bg-gradient-to-b from-[#F5FBFB] via-[#EEEEEE] to-[#F8FAFC] p-5 sm:p-6 space-y-6">
            <div className="flex items-center justify-center flex-col text-center">
              <h1 style={{ color: "#273166" }} className="text-xl font-semibold leading-tight text-gray-800 md:text-2xl">{t("conecta_con_viajeros")}</h1>
              <h2 className="mt-2" style={{ color: "#323232" }}>{step === "featured" ? mt("oferente_destacado_heading") : t("cambiamos_la_manera")}</h2>
            </div>
            <PaymentStatusPanel state={paymentUi} text={mt} />
            {resumeMode ? (
              <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-950">
                <div className="font-semibold">{t("reanudar_solicitud")}</div>
                <div className="mt-1">{t("si_ya_pagaste_no_pagas_de_nuevo")}</div>
                {resumeStatusReason ? (
                  <div className="mt-2 text-xs">
                    <span className="font-semibold">{t("completar_info")}:</span> {resumeStatusReason}
                  </div>
                ) : null}
              </div>
            ) : null}
            {step === "basic" ? basicStep : featuredStep}
            <div className="flex items-center justify-center gap-2 text-xs text-slate-600">
              <Globe2 className="h-4 w-4" />
              {mt("oferente_datos_seguros")}
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
          description={step === "featured" ? included : description}
          setDescription={step === "featured" ? setIncluded : setDescription}
          typeProfile={providerType}
          selectedCategory={proposalCategories.join(", ")}
          isOfrezco={isOfrezco}
          isIntermediario={isIntermediario}
          destinationCountry={destinationCountry}
          contanos={description}
          website={website}
          country={selectedCountry}
          fieldTarget={aiFieldTarget}
        />
      ) : null}
    </>
  );

  return createPortal(modalContent, document.body);
}

