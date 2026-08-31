const DEFAULT_ADMIN_EMAIL = "admin@travelgrin.com";
const DEFAULT_ADMIN_PASSWORD = "";

function normalizeBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
}

export function isAdminAuthEnabled() {
  return normalizeBoolean(process.env.ADMIN_AUTH_ENABLED, false);
}

export function getDefaultAdminEmail() {
  return process.env.ADMIN_DEFAULT_EMAIL?.trim() || process.env.ADMIN_BOOTSTRAP_EMAIL?.trim() || DEFAULT_ADMIN_EMAIL;
}

export function getDefaultAdminPassword() {
  return process.env.ADMIN_DEFAULT_PASSWORD || DEFAULT_ADMIN_PASSWORD;
}

export function getAllowedAdminEmails() {
  const allowedRaw = process.env.ADMIN_ALLOWED_EMAILS?.trim() || "";
  const bootstrapRaw = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim() || "";

  const emails = `${allowedRaw},${bootstrapRaw},${getDefaultAdminEmail()}`
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return Array.from(new Set(emails));
}

export function getAdminMailFrom() {
  return process.env.ADMIN_MAIL_FROM?.trim() || "TravelGrin <no-reply@travelgrin.com>";
}

export function getResendApiKey() {
  return process.env.RESEND_API_KEY?.trim() || "";
}
