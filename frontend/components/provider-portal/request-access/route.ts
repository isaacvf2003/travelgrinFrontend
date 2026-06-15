import { NextResponse } from "next/server";
import { ensureSameOriginRequest } from "@/app/api/_lib/auth";
import { sendProviderPortalMagicLinkEmail } from "@/app/api/_lib/adminMail";
import { createProviderPortalMagicLink, getProviderPortalProfileName, portalEmailExists } from "@/app/api/_lib/providerPortal";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    await ensureSameOriginRequest();
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email ?? "").trim().toLowerCase();
    const locale = String(body?.locale ?? "es");

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ ok: false, error: "Email invalido." }, { status: 400 });
    }

    const exists = await portalEmailExists(email);
    if (exists) {
      const result = await createProviderPortalMagicLink(email);
      if (!result.throttled && result.link) {
        const recipientName = await getProviderPortalProfileName(email).catch(() => "");
        await sendProviderPortalMagicLinkEmail({ email, locale, magicLink: result.link, recipientName });
      }
    }

    return NextResponse.json({
      ok: true,
      message: "Si encontramos tu email, te enviamos un enlace seguro para entrar al mini panel.",
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "unknown" },
      { status: 500 },
    );
  }
}
