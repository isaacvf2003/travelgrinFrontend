import { NextResponse } from "next/server";
import { setAdminCookie } from "@/app/api/_lib/auth";
import { forwardJson } from "../_lib/backend";

type VerifyOtpResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
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
    const forwarded = await forwardJson("/api/admin/auth/verify-otp", body);
    if (forwarded instanceof NextResponse) return forwarded;

    const { response, data } = forwarded as { response: Response; data: VerifyOtpResponse };
    if (!response.ok || !data?.ok || !data.admin?.email) {
      return NextResponse.json(data || { ok: false, error: "OTP failed" }, { status: response.status || 401 });
    }

    await setAdminCookie({
      adminId: data.admin.id || data.admin.adminId || data.admin.email,
      email: data.admin.email,
      role: data.admin.role || "admin",
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error("[admin-verify-otp-proxy] OTP proxy failed", error);
    return NextResponse.json(
      { ok: false, error: "No se pudo verificar el codigo." },
      { status: 400 },
    );
  }
}
