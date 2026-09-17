import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

const COOKIE_NAME = "tg_plan_session";

function getSessionId(request: NextRequest) {
  return request.cookies.get(COOKIE_NAME)?.value ?? null;
}

function ensureSessionId(request: NextRequest, response: NextResponse, sessionId: string) {
  const existing = getSessionId(request);
  if (existing) return existing;
  response.cookies.set(COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return sessionId;
}

export async function GET(request: NextRequest) {
  const existing = getSessionId(request);
  const sessionId = existing ?? crypto.randomUUID();
  const items = await prisma.planItem.findMany({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
  });
  const response = NextResponse.json({ items });
  ensureSessionId(request, response, sessionId);
  return response;
}

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  const sessionId = ensureSessionId(request, response, crypto.randomUUID());
  const body = await request.json().catch(() => ({}));
  const publicationId = String(body?.publicationId ?? "").trim();
  const title = String(body?.title ?? "").trim();
  if (!publicationId || !title) {
    return NextResponse.json({ error: "publicationId y title son requeridos" }, { status: 400 });
  }
  await prisma.planItem.upsert({
    where: { sessionId_publicationId: { sessionId, publicationId } },
    create: {
      sessionId,
      publicationId,
      title,
      imageUrl: body?.imageUrl ? String(body.imageUrl) : null,
      price: body?.price ? String(body.price) : null,
      currency: body?.currency ? String(body.currency) : null,
      pricePeriod: body?.pricePeriod ? String(body.pricePeriod) : null,
    },
    update: {
      title,
      imageUrl: body?.imageUrl ? String(body.imageUrl) : null,
      price: body?.price ? String(body.price) : null,
      currency: body?.currency ? String(body.currency) : null,
      pricePeriod: body?.pricePeriod ? String(body.pricePeriod) : null,
    },
  });
  return response;
}

export async function DELETE(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  const sessionId = ensureSessionId(request, response, crypto.randomUUID());
  const body = await request.json().catch(() => ({}));
  const publicationId = String(body?.publicationId ?? "").trim();
  if (!publicationId) {
    return NextResponse.json({ error: "publicationId es requerido" }, { status: 400 });
  }
  await prisma.planItem.deleteMany({
    where: { sessionId, publicationId },
  });
  return response;
}
