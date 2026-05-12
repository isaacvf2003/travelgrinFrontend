export type CurrencyCode =
  | "ARS"
  | "USD"
  | "EUR"
  | "BRL"
  | "CLP"
  | "COP"
  | "MXN"
  | "PEN"
  | "UYU"
  | "JPY"
  | "RUB";

export type PriceOverride = {
  currency: CurrencyCode;
  amount: string | number;
};

const DEFAULT_BY_COUNTRY: Record<string, CurrencyCode> = {
  argentina: "ARS",
  rusia: "RUB",
  russia: "RUB",
  espana: "EUR",
  españa: "EUR",
  portugal: "EUR",
  italia: "EUR",
  francia: "EUR",
  alemania: "EUR",
  brasil: "BRL",
  chile: "CLP",
  colombia: "COP",
  mexico: "MXN",
  peru: "PEN",
  uruguay: "UYU",
  japon: "JPY",
  japonia: "JPY",
  japan: "JPY",
};

const USD_RATES: Record<CurrencyCode, number> = {
  USD: 1,
  ARS: 800,
  EUR: 0.92,
  BRL: 5.0,
  CLP: 900,
  COP: 4000,
  MXN: 17,
  PEN: 3.7,
  UYU: 39,
  JPY: 150,
  RUB: 90,
};

const SYMBOLS: Record<CurrencyCode, string> = {
  USD: "USD",
  ARS: "ARS",
  EUR: "EUR",
  BRL: "BRL",
  CLP: "CLP",
  COP: "COP",
  MXN: "MXN",
  PEN: "PEN",
  UYU: "UYU",
  JPY: "JPY",
  RUB: "RUB",
};

export function parseAmount(value: string | null | undefined): number | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const decimalMatch = raw.match(/^(\d+)[.,](\d{1,3})$/);
  if (decimalMatch) {
    const asNumber = Number(`${decimalMatch[1]}.${decimalMatch[2]}`);
    return Number.isFinite(asNumber) ? asNumber : null;
  }
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  const amount = Number(digits);
  return Number.isFinite(amount) ? amount : null;
}

function normCountry(value: string | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

export function getDefaultCurrencyForCountry(country: string | null | undefined): CurrencyCode {
  const key = normCountry(country);
  if (DEFAULT_BY_COUNTRY[key]) return DEFAULT_BY_COUNTRY[key];
  return "USD";
}

export function convertAmount(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode
): number {
  const usd = amount / USD_RATES[from];
  return usd * USD_RATES[to];
}

export function formatCurrency(
  amount: number,
  currency: CurrencyCode,
  locale = "es-AR"
) {
  const formatted = new Intl.NumberFormat(locale).format(amount);
  return `${SYMBOLS[currency]} ${formatted}`;
}

export function getDisplayPrice(
  amountRaw: string | null | undefined,
  fromCurrencyRaw: string | null | undefined,
  targetCurrencyRaw: string | null | undefined,
  locale = "es-AR",
  overrides: PriceOverride[] = []
) {
  const amount = parseAmount(amountRaw);
  const from = (fromCurrencyRaw || "").toUpperCase() as CurrencyCode;
  const target = (targetCurrencyRaw || "").toUpperCase() as CurrencyCode;
  const overrideMap = new Map<CurrencyCode, number>();

  overrides.forEach((override) => {
    const code = String(override.currency ?? "").toUpperCase() as CurrencyCode;
    if (!USD_RATES[code]) return;
    const parsed = parseAmount(String(override.amount));
    if (!parsed) return;
    overrideMap.set(code, parsed);
  });

  if (!from || !USD_RATES[from]) return null;

  if (target && USD_RATES[target]) {
    const directOverride = overrideMap.get(target);
    if (directOverride != null) {
      return {
        amount: directOverride,
        currency: target,
        formatted: formatCurrency(directOverride, target, locale),
      };
    }
    if (from === target && amount) {
      return {
        amount,
        currency: from,
        formatted: formatCurrency(amount, from, locale),
      };
    }
  }

  if (!amount) return null;
  return {
    amount,
    currency: from,
    formatted: formatCurrency(amount, from, locale),
  };
}
