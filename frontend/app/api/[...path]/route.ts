import { type NextRequest, NextResponse } from "next/server";
import { forwardApiRequest, missingBackendResponse } from "@/app/api/admin/auth/_lib/backend";
import { revalidateTag } from "next/cache";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function proxy(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  const requestPath = Array.isArray(path) ? path.join("/") : "";
  const search = request.nextUrl.search || "";
  const upstreamHeaders = new Headers(request.headers);
  upstreamHeaders.delete("host");
  upstreamHeaders.delete("connection");
  upstreamHeaders.delete("content-length");
  const backendResponse = await forwardApiRequest(`/api/${requestPath}${search}`, {
    method: request.method,
    headers: upstreamHeaders,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
    redirect: "manual",
  });

  if (!backendResponse) return missingBackendResponse();

  const headers = new Headers();
  backendResponse.headers.forEach((value, key) => {
    if (key.toLowerCase() === "content-encoding") return;
    headers.set(key, value);
  });

  const body = await backendResponse.arrayBuffer();

  if (backendResponse.status >= 200 && backendResponse.status < 300) {
    const method = request.method.toUpperCase();
    if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
      const lowerPath = requestPath.toLowerCase();
      try {
        if (lowerPath.includes("categories") || lowerPath.includes("category")) {
          revalidateTag("categories");
        }
        if (lowerPath.includes("filters") || lowerPath.includes("filter-groups") || lowerPath.includes("filter-options")) {
          revalidateTag("filters");
        }
        if (lowerPath.includes("publications") || lowerPath.includes("travel-services") || lowerPath.includes("provider-portal")) {
          revalidateTag("publications");
        }
      } catch (err) {
        console.error("[Proxy Revalidate] Error during proxy cache revalidation:", err);
      }
    }
  }

  return new NextResponse(body, {
    status: backendResponse.status,
    statusText: backendResponse.statusText,
    headers,
  });
}

export async function GET(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function OPTIONS(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}
