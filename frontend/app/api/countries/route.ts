import { NextResponse } from "next/server";
import countryList from "@/components/countryList";

type CountryApiItem = {
  name: { common: string };
  cca2: string;
  translations?: { spa?: { common?: string } };
  flags?: { svg?: string; png?: string };
};

type ApiCountriesItem = {
  name?: string;
  alpha2Code?: string;
  translations?: Record<string, string | undefined>;
};

function toFlagSources(code: string) {
  const normalized = code.toLowerCase();
  return {
    svg: `https://flagcdn.com/${normalized}.svg`,
    png: `https://flagcdn.com/w40/${normalized}.png`,
  };
}

function mapApiCountry(entry: ApiCountriesItem): CountryApiItem | null {
  const name = String(entry.name ?? "").trim();
  const cca2 = String(entry.alpha2Code ?? "").trim().toUpperCase();
  if (!name || !cca2) return null;

  const spanishName = String(entry.translations?.es ?? "").trim() || name;

  return {
    name: { common: name },
    cca2,
    translations: { spa: { common: spanishName } },
    flags: toFlagSources(cca2),
  };
}

function buildFallbackCountries(): CountryApiItem[] {
  return countryList.map((country) => {
    const code = String(country.code ?? "").trim().toUpperCase();
    const name = String(country.name ?? "").trim();
    return {
      name: { common: name },
      cca2: code,
      translations: { spa: { common: name } },
      flags: toFlagSources(code),
    };
  });
}

export async function GET() {
  try {
    const response = await fetch("https://www.apicountries.com/countries", {
      next: { revalidate: 86400 },
    });

    if (!response.ok) {
      throw new Error(`apicountries responded ${response.status}`);
    }

    const payload = (await response.json()) as unknown;
    const data = Array.isArray(payload) ? payload : [];
    const items = data.map((entry) => mapApiCountry(entry as ApiCountriesItem)).filter(Boolean) as CountryApiItem[];

    if (!items.length) {
      throw new Error("apicountries returned no usable countries");
    }

    return NextResponse.json({ ok: true, items, source: "apicountries" });
  } catch (error) {
    console.error("[frontend/api/countries] Falling back to bundled country list", error);
    return NextResponse.json({ ok: true, items: buildFallbackCountries(), fallback: true });
  }
}
