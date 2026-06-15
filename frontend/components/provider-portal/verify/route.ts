import { NextResponse } from "next/server";
import {
  consumeProviderPortalMagicLink,
  getFrontendBaseUrl,
  getProviderPortalCookieName,
  getProviderPortalCookieOptions,
  verifyProviderPortalResumeToken,
  signProviderPortalSession,
} from "@/app/api/_lib/providerPortal";

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

  let redirectTarget = buildRedirectUrl("ok");
  if (resumeToken) {
    const resumePayload = verifyProviderPortalResumeToken(resumeToken);
    if (!resumePayload || resumePayload.email !== email) {
      return NextResponse.redirect(buildRedirectUrl("invalid"));
    }
    redirectTarget = buildRedirectUrl("ok", {
      action: "resume_submission",
      submissionId: resumePayload.submissionId,
    });
  }

  const response = NextResponse.redirect(redirectTarget);
  response.cookies.set(getProviderPortalCookieName(), signProviderPortalSession(email), {
    ...getProviderPortalCookieOptions(),
    maxAge: 60 * 60 * 24 * 15,
  });
  return response;
}
