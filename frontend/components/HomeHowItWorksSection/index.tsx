"use client";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

type Step = { title?: string; subtitle?: string; image?: string };
type Publication = { id: string; fields?: { prestationSteps?: Step[] } };

export default function HomeHowItWorksSection() {
  const [steps, setSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/publications?status=active&page=1&perPage=36", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const list: Publication[] = Array.isArray(data?.items) ? data.items : [];
        const found = list.find((item) => String((item as any)?.category ?? "") === "home-how-it-works" && Array.isArray(item?.fields?.prestationSteps) && item.fields!.prestationSteps!.length > 0)
          ?? list.find((item) => Array.isArray(item?.fields?.prestationSteps) && item.fields!.prestationSteps!.length > 0);
        const foundSteps = Array.isArray(found?.fields?.prestationSteps) ? found!.fields!.prestationSteps! : [];
        setSteps(foundSteps.filter((entry) => Boolean(entry?.title || entry?.subtitle || entry?.image)).slice(0, 6));
      } catch {
        setSteps([]);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const hasSteps = useMemo(() => steps.length > 0, [steps]);
  if (loading || !hasSteps) return null;

  return (
    <section className="mt-10 px-4 md:px-0">
      <h2 className="mb-4 inline-block bg-[#2f66dc] px-2 py-1 text-3xl font-bold text-white">Cómo funciona</h2>
      <div className="rounded-3xl border border-slate-200 bg-white p-4 md:p-6 shadow-sm">
        <div className="grid gap-3 md:grid-cols-3">
          {steps.slice(0, 3).map((step, idx) => (
            <article key={`home-how-${idx}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
              <div className="relative h-56 w-full bg-slate-100">
                {step.image ? <Image src={step.image} alt={step.title || `Paso ${idx + 1}`} fill className="object-cover" /> : <div className="flex h-full items-center justify-center text-4xl">✨</div>}
              </div>
              <div className="p-4">
                <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-300 text-sm font-bold text-[#00A9C6]">{idx + 1}</div>
                <h3 className="text-3xl font-extrabold text-slate-900">{step.title || `Paso ${idx + 1}`}</h3>
                {step.subtitle ? <p className="mt-2 text-base text-slate-700" dangerouslySetInnerHTML={{ __html: step.subtitle }} /> : null}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
