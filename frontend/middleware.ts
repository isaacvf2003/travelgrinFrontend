import { NextRequest, NextResponse } from "next/server";

function parseOrigins(value?: string) {
  return (value || "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

function getAllowedCorsOrigin(req: NextRequest) {
  const requestOrigin = req.headers.get("origin")?.replace(/\/$/, "");
  if (!requestOrigin) return null;

  const configuredOrigins = parseOrigins(
    process.env.API_CORS_ORIGINS || process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL,
  );

  const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(requestOrigin);
  const allowWildcard = process.env.NODE_ENV !== "production" && configuredOrigins.includes("*");
  if (allowWildcard || configuredOrigins.includes(requestOrigin) || isLocalhost) {
    return requestOrigin;
  }

  return null;
}

function addSecurityHeaders(response: NextResponse) {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://www.clarity.ms",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https: https://res.cloudinary.com https://flagcdn.com",
      "font-src 'self' data:",
      "connect-src 'self' https: https://www.google-analytics.com https://www.clarity.ms",
      "frame-src 'self' https:",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  );
  return response;
}

function withCors(req: NextRequest, response: NextResponse) {
  const allowedOrigin = getAllowedCorsOrigin(req);
  if (!allowedOrigin) return response;

  response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  response.headers.set(
    "Access-Control-Allow-Headers",
    req.headers.get("access-control-request-headers") || "Content-Type, Authorization",
  );
  response.headers.append("Vary", "Origin");
  return addSecurityHeaders(response);
}

function shouldNoStore(pathname: string) {
  return (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/panel-oferente") ||
    pathname.startsWith("/api/admin/") ||
    pathname.startsWith("/api/provider-portal/") ||
    pathname.startsWith("/api/payments/") ||
    pathname === "/api/travel-services" ||
    pathname === "/api/reports"
  );
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApiRequest = pathname.startsWith("/api/");

  if (isApiRequest && req.method === "OPTIONS") {
    return withCors(req, new NextResponse(null, { status: 204 }));
  }

  if (isApiRequest) {
    const response = withCors(req, NextResponse.next());
    if (shouldNoStore(pathname)) response.headers.set("Cache-Control", "no-store");
    return response;
  }

  if (process.env.DEPLOY_TARGET === "backend") {
    return addSecurityHeaders(NextResponse.json(
      { ok: false, error: "Backend deployment: use /api/* endpoints." },
      { status: 404 },
    ));
  }

  const response = addSecurityHeaders(NextResponse.next());
  if (shouldNoStore(pathname)) response.headers.set("Cache-Control", "no-store");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
