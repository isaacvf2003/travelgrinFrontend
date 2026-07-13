import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getBackendApiUrl, missingBackendResponse } from "@/app/api/admin/auth/_lib/backend";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const backendApiUrl = getBackendApiUrl();
  if (!backendApiUrl) return missingBackendResponse();

  const { id } = await context.params;
  const requestHeaders = await headers();
  const cookie = requestHeaders.get("cookie") || "";
  const origin = requestHeaders.get("origin") || "";
  const referer = requestHeaders.get("referer") || "";
  const body = await request.text();

  const response = await fetch(`${backendApiUrl}/api/provider-portal/publications/${encodeURIComponent(id)}/change-request`, {
    method: "POST",
    headers: {
      "Content-Type": requestHeaders.get("content-type") || "application/json",
      ...(cookie ? { cookie } : {}),
      ...(origin ? { origin } : {}),
      ...(referer ? { referer } : {}),
    },
    body,
    cache: "no-store",
  });

  const data = await response.json().catch(() => ({}));
  return NextResponse.json(data, { status: response.status });
}
