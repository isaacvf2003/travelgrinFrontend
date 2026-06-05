export const DESTINATION_STORAGE_KEY = "tg_destination";
export const DESTINATION_CHANGE_EVENT = "tg_destination_change";

export function normalizeDestination(value: unknown) {
  return String(value ?? "").trim();
}

export function readStoredDestination() {
  if (typeof window === "undefined") return "";
  try {
    return normalizeDestination(window.localStorage.getItem(DESTINATION_STORAGE_KEY));
  } catch {
    return "";
  }
}

export function writeStoredDestination(destination: unknown) {
  if (typeof window === "undefined") return;
  const normalized = normalizeDestination(destination);
  try {
    if (normalized) window.localStorage.setItem(DESTINATION_STORAGE_KEY, normalized);
    else window.localStorage.removeItem(DESTINATION_STORAGE_KEY);
  } catch {}

  window.dispatchEvent(
    new CustomEvent(DESTINATION_CHANGE_EVENT, { detail: normalized }),
  );
}

export function buildBuscarHrefWithDestination(
  params: Record<string, string | undefined>,
  destination: string,
  passportCountry?: string,
) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    const normalized = normalizeDestination(value);
    if (normalized) query.set(key, normalized);
  });

  const normalizedDestination = normalizeDestination(destination);
  const normalizedPassportCountry = normalizeDestination(passportCountry);
  if (normalizedDestination) query.set("destinationCountry", normalizedDestination);
  if (normalizedPassportCountry) query.set("country", normalizedPassportCountry);

  const queryString = query.toString();
  return queryString ? `/buscar?${queryString}` : "/buscar";
}
