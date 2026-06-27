import { NextResponse } from "next/server";

export function getBackendApiUrl() {
  const raw = process.env.BACKEND_API_URL || process.env.NEXT_API_PROXY_TARGET || process.env.NEXT_PUBLIC_API_URL;
  return raw?.trim().replace(/\/$/, "") || "";
}

export function missingBackendResponse() {
  return NextResponse.json(
    {
      ok: false,
      error: "Backend API URL is not configured.",
      message: "Configura BACKEND_API_URL o NEXT_API_PROXY_TARGET apuntando al backend.",
    },
    { status: 500 },
  );
}

export function getBackendInternalHeaders() {
  const secret = process.env.FRONTEND_BACKEND_SHARED_SECRET?.trim();
  return secret ? { "x-travelgrin-internal-secret": secret } : {};
}

export async function forwardJson(path: string, body: unknown) {
  const backendApiUrl = getBackendApiUrl();
  if (!backendApiUrl) return missingBackendResponse();

  const response = await fetch(`${backendApiUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getBackendInternalHeaders() },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const data = await response.json().catch(() => ({}));
  return { response, data } as const;
}

export async function forwardApiRequest(path: string, init?: RequestInit) {
  const backendApiUrl = getBackendApiUrl();
  if (!backendApiUrl) return null;
  const headers = new Headers(init?.headers);
  Object.entries(getBackendInternalHeaders()).forEach(([key, value]) => headers.set(key, value));

  return fetch(`${backendApiUrl}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
}
