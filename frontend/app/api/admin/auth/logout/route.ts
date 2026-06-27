import { NextResponse } from "next/server";
import { clearAdminCookie } from "@/app/api/_lib/auth";
import { getBackendApiUrl, getBackendInternalHeaders } from "../_lib/backend";

export async function POST() {
  await clearAdminCookie();

  const backendApiUrl = getBackendApiUrl();
  if (backendApiUrl) {
    await fetch(`${backendApiUrl}/api/admin/auth/logout`, {
      method: "POST",
      headers: getBackendInternalHeaders(),
      cache: "no-store",
    }).catch(() => null);
  }

  return NextResponse.json({ ok: true });
}
