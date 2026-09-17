import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getAdminFromCookie } from "@/app/api/_lib/auth";
import { z } from "zod";

const Body = z.object({
  publicationId: z.string().min(1),
  provider: z.enum(["mercadopago", "dlocalgo"]).default("mercadopago"),
  amount: z.string().optional(),
  currency: z.string().optional(),
});

export async function POST(req: Request) {
  // For MVP, only admin can start payments.
  const admin = getAdminFromCookie();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = Body.parse(await req.json());

  const payment = await prisma.publicationPayment.create({
    data: {
      publicationId: body.publicationId,
      provider: body.provider,
      status: "pending",
      amount: body.amount,
      currency: body.currency,
    },
  });

  // TODO: integrate Mercado Pago / dLocal Go here
  // return a redirect url or an externalId
  return NextResponse.json({ ok: true, paymentId: payment.id, redirectUrl: null });
}
