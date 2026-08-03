import { NextResponse } from "next/server";
import {
  verifyMfaVerifyToken,
  verifyTOTP,
  getProviderMfaSecret,
} from "@/app/api/_lib/providerMfa";
import {
  getProviderPortalCookieName,
  getProviderPortalCookieOptions,
  verifyProviderPortalResumeToken,
  signProviderPortalSession,
} from "@/app/api/_lib/providerPortal";

export async function POST(req: Request) {
  try {
    const { mfaToken, code } = await req.json();
    if (!mfaToken || !code) {
      return NextResponse.json({ ok: false, error: "Datos incompletos" }, { status: 400 });
    }

    const payload = verifyMfaVerifyToken(mfaToken);
    if (!payload) {
      return NextResponse.json({ ok: false, error: "Token de verificación inválido o vencido." }, { status: 400 });
    }

    const mfaSecret = await getProviderMfaSecret(payload.email);
    if (!mfaSecret) {
      return NextResponse.json({ ok: false, error: "No se configuró doble factor para esta cuenta." }, { status: 400 });
    }

    const cleanedCode = String(code).trim().replace(/\s/g, "");
    const isValid = verifyTOTP(cleanedCode, mfaSecret);
    if (!isValid) {
      return NextResponse.json({ ok: false, error: "Código de verificación incorrecto. Intenta de nuevo." }, { status: 400 });
    }

    let portalParams = "portal_status=ok";
    if (payload.resumeToken) {
      const resumePayload = verifyProviderPortalResumeToken(payload.resumeToken);
      if (resumePayload && resumePayload.email === payload.email) {
        portalParams += `&portal_action=resume_submission&submission_id=${resumePayload.submissionId}`;
      }
    }

    const response = NextResponse.json({ ok: true, redirectParams: portalParams });
    response.cookies.set(getProviderPortalCookieName(), signProviderPortalSession(payload.email), {
      ...getProviderPortalCookieOptions(),
      maxAge: 60 * 60 * 24 * 15,
    });
    return response;
  } catch (error) {
    console.error("[MFA Verify] Error:", error);
    return NextResponse.json({ ok: false, error: "Error en el servidor al verificar MFA" }, { status: 500 });
  }
}
