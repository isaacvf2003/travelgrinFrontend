import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import I18nText from "@/components/I18nText";
import TranslatedText from "@/components/TranslatedText";
import { getBaseUrl } from "@/app/lib/baseUrl";
import type { Publication } from "@/app/lib/types";
import { pickI18nText, type I18nRecord } from "@/app/lib/i18nContent";
import type { Locale } from "@/app/lib/translations";
import RelatedPublicationsCarousel from "./_components/RelatedPublicationsCarousel";
import PrestacionResourcesCarousel from "./_components/PrestacionResourcesCarousel";
import HowToStartCarousel from "./_components/HowToStartCarousel";

type PageProps = {
  params: { id: string };
  searchParams?: { returnTo?: string | string[] };
};

type ResourceButton = { label: string; labelI18n?: I18nRecord; url: string; style?: "primary" | "secondary"; bgColor?: string; textColor?: string };
type ResourceCard = {
  title: string;
  titleI18n?: I18nRecord;
  subtitle: string;
  subtitleI18n?: I18nRecord;
  image: string;
  imageI18n?: I18nRecord;
  checkItems: string[];
  checkItemsI18n?: I18nRecord[];
  buttons: ResourceButton[];
  colorNoteTitle?: string;
  colorNoteTitleI18n?: I18nRecord;
  colorNoteText?: string;
  colorNoteTextI18n?: I18nRecord;
  colorNoteBgColor?: string;
  colorNoteTextColor?: string;
};
type HeroInfoBlock = { title: string; titleI18n?: I18nRecord; text: string; textI18n?: I18nRecord; bgColor?: string; textColor?: string };
type StepItem = { title: string; titleI18n?: I18nRecord; subtitle: string; subtitleI18n?: I18nRecord; image?: string; imageI18n?: I18nRecord };
type FaqItem = { question: string; questionI18n?: I18nRecord; answer: string; answerI18n?: I18nRecord };

function asText(value: unknown) {
  return String(value ?? "").trim();
}

function asUrl(value: unknown) {
  const v = asText(value);
  return v || "";
}

function hasI18nText(value?: I18nRecord | null) {
  if (!value) return false;
  return Object.values(value).some((entry) => asText(entry));
}

function resolveCardImageForSearch(pub: Publication, locale: Locale) {
  const fields = (pub.fields ?? {}) as Record<string, unknown>;

  if (pub.primaryGroupKey === "prestacion") {
    const resources = Array.isArray(fields.prestationResources) ? fields.prestationResources : [];
    const firstResourceWithImage = resources.find((entry) => {
      const data = (entry ?? {}) as Record<string, unknown>;
      return asText(data.image);
    }) as Record<string, unknown> | undefined;

    if (firstResourceWithImage) {
      const localized = pickI18nText(
        (firstResourceWithImage.imageI18n as I18nRecord | null) ?? null,
        locale,
        asText(firstResourceWithImage.image)
      );
      if (localized) return localized;
    }
  }

  const images = Array.isArray(pub.images) ? pub.images : [];
  const firstImage = asText(images[0]);
  if (firstImage) return firstImage;

  return "https://i.ibb.co/VmrmGrx/sin-foto.jpg";
}

function resolveDetailPath(pub: Publication) {
  const basePath = pub.primaryGroupKey === "prestacion" ? "prestaciones" : "publicacion";
  return `/${basePath}/${pub.id}`;
}

async function fetchPublication(base: string, id: string) {
  const res = await fetch(`${base}/api/publications/${id}`, { cache: "no-store" });
  if (!res.ok) return null;
  const payload = (await res.json()) as { item?: Publication } | Publication;
  return ("item" in payload ? payload.item : payload) as Publication;
}

function resolveBackHref(rawValue: string | string[] | undefined) {
  const candidate = Array.isArray(rawValue) ? rawValue[0] : rawValue;
  const safeValue = String(candidate ?? "").trim();
  if (!safeValue.startsWith("/")) return "/buscar";
  if (safeValue.startsWith("//")) return "/buscar";
  return safeValue;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await Promise.resolve(params);

  try {
    const base = await getBaseUrl();
    const item = await fetchPublication(base, id);
    if (!item) return { title: "TravelGrin" };

    const fields = (item.fields ?? {}) as Record<string, unknown>;
    const locale = (item.contentLanguage ?? "es") as Locale;
    const title = pickI18nText(
      (fields.prestationHeroTitleI18n as I18nRecord | null) ?? item.titleI18n,
      locale,
      asText(fields.prestationHeroTitle) || item.title
    ).trim();

    return { title: title ? `${title} | TravelGrin` : "TravelGrin" };
  } catch {
    return { title: "TravelGrin" };
  }
}

export default async function PrestacionDetalle({ params, searchParams }: PageProps) {
  const { id } = await Promise.resolve(params);
  const resolvedSearchParams = await Promise.resolve(searchParams ?? {});
  const base = await getBaseUrl();
  const item = await fetchPublication(base, id);

  if (!item) {
    return (
      <div className="min-h-screen bg-white">
        <NavBar />
        <main className="mx-auto max-w-6xl px-4 py-16">
          <div className="rounded-2xl border border-gray-200 bg-white p-10 text-gray-700">
            <TranslatedText id="publicacion_no_encontrada" />
            <div className="mt-6">
              <Link className="text-teal-600 underline" href="/buscar">
                <TranslatedText id="volver_busqueda" />
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const fields = (item.fields ?? {}) as Record<string, unknown>;
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get("NEXT_LOCALE")?.value;
  const locale = (["es", "en", "pt", "it"].includes(String(localeCookie)) ? localeCookie : "es") as Locale;

  const resources: ResourceCard[] = Array.isArray(fields.prestationResources)
    ? fields.prestationResources
        .map((entry) => {
          const data = (entry ?? {}) as Record<string, unknown>;
          const checkItems = Array.isArray(data.checkItems) ? data.checkItems.map((it) => asText(it)).filter(Boolean) : [];
          const checkItemsI18n = Array.isArray(data.checkItemsI18n) ? (data.checkItemsI18n as I18nRecord[]) : [];
          const buttons = Array.isArray(data.buttons)
            ? data.buttons
                .map((btn) => {
                  const b = (btn ?? {}) as Record<string, unknown>;
                  return {
                    label: asText(b.label),
                    labelI18n: (b.labelI18n ?? { es: asText(b.label) }) as I18nRecord,
                    url: asUrl(b.url),
                    style: b.style === "secondary" ? "secondary" : "primary",
                    bgColor: asText(b.bgColor) || undefined,
                    textColor: asText(b.textColor) || undefined,
                  } as ResourceButton;
                })
                .filter((btn) => btn.label && btn.url)
            : [];

          return {
            title: asText(data.title),
            titleI18n: (data.titleI18n ?? { es: asText(data.title) }) as I18nRecord,
            subtitle: asText(data.subtitle),
            subtitleI18n: (data.subtitleI18n ?? { es: asText(data.subtitle) }) as I18nRecord,
            image: asUrl(data.image),
            imageI18n: (data.imageI18n ?? { es: asText(data.image) }) as I18nRecord,
            checkItems,
            checkItemsI18n,
            buttons,
            colorNoteTitle: asText(data.colorNoteTitle),
            colorNoteTitleI18n: (data.colorNoteTitleI18n ?? { es: asText(data.colorNoteTitle) }) as I18nRecord,
            colorNoteText: asText(data.colorNoteText),
            colorNoteTextI18n: (data.colorNoteTextI18n ?? { es: asText(data.colorNoteText) }) as I18nRecord,
            colorNoteBgColor: asText(data.colorNoteBgColor) || "#EEF2FF",
            colorNoteTextColor: asText(data.colorNoteTextColor) || "#1E3A8A",
          } as ResourceCard;
        })
        .filter((entry) => entry.title || hasI18nText(entry.titleI18n) || entry.subtitle || hasI18nText(entry.subtitleI18n) || entry.image || entry.checkItems.length || entry.buttons.length || hasI18nText(entry.colorNoteTitleI18n) || hasI18nText(entry.colorNoteTextI18n))
    : [];

  const heroInfoBlocks: HeroInfoBlock[] = Array.isArray(fields.prestationHeroInfoBlocks)
    ? fields.prestationHeroInfoBlocks
        .map((entry) => {
          const data = (entry ?? {}) as Record<string, unknown>;
          return {
            title: asText(data.title),
            titleI18n: (data.titleI18n ?? { es: asText(data.title) }) as I18nRecord,
            text: asText(data.text),
            textI18n: (data.textI18n ?? { es: asText(data.text) }) as I18nRecord,
            bgColor: asText(data.bgColor) || "#DBEAFE",
            textColor: asText(data.textColor) || "#1E3A8A",
          };
        })
        .filter((entry) => entry.title || hasI18nText(entry.titleI18n) || entry.text || hasI18nText(entry.textI18n))
    : [];

  const steps: StepItem[] = Array.isArray(fields.prestationSteps)
    ? fields.prestationSteps
        .map((entry) => {
          const data = (entry ?? {}) as Record<string, unknown>;
          return {
            title: asText(data.title),
            titleI18n: (data.titleI18n ?? { es: asText(data.title) }) as I18nRecord,
            subtitle: asText(data.subtitle),
            subtitleI18n: (data.subtitleI18n ?? { es: asText(data.subtitle) }) as I18nRecord,
            image: asUrl(data.image),
            imageI18n: (data.imageI18n ?? { es: asText(data.image) }) as I18nRecord,
          } as StepItem;
        })
        .filter((entry) => entry.title || hasI18nText(entry.titleI18n) || entry.subtitle || hasI18nText(entry.subtitleI18n) || entry.image)
    : [];

  const faqs: FaqItem[] = Array.isArray(fields.prestationFaqs)
    ? fields.prestationFaqs
        .map((entry) => {
          const data = (entry ?? {}) as Record<string, unknown>;
          return {
            question: asText(data.question),
            questionI18n: (data.questionI18n ?? { es: asText(data.question) }) as I18nRecord,
            answer: asText(data.answer),
            answerI18n: (data.answerI18n ?? { es: asText(data.answer) }) as I18nRecord,
          } as FaqItem;
        })
        .filter((entry) => entry.question || hasI18nText(entry.questionI18n) || entry.answer || hasI18nText(entry.answerI18n))
    : [];

  const relatedIds = Array.isArray(fields.prestationRelatedPublicationIds) ? fields.prestationRelatedPublicationIds.map((entry) => asText(entry)).filter(Boolean) : [];
  const relatedPubs = (await Promise.all(relatedIds.map((relatedId) => fetchPublication(base, relatedId)))).filter(Boolean) as Publication[];
  const relatedCards = relatedPubs.map((pub) => ({
    id: pub.id,
    category: pickI18nText(pub.categoryI18n ?? null, locale, pub.category || "Prestación"),
    title: pickI18nText(pub.titleI18n ?? null, locale, pub.title),
    description: pickI18nText(pub.descriptionI18n ?? null, locale, pub.description),
    image: resolveCardImageForSearch(pub, locale),
    href: resolveDetailPath(pub),
  }));
  const localizedResourceCards = resources.map((card, idx) => ({
    id: `resource-${idx}`,
    title: pickI18nText(card.titleI18n ?? null, locale, card.title),
    subtitle: pickI18nText(card.subtitleI18n ?? null, locale, card.subtitle),
    image: pickI18nText(card.imageI18n ?? null, locale, card.image),
    checkItems: card.checkItems
      .map((item, checkIdx) => pickI18nText(card.checkItemsI18n?.[checkIdx] ?? null, locale, item))
      .filter(Boolean),
    buttons: card.buttons
      .map((btn) => ({
        label: pickI18nText(btn.labelI18n ?? null, locale, btn.label),
        url: btn.url,
        style: btn.style,
        bgColor: btn.bgColor,
        textColor: btn.textColor,
      }))
      .filter((btn) => btn.label && btn.url),
  }));
  const localizedSteps = steps.map((step, idx) => ({
    id: `step-${idx}`,
    title: pickI18nText(step.titleI18n ?? null, locale, step.title),
    subtitle: pickI18nText(step.subtitleI18n ?? null, locale, step.subtitle),
    image: pickI18nText(step.imageI18n ?? null, locale, step.image ?? ""),
  }));

  const heroImage = pickI18nText((fields.prestationHeroImageI18n as I18nRecord | null) ?? null, locale, asText(fields.prestationHeroImage));
  const backHref = resolveBackHref(resolvedSearchParams.returnTo);

  return (
    <div className="min-h-screen bg-[#F3F5F7]">
      <NavBar />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-4 flex items-center gap-2 text-sm text-slate-500">
          <Link href="/" className="hover:text-slate-800"><TranslatedText id="inicio" /></Link>
          <span>›</span>
          <Link href={backHref} className="hover:text-slate-800"><TranslatedText id="volver_busqueda" /></Link>
        </div>
        <div className="mb-4">
          <Link href={backHref} className="inline-flex rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            ← <TranslatedText id="volver_busqueda" />
          </Link>
        </div>
        <section className="overflow-hidden rounded-3xl bg-gradient-to-r from-[#0B8FA3] via-[#1479C9] to-[#1A4B8C] p-8 text-white md:p-12" style={heroImage ? { backgroundImage: `linear-gradient(rgba(11,143,163,.82), rgba(20,121,201,.76)), url(${heroImage})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
          <div className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold">Prestación</div>
          <h1 className="mt-4 text-3xl font-bold md:text-5xl">
            <I18nText value={(fields.prestationHeroTitleI18n as I18nRecord | null) ?? item.titleI18n} fallback={asText(fields.prestationHeroTitle) || item.title} />
          </h1>
          <I18nText
            value={(fields.prestationHeroSubtitleI18n as I18nRecord | null) ?? item.descriptionI18n}
            fallback={asText(fields.prestationHeroSubtitle) || item.description}
            rich
            className="mt-3 max-w-2xl text-white/85"
          />
        </section>

        {heroInfoBlocks.length ? (
          <section className="mt-8 space-y-3">
            {heroInfoBlocks.map((block, idx) => (
              <div key={`hero-info-${idx}`} className="rounded-2xl px-5 py-4" style={{ backgroundColor: block.bgColor || "#DBEAFE", color: block.textColor || "#1E3A8A" }}>
                {(block.title || block.titleI18n) ? <h3 className="text-base font-semibold"><I18nText value={block.titleI18n ?? null} fallback={block.title} /></h3> : null}
                {(block.text || block.textI18n) ? <I18nText value={block.textI18n ?? null} fallback={block.text} rich className="mt-1 text-sm" /> : null}
              </div>
            ))}
          </section>
        ) : null}

        {resources.length ? (
          <section className="mt-8">
            <h2 className="text-xl font-bold text-slate-900 md:text-2xl"><TranslatedText id="prestacion_nuestros_recursos" /></h2>
            <PrestacionResourcesCarousel items={localizedResourceCards} />
          </section>
        ) : null}

        {steps.length ? (
          <section className="mt-10">
            <h2 className="text-xl font-bold text-slate-900 md:text-2xl"><TranslatedText id="prestacion_como_empezar" /></h2>
            <HowToStartCarousel items={localizedSteps} />
          </section>
        ) : null}

        {faqs.length ? (
          <section className="mt-12 border-t border-slate-200 pt-10">
            <h2 className="text-xl font-bold text-slate-900 md:text-2xl"><TranslatedText id="prestacion_faq_titulo" /></h2>
            <p className="mt-2 text-sm text-slate-500 md:text-base"><TranslatedText id="prestacion_faq_subtitulo" /></p>
            <div className="mt-5 space-y-3">
              {faqs.map((faq, idx) => (
                <details key={`faq-${idx}`} className="rounded-xl border border-slate-200 bg-white p-4">
                  <summary className="cursor-pointer text-base font-semibold text-slate-900 md:text-lg"><I18nText value={faq.questionI18n ?? null} fallback={faq.question || `(sin pregunta ${idx + 1})`} /></summary>
                  {(faq.answer || faq.answerI18n) ? <I18nText value={faq.answerI18n ?? null} fallback={faq.answer} rich className="mt-3 text-sm text-slate-600 md:text-base" /> : null}
                </details>
              ))}
            </div>
          </section>
        ) : null}

        {relatedPubs.length ? (
          <section className="mt-12 border-t border-slate-200 pt-10">
            <h2 className="text-xl font-bold text-slate-900 md:text-2xl"><TranslatedText id="prestacion_tambien_interesar" /></h2>
            <RelatedPublicationsCarousel items={relatedCards} />
          </section>
        ) : null}
      </main>
      <Footer />
    </div>
  );
}

