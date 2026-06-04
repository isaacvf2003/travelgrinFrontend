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
  "perú": "PE",
  colombia: "CO",
  mexico: "MX",
  "méxico": "MX",
  españa: "ES",
  espana: "ES",
  italia: "IT",
  portugal: "PT",
  francia: "FR",
  alemania: "DE",
  canada: "CA",
  "canadá": "CA",
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
            if (current) {
              current.count += 1;
            } else {
              counts.set(key, { country, count: 1 });
            }
          }
        }

        const next = Array.from(counts.values())
          .sort((a, b) => (b.count - a.count) || a.country.localeCompare(b.country, "es"))
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
    <section className="mt-10 px-4 md:px-0">
      <div className="rounded-[32px] bg-gradient-to-r from-[#0FBFC3] via-[#0B8FA3] to-[#0A667D] px-5 py-6 text-white shadow-[0_18px_40px_rgba(11,143,163,0.18)] md:px-8">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/75">Destinos activos</p>
            <h2 className="mt-1 text-[22px] font-bold md:text-[25.76px]">Países que te esperan</h2>
            <p className="mt-1 max-w-2xl text-sm text-white/85">
              Explorá países donde hoy ya hay oportunidades activas y saltá directo al buscador filtrado.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {visibleCountries.map((entry) => (
            <div
              key={entry.country}
              className="rounded-2xl border border-white/15 bg-white/12 p-4 backdrop-blur-sm"
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
                className="mt-4 inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#0B8FA3] transition hover:bg-slate-100"
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
