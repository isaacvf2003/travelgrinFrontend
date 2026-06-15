import { NextResponse } from "next/server";
import { ensureSameOriginRequest } from "@/app/api/_lib/auth";
import { getProviderPortalCookieName, getProviderPortalCookieOptions } from "@/app/api/_lib/providerPortal";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST() {
  try {
    await ensureSameOriginRequest();
    const response = NextResponse.json({ ok: true });
    response.cookies.set(getProviderPortalCookieName(), "", {
      ...getProviderPortalCookieOptions(),
      maxAge: 0,
      expires: new Date(0),
    });
    return response;
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "unknown" },
      { status: 500 },
    );
  }
}
