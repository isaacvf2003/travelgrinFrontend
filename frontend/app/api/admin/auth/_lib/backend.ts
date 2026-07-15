import { NextResponse } from "next/server";

export function getBackendApiUrl() {
  const raw = process.env.BACKEND_API_URL || process.env.NEXT_API_PROXY_TARGET || process.env.NEXT_PUBLIC_API_URL;
  return raw?.trim().replace(/\/$/, "") || "";
}

export function missingBackendResponse() {
  return NextResponse.json(
    {
      ok: false,
      error: "Servicio no disponible. Intenta nuevamente.",
    },
    { status: 500 },
  );
}

export async function forwardJson(path: string, body: unknown) {
  const backendApiUrl = getBackendApiUrl();
  if (!backendApiUrl) return missingBackendResponse();

  const response = await fetch(`${backendApiUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const data = await response.json().catch(() => ({}));
  return { response, data } as const;
}

export async function forwardApiRequest(path: string, init?: RequestInit) {
  const backendApiUrl = getBackendApiUrl();
  if (!backendApiUrl) return null;

  return fetch(`${backendApiUrl}${path}`, {
    ...init,
    cache: "no-store",
  });
}
