export type CountryListItem = {
  code: string;
  name: string;
};

export type CountryApi = {
  name: { common: string };
  cca2: string;
  translations?: { spa?: { common?: string } };
  flags?: { svg?: string; png?: string };
};

export type CountryWithSpanish = CountryApi & {
  spanishName: string;
};

export const countryList: CountryListItem[] = [
  { code: "AR", name: "Argentina" },
  { code: "BR", name: "Brasil" },
  { code: "CL", name: "Chile" },
  { code: "CO", name: "Colombia" },
  { code: "ES", name: "España" },
  { code: "IT", name: "Italia" },
  { code: "MX", name: "México" },
  { code: "PT", name: "Portugal" },
  { code: "US", name: "Estados Unidos" },
  { code: "UY", name: "Uruguay" }
];

export function buildFallbackCountries(): CountryWithSpanish[] {
  return countryList
    .map((country) => {
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
        spanishName: name,
      };
    })
    .sort((a, b) => a.spanishName.localeCompare(b.spanishName));
}

export async function fetchCountriesWithSpanish(): Promise<CountryWithSpanish[]> {
  try {
    const response = await fetch("/api/countries", {
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`/api/countries responded ${response.status}`);
    const payload = (await response.json()) as { items?: CountryApi[] };
    const data = Array.isArray(payload?.items) ? payload.items : [];
    if (!data.length) {
      return buildFallbackCountries();
    }
    return data
      .map((country) => ({
        ...country,
        spanishName: country.translations?.spa?.common || country.name.common,
      }))
      .sort((a, b) => a.spanishName.localeCompare(b.spanishName));
  } catch {
    return buildFallbackCountries();
  }
}

export default countryList;
