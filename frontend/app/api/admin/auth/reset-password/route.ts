import { NextResponse } from "next/server";
import { forwardJson } from "../_lib/backend";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const forwarded = await forwardJson("/api/admin/auth/reset-password", body);
    if (forwarded instanceof NextResponse) return forwarded;
    const { response, data } = forwarded;
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("[admin-reset-password-proxy] Reset password proxy failed", error);
    return NextResponse.json(
      { ok: false, error: "No se pudo cambiar la contrasena." },
      { status: 400 },
    );
  }
}
