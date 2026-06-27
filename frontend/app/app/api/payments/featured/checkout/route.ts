import { NextResponse } from "next/server";
import { getBackendApiUrl, missingBackendResponse } from "@/app/api/admin/auth/_lib/backend";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const backendApiUrl = getBackendApiUrl();
  return NextResponse.json({
    ok: true,
    route: "frontend-payments-featured-checkout-bridge",
    version: "2026-06-03-api-pure",
    backendApiUrl: backendApiUrl || null,
  });
}

export async function POST(req: Request) {
  const backendApiUrl = getBackendApiUrl();
  if (!backendApiUrl) return missingBackendResponse();

  try {
    const body = await req.json().catch(() => ({}));
    const response = await fetch(`${backendApiUrl}/api/payments/featured/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "unknown" },
      { status: 500 },
    );
  }
}
