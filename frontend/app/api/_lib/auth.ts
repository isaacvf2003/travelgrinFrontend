import crypto from "crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { getAllowedAdminEmails } from "@/app/lib/adminSecurity";

const COOKIE_NAME = "tg_admin";

export type AdminTokenPayload = {
  adminId: string;
  email: string;
  role: string;
};

function getConfiguredOrigins() {
  return [
    process.env.FRONTEND_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.APP_URL,
    ...((process.env.API_CORS_ORIGINS || "").split(",")),
  ]
    .map((value) => value?.trim().replace(/\/$/, ""))
    .filter(Boolean) as string[];
}

function normalizeOrigin(value: string | null) {
  if (!value) return "";
  try {
    return new URL(value).origin.replace(/\/$/, "");
  } catch {
    return value.replace(/\/$/, "");
  }
}

export async function ensureSameOriginRequest() {
  const h = await headers();
  const origin = normalizeOrigin(h.get("origin"));
  const referer = normalizeOrigin(h.get("referer"));
  const host = h.get("x-forwarded-host") || h.get("host") || "";
  const proto = h.get("x-forwarded-proto") || "http";
  const sameHostOrigin = host ? `${proto}://${host}`.replace(/\/$/, "") : "";
  const requestOrigin = origin || referer;

  if (!requestOrigin) return;

  const allowedOrigins = new Set([sameHostOrigin, ...getConfiguredOrigins()].filter(Boolean));
  const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(requestOrigin);
  if (!allowedOrigins.has(requestOrigin) && !isLocalhost) {
    throw new Error("Origen no autorizado.");
  }
}

export function isAllowedAdminEmail(email: string) {
  return getAllowedAdminEmails().includes(email.trim().toLowerCase());
}

export function getPasswordResetWindowMinutes() {
  const raw = Number(process.env.ADMIN_PASSWORD_RESET_WINDOW_MINUTES || 15);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 15;
}

export function getPasswordResetExpiry() {
  return new Date(Date.now() + getPasswordResetWindowMinutes() * 60 * 1000);
}

export function createPasswordResetCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashResetCode(code: string) {
  return crypto
    .createHash("sha256")
    .update(`${getJwtSecret()}:${code.trim()}`)
    .digest("hex");
}

export function getJwtSecret() {
  const secret = process.env.ADMIN_JWT_SECRET || "travelgrin-admin-dev-secret-2026";
  return secret;
}

function getAdminCookieOptions() {
  const sameSite = process.env.ADMIN_COOKIE_SAME_SITE === "none" ? "none" : "lax";
  const domain = process.env.ADMIN_COOKIE_DOMAIN?.trim();

  return {
    httpOnly: true,
    sameSite,
    secure: process.env.NODE_ENV === "production" || sameSite === "none",
    path: "/",
    ...(domain ? { domain } : {}),
  } as const;
}

export async function setAdminCookie(payload: AdminTokenPayload) {
  const token = jwt.sign(payload, getJwtSecret(), { expiresIn: "7d" });
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    ...getAdminCookieOptions(),
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearAdminCookie() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", { ...getAdminCookieOptions(), maxAge: 0 });
}

export async function getAdminFromCookie(): Promise<AdminTokenPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    return jwt.verify(token, getJwtSecret()) as AdminTokenPayload;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}
