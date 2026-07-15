import { NextResponse } from "next/server";
import { setAdminCookie } from "@/app/api/_lib/auth";
import { forwardJson } from "../_lib/backend";

type LoginResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  otpRequired?: boolean;
  otpToken?: string;
  admin?: {
    id?: string;
    adminId?: string;
    email?: string;
    role?: string;
  };
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const forwarded = await forwardJson("/api/admin/auth/login", body);
    if (forwarded instanceof NextResponse) return forwarded;

    const { response, data } = forwarded as { response: Response; data: LoginResponse };
    if (!response.ok || !data?.ok) {
      return NextResponse.json(data || { ok: false, error: "Login failed" }, { status: response.status || 401 });
    }

    if (data.otpRequired) {
      return NextResponse.json(data);
    }

    if (!data.admin?.email) {
      return NextResponse.json({ ok: false, error: "Login failed" }, { status: 401 });
    }

    await setAdminCookie({
      adminId: data.admin.id || data.admin.adminId || data.admin.email,
      email: data.admin.email,
      role: data.admin.role || "admin",
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error("[admin-login-proxy] Login proxy failed", error);
    return NextResponse.json(
      { ok: false, error: "No se pudo iniciar sesion. Intenta nuevamente." },
      { status: 400 },
    );
  }
}
