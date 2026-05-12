const DEFAULT_ADMIN_EMAIL = "travelgrin@travelgrin.com";
const DEFAULT_ADMIN_PASSWORD = "TravelGrin2026login";

function normalizeBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
}

export function isAdminAuthEnabled() {
  return normalizeBoolean(process.env.ADMIN_AUTH_ENABLED, false);
}

export function getDefaultAdminEmail() {
  return process.env.ADMIN_DEFAULT_EMAIL?.trim() || DEFAULT_ADMIN_EMAIL;
}

export function getDefaultAdminPassword() {
  return process.env.ADMIN_DEFAULT_PASSWORD || DEFAULT_ADMIN_PASSWORD;
}

export function getAllowedAdminEmails() {
  const raw = process.env.ADMIN_ALLOWED_EMAILS?.trim();
  if (!raw) return [getDefaultAdminEmail().toLowerCase()];

  return raw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export function getAdminMailFrom() {
  return process.env.ADMIN_MAIL_FROM?.trim() || "TravelGrin <no-reply@travelgrin.com>";
}

export function getResendApiKey() {
  return process.env.RESEND_API_KEY?.trim() || "";
}
