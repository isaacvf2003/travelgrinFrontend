import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const adminCookieName = "tg_admin";

function getJwtSecret(): Uint8Array {
  const secret = process.env.ADMIN_JWT_SECRET || "travelgrin-admin-dev-secret-2026";
  return new TextEncoder().encode(secret);
}

export type AdminJwtPayload = {
  id: string;
  email: string;
  name?: string | null;
};

export async function signAdminToken(payload: AdminJwtPayload) {
  const secret = getJwtSecret();
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifyAdminToken(token: string) {
  const secret = getJwtSecret();
  const { payload } = await jwtVerify(token, secret);
  return payload as unknown as AdminJwtPayload;
}

export async function getAdminFromCookie() {
  const token = (await cookies()).get(adminCookieName)?.value;
  if (!token) return null;
  try {
    return await verifyAdminToken(token);
  } catch {
    return null;
  }
}

export function setAdminCookie(token: string) {
  const isProd = process.env.NODE_ENV === "production";
  cookies().set(adminCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7d
  });
}

export function clearAdminCookie() {
  cookies().set(adminCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
