import { NextResponse } from "next/server";
import countryList from "@/components/countryList";
import { forwardApiRequest } from "@/app/api/admin/auth/_lib/backend";

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
    const response = await forwardApiRequest("/api/countries", { method: "GET" });
    if (response?.ok) {
      const payload = await response.json().catch(() => ({}));
      if (Array.isArray(payload?.items) && payload.items.length) {
        return NextResponse.json(payload, { status: response.status });
      }
    }
  } catch {}

  return NextResponse.json({ ok: true, items: buildFallbackCountries(), fallback: true });
}
