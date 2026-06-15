import { NextResponse } from "next/server";
import countryList from "@/components/countryList";

type CountryApiItem = {
  name: { common: string };
  cca2: string;
  translations?: { spa?: { common?: string } };
  flags?: { svg?: string; png?: string };
};

function buildFallbackCountries(): CountryApiItem[] {
  return countryList.map((country) => {
    const code = String(country.code ?? "").trim().toUpperCase();
    const name = String(country.name ?? "").trim();
    return {
      name: { common: name },
      cca2: code,
      translations: { spa: { common: name } },
      flags: {
        svg: `https://flagcdn.com/${code.toLowerCase()}.svg`,
        png: `https://flagcdn.com/w40/${code.toLowerCase()}.png`,
      },
    };
  });
}

export async function GET() {
  try {
    const response = await fetch(
      "https://restcountries.com/v3.1/all?fields=name,cca2,translations,flags",
      { next: { revalidate: 86400 } }
    );

    if (!response.ok) {
      throw new Error(`restcountries responded ${response.status}`);
    }

    const items = (await response.json()) as CountryApiItem[];
    return NextResponse.json({ ok: true, items });
  } catch (error) {
    console.error("[api/countries] Falling back to bundled country list", error);
    return NextResponse.json({ ok: true, items: buildFallbackCountries(), fallback: true });
  }
}
