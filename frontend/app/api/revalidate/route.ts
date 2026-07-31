import { type NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

function handleRevalidate(request: NextRequest) {
  try {
    const secret = request.nextUrl.searchParams.get("secret");
    const headerSecret = request.headers.get("x-revalidate-token");
    const expectedSecret = process.env.REVALIDATE_SECRET || "supersecret";

    if (secret !== expectedSecret && headerSecret !== expectedSecret) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const tag = request.nextUrl.searchParams.get("tag");
    if (!tag) {
      return NextResponse.json({ ok: false, error: "Missing tag parameter" }, { status: 400 });
    }

    revalidateTag(tag);
    return NextResponse.json({ ok: true, revalidated: tag, now: Date.now() });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return handleRevalidate(request);
}

export async function POST(request: NextRequest) {
  return handleRevalidate(request);
}
