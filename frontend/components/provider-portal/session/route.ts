import { NextResponse } from "next/server";
import { getProviderPortalDashboard, getProviderPortalSession } from "@/app/api/_lib/providerPortal";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const session = await getProviderPortalSession();
    if (!session?.email) {
      return NextResponse.json({ ok: true, authenticated: false });
    }

    const dashboard = await getProviderPortalDashboard(session.email);
    return NextResponse.json({
      ok: true,
      authenticated: true,
      session: { email: session.email },
      dashboard,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "unknown" },
      { status: 500 },
    );
  }
}

