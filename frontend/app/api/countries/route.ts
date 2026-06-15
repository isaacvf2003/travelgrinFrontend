import { NextResponse } from "next/server";
import countryList from "@/components/countryList";

type CountryApiItem = {
  name: { common: string };
  cca2: string;
  translations?: { spa?: { common?: string } };
  flags?: { svg?: string; png?: string };
};

type RestCountriesV5Object = {
  names?: {
    common?: string;
    translations?: Record<string, { common?: string } | undefined>;
  };
  "codes.alpha_2"?: string;
  "flag.url_svg"?: string;
  "flag.url_png"?: string;
};

type RestCountriesV5Response = {
  data?: {
    objects?: RestCountriesV5Object[];
    meta?: {
      more?: boolean;
      offset?: number;
      count?: number;
    };
  };
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

function mapV5Country(item: RestCountriesV5Object): CountryApiItem | null {
  const name = String(item.names?.common ?? "").trim();
  const cca2 = String(item["codes.alpha_2"] ?? "").trim().toUpperCase();
  if (!name || !cca2) return null;

  const translations = item.names?.translations ?? {};
  const spanishName =
    translations.es?.common ||
    translations.spa?.common ||
    name;

  return {
    name: { common: name },
    cca2,
    translations: { spa: { common: spanishName } },
    flags: {
      svg: item["flag.url_svg"] || `https://flagcdn.com/${cca2.toLowerCase()}.svg`,
      png: item["flag.url_png"] || `https://flagcdn.com/w40/${cca2.toLowerCase()}.png`,
    },
  };
}

async function fetchCountriesFromV5(apiKey: string) {
  const items: CountryApiItem[] = [];
  let offset = 0;
  let keepGoing = true;

  while (keepGoing) {
    const url = new URL("https://api.restcountries.com/countries/v5");
    url.searchParams.set("limit", "100");
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("response_fields", "names,codes.alpha_2,flag.url_svg,flag.url_png");

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      next: { revalidate: 86400 },
    });

    if (!response.ok) {
      throw new Error(`restcountries v5 responded ${response.status}`);
    }

    const payload = (await response.json()) as RestCountriesV5Response;
    const page = Array.isArray(payload?.data?.objects) ? payload.data.objects : [];

    items.push(...page.map(mapV5Country).filter(Boolean) as CountryApiItem[]);

    const count = Number(payload?.data?.meta?.count ?? page.length ?? 0);
    keepGoing = Boolean(payload?.data?.meta?.more) && count > 0;
    offset += count;
  }

  return items;
}

export async function GET() {
  try {
    const apiKey = String(
      process.env.RESTCOUNTRIES_API_KEY ??
      process.env.REST_COUNTRIES_API_KEY ??
      ""
    ).trim();

    if (apiKey) {
      const items = await fetchCountriesFromV5(apiKey);
      if (items.length) {
        return NextResponse.json({ ok: true, items, source: "restcountries-v5" });
      }
    }

    const legacyResponse = await fetch(
      "https://restcountries.com/v3.1/all?fields=name,cca2,translations,flags",
      { next: { revalidate: 86400 } },
    );

    if (!legacyResponse.ok) {
      throw new Error(`restcountries legacy responded ${legacyResponse.status}`);
    }

    const items = (await legacyResponse.json()) as CountryApiItem[];
    return NextResponse.json({ ok: true, items, source: "restcountries-legacy" });
  } catch (error) {
    console.error("[frontend/api/countries] Falling back to bundled country list", error);
    return NextResponse.json({ ok: true, items: buildFallbackCountries(), fallback: true });
  }
}
