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
  if (configuredOrigins.includes("*") || configuredOrigins.includes(requestOrigin) || isLocalhost) {
    return requestOrigin;
  }

  return null;
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
  return response;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApiRequest = pathname.startsWith("/api/");

  if (isApiRequest && req.method === "OPTIONS") {
    return withCors(req, new NextResponse(null, { status: 204 }));
  }

  if (isApiRequest) {
    return withCors(req, NextResponse.next());
  }

  if (process.env.DEPLOY_TARGET === "backend") {
    return NextResponse.json(
      { ok: false, error: "Backend deployment: use /api/* endpoints." },
      { status: 404 },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
