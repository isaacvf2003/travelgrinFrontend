import { NextResponse } from "next/server";
import { forwardJson } from "../_lib/backend";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const forwarded = await forwardJson("/api/admin/auth/request-reset", body);
    if (forwarded instanceof NextResponse) return forwarded;
    const { response, data } = forwarded;
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("[admin-request-reset-proxy] Reset request proxy failed", error);
    return NextResponse.json(
      { ok: false, error: "No se pudo enviar el codigo." },
      { status: 400 },
    );
  }
}
