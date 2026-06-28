import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getBackendApiUrl, missingBackendResponse } from "@/app/api/admin/auth/_lib/backend";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const backendApiUrl = getBackendApiUrl();
  if (!backendApiUrl) return missingBackendResponse();

  const { id } = await context.params;
  const requestHeaders = await headers();
  const cookie = requestHeaders.get("cookie") || "";
  const body = await request.text();

  const response = await fetch(`${backendApiUrl}/api/provider-portal/submissions/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: {
      "Content-Type": requestHeaders.get("content-type") || "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body,
    cache: "no-store",
  });

  const data = await response.json().catch(() => ({}));
  return NextResponse.json(data, { status: response.status });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const backendApiUrl = getBackendApiUrl();
  if (!backendApiUrl) return missingBackendResponse();

  const { id } = await context.params;
  const requestHeaders = await headers();
  const cookie = requestHeaders.get("cookie") || "";

  const response = await fetch(`${backendApiUrl}/api/provider-portal/submissions/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: cookie ? { cookie } : undefined,
    cache: "no-store",
  });

  const data = await response.json().catch(() => ({}));
  return NextResponse.json(data, { status: response.status });
}
