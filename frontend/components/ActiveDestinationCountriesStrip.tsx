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
  code: string;
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
  italia: "IT",
  portugal: "PT",
  francia: "FR",
  alemania: "DE",
  canada: "CA",
  "estados unidos": "US",
};

function normalizeCountry(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function getCountryCode(country: string) {
  return COUNTRY_CODE_MAP[normalizeCountry(country)] ?? "";
}

function CountryFlag({ code, country }: { code: string; country: string }) {
  const normalized = String(code ?? "").trim().toLowerCase();
  if (!normalized) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/w40/${normalized}.png`}
      alt={`Bandera de ${country}`}
      className="h-4 w-5 rounded-[3px] object-cover shadow-sm"
      loading="lazy"
    />
  );
}

export default function ActiveDestinationCountriesStrip() {
  const [countries, setCountries] = useState<CountryEntry[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch("/api/publications?status=active&page=1&perPage=120", {
          cache: "no-store",
        });
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
            const code = getCountryCode(country);
            if (!key || !code) continue;

            const current = counts.get(key);
            if (current) current.count += 1;
            else counts.set(key, { country, count: 1, code });
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

  const visibleCountries = useMemo(
    () => countries.filter((entry) => entry.country && entry.code),
    [countries],
  );

  if (!visibleCountries.length) return null;

  return (
    <section className="px-4 pt-2 md:px-0 md:pt-3">
      <div className="mx-auto max-w-[56rem] rounded-[22px] bg-gradient-to-r from-[#1bc8c0] via-[#149fba] to-[#116d8a] px-5 py-3 text-white shadow-[0_10px_18px_rgba(17,109,138,0.10)] md:px-7 md:py-4">
        <div className="text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.34em] text-white/70">
            Destinos activos
          </p>
          <h2 className="mt-1 text-[18px] font-bold md:text-[22px]">
            Pa\u00edses que te esperan
          </h2>
          <p className="mx-auto mt-1 max-w-3xl text-[11px] text-white/86 md:text-[13px]">
            Explor\u00e1 pa\u00edses donde hoy ya hay oportunidades activas y salt\u00e1 directo al buscador filtrado.
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
          {visibleCountries.map((entry) => (
            <div
              key={entry.country}
              className="flex min-w-[176px] items-center gap-2 rounded-full border border-white/12 bg-white/10 px-3 py-1.5 backdrop-blur-sm"
            >
              <span
                aria-hidden="true"
                className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/14 shadow-sm"
              >
                <CountryFlag code={entry.code} country={entry.country} />
              </span>

              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-semibold leading-none">{entry.country}</div>
                <div className="mt-0.5 text-[9px] text-white/72">
                  {entry.count} oportunidad(es)
                </div>
              </div>

              <Link
                href={`/buscar?destinationCountry=${encodeURIComponent(entry.country)}`}
                className="inline-flex shrink-0 rounded-full bg-white px-2 py-0.5 text-[9px] font-semibold text-[#0b8fa3] transition hover:bg-slate-100"
              >
                Ver m\u00e1s
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
