import { headers } from "next/headers";

/**
 * Server-safe base URL for API fetches.
 * - BACKEND_API_URL/NEXT_PUBLIC_API_URL point server-rendered pages to the detached backend.
 * - NEXT_PUBLIC_APP_URL keeps the previous same-origin behavior when backend is not split yet.
 * - Otherwise we derive it from request headers for local development.
 */
export async function getBaseUrl() {
  const env = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (env) return env.replace(/\/$/, "");

  // Next.js 15+ makes dynamic request APIs async.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}
