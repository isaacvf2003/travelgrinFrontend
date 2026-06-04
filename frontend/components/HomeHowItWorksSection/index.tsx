"use client";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "@/app/hooks/useTranslation";
import HowToStartCarousel from "@/app/prestacion/[id]/_components/HowToStartCarousel";

type I18nRecord = Partial<Record<"es" | "en" | "pt" | "it", string>>;
type Step = { title?: string; subtitle?: string; image?: string; titleI18n?: I18nRecord; subtitleI18n?: I18nRecord; imageI18n?: I18nRecord };
type Publication = { id: string; category?: string; title?: string; titleI18n?: I18nRecord; fields?: { prestationSteps?: Step[] } };

export default function HomeHowItWorksSection() {
  const [steps, setSteps] = useState<Step[]>([]);
  const [sectionTitle, setSectionTitle] = useState<I18nRecord>({ es: "Cómo funciona" });
  const [loading, setLoading] = useState(true);
  const { locale } = useTranslation();

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/publications?status=active&category=home-how-it-works&page=1&perPage=1", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const list: Publication[] = Array.isArray(data?.items) ? data.items : [];
        const found = list.find((item) => String(item?.category ?? "") === "home-how-it-works" && Array.isArray(item?.fields?.prestationSteps) && item.fields!.prestationSteps!.length > 0);
        const foundSteps = Array.isArray(found?.fields?.prestationSteps) ? found!.fields!.prestationSteps! : [];
        setSectionTitle(found?.titleI18n ?? { es: found?.title ?? "Cómo funciona" });
        setSteps(foundSteps.filter((entry) => Boolean(entry?.title || entry?.subtitle || entry?.image || entry?.titleI18n || entry?.subtitleI18n || entry?.imageI18n)).slice(0, 6));
      } catch { setSteps([]); } finally { setLoading(false); }
    };
    void load();
  }, []);

  const pickI18nText = (i18n?: I18nRecord, fallback = "") => (i18n?.[locale] || i18n?.es || fallback || "");
  const localized = useMemo(() => steps.map((step, idx) => ({
    id: `home-step-${idx}`,
    title: pickI18nText(step.titleI18n, step.title ?? ""),
    subtitle: pickI18nText(step.subtitleI18n, step.subtitle ?? ""),
    image: pickI18nText(step.imageI18n, step.image ?? ""),
  })), [steps, locale]);

  if (loading || !localized.length) return null;

  return (
    <section className="mt-10 px-4 md:px-0">
      <h2 className="text-center text-[22px] font-bold text-[#273166] md:text-[25.76px]">{pickI18nText(sectionTitle, "Cómo funciona")}</h2>
      <HowToStartCarousel items={localized} />
    </section>
  );
}

