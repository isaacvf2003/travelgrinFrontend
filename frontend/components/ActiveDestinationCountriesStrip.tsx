"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type PublicationItem = {
  country?: string | null;
  fields?: Record<string, unknown> | null;
};

type CountryEntry = {
  country: string;
  count: number;
};

const COUNTRY_CODE_MAP: Record<string, string> = {
  argentina: "AR",
  brasil: "BR",
  brazil: "BR",
  chile: "CL",
  uruguay: "UY",
  paraguay: "PY",
  bolivia: "BO",
  peru: "PE",
  colombia: "CO",
  mexico: "MX",
  espana: "ES",
  españa: "ES",
  italia: "IT",
  portugal: "PT",
  francia: "FR",
  alemania: "DE",
  canada: "CA",
  canadà: "CA",
  canadá: "CA",
  "estados unidos": "US",
};

function normalizeCountry(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function flagFromAlpha2Code(alpha2Code: string) {
  const code = alpha2Code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return "🌎";
  return String.fromCodePoint(...[...code].map((char) => 127397 + char.charCodeAt(0)));
}

function getCountryFlag(country: string) {
  const normalized = normalizeCountry(country);
  const alpha2Code = COUNTRY_CODE_MAP[normalized];
  return alpha2Code ? flagFromAlpha2Code(alpha2Code) : "🌎";
}

export default function ActiveDestinationCountriesStrip() {
  const [countries, setCountries] = useState<CountryEntry[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch("/api/publications?status=active&page=1&perPage=120", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const items: PublicationItem[] = Array.isArray(data?.items) ? data.items : [];
        const counts = new Map<string, CountryEntry>();

        for (const item of items) {
          const fields = item.fields && typeof item.fields === "object" ? item.fields : {};
          const candidates = new Set<string>();

          const directCountry = String(item.country ?? "").trim();
          if (directCountry) candidates.add(directCountry);

          const destinationCountries = Array.isArray((fields as Record<string, unknown>).destinationCountries)
            ? ((fields as Record<string, unknown>).destinationCountries as unknown[])
            : [];

          for (const entry of destinationCountries) {
            const country = String(entry ?? "").trim();
            if (country) candidates.add(country);
          }

          for (const country of candidates) {
            const key = normalizeCountry(country);
            if (!key) continue;
            const current = counts.get(key);
            if (current) current.count += 1;
            else counts.set(key, { country, count: 1 });
          }
        }

        const next = Array.from(counts.values())
          .sort((a, b) => b.count - a.count || a.country.localeCompare(b.country, "es"))
          .slice(0, 8);

        if (!cancelled) setCountries(next);
      } catch {
        if (!cancelled) setCountries([]);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleCountries = useMemo(() => countries.filter((entry) => entry.country), [countries]);

  if (!visibleCountries.length) return null;

  return (
    <section className="mt-6 px-4 md:px-0">
      <div className="mx-auto max-w-5xl rounded-[30px] bg-gradient-to-r from-[#0FBFC3] via-[#0B8FA3] to-[#0A667D] px-5 py-5 text-white shadow-[0_16px_36px_rgba(11,143,163,0.16)] md:px-8">
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/72">Destinos activos</p>
          <h2 className="mt-1 text-[21px] font-bold md:text-[24px]">Países que te esperan</h2>
          <p className="mx-auto mt-1 max-w-2xl text-sm text-white/85">
            Explorá países donde hoy ya hay oportunidades activas y saltá directo al buscador filtrado.
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          {visibleCountries.map((entry) => (
            <div
              key={entry.country}
              className="min-w-[220px] rounded-2xl border border-white/15 bg-white/12 px-4 py-3 backdrop-blur-sm"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{getCountryFlag(entry.country)}</span>
                <div>
                  <div className="font-semibold">{entry.country}</div>
                  <div className="text-xs text-white/75">{entry.count} oportunidad(es)</div>
                </div>
              </div>
              <Link
                href={`/buscar?destinationCountry=${encodeURIComponent(entry.country)}`}
                className="mt-3 inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#0B8FA3] transition hover:bg-slate-100"
              >
                Ver más
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
