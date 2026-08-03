import { NextResponse } from "next/server";
import {
  verifyMfaSetupToken,
  verifyTOTP,
  saveProviderMfaSecret,
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

    const payload = verifyMfaSetupToken(mfaToken);
    if (!payload) {
      return NextResponse.json({ ok: false, error: "Token de configuración inválido o vencido." }, { status: 400 });
    }

    const cleanedCode = String(code).trim().replace(/\s/g, "");
    const isValid = verifyTOTP(cleanedCode, payload.tempSecret);
    if (!isValid) {
      return NextResponse.json({ ok: false, error: "Código de verificación incorrecto. Intenta de nuevo." }, { status: 400 });
    }

    await saveProviderMfaSecret(payload.email, payload.tempSecret);

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
    console.error("[MFA Register] Error:", error);
    return NextResponse.json({ ok: false, error: "Error en el servidor al configurar MFA" }, { status: 500 });
  }
}
