import { NextResponse } from "next/server";
import {
  consumeProviderPortalMagicLink,
  getFrontendBaseUrl,
  verifyProviderPortalResumeToken,
} from "@/app/api/_lib/providerPortal";
import {
  getProviderMfaSecret,
  generateBase32Secret,
  createMfaSetupToken,
  createMfaVerifyToken,
} from "@/app/api/_lib/providerMfa";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function buildRedirectUrl(
  status: "ok" | "invalid",
  params?: { action?: "resume_submission"; submissionId?: string },
) {
  const baseUrl = getFrontendBaseUrl();
  const redirectUrl = new URL(`${baseUrl || ""}/panel-oferente`);
  redirectUrl.searchParams.set("portal_status", status);
  if (params?.action) redirectUrl.searchParams.set("portal_action", params.action);
  if (params?.submissionId) redirectUrl.searchParams.set("submission_id", params.submissionId);
  return redirectUrl.toString();
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = String(url.searchParams.get("token") ?? "").trim();
  const resumeToken = String(url.searchParams.get("resume") ?? "").trim();
  if (!token) {
    return NextResponse.redirect(buildRedirectUrl("invalid"));
  }

  const email = await consumeProviderPortalMagicLink(token);
  if (!email) {
    return NextResponse.redirect(buildRedirectUrl("invalid"));
  }

  if (resumeToken) {
    const resumePayload = verifyProviderPortalResumeToken(resumeToken);
    if (!resumePayload || resumePayload.email !== email) {
      return NextResponse.redirect(buildRedirectUrl("invalid"));
    }
  }

  const mfaSecret = await getProviderMfaSecret(email);
  const baseUrl = getFrontendBaseUrl();

  if (!mfaSecret) {
    const tempSecret = generateBase32Secret();
    const setupToken = createMfaSetupToken(email, tempSecret, resumeToken || undefined);
    const mfaRedirect = new URL(`${baseUrl || ""}/panel-oferente`);
    mfaRedirect.searchParams.set("mfa_action", "setup");
    mfaRedirect.searchParams.set("mfa_token", setupToken);
    return NextResponse.redirect(mfaRedirect.toString());
  } else {
    const verifyToken = createMfaVerifyToken(email, resumeToken || undefined);
    const mfaRedirect = new URL(`${baseUrl || ""}/panel-oferente`);
    mfaRedirect.searchParams.set("mfa_action", "verify");
    mfaRedirect.searchParams.set("mfa_token", verifyToken);
    return NextResponse.redirect(mfaRedirect.toString());
  }
}
