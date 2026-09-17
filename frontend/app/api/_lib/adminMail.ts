import { getAdminMailFrom, getResendApiKey } from "@/app/lib/adminSecurity";

export async function sendAdminPasswordResetCode(params: { email: string; code: string }) {
  const apiKey = getResendApiKey();
  if (!apiKey) {
    throw new Error("Missing RESEND_API_KEY for password reset emails");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: getAdminMailFrom(),
      to: [params.email],
      subject: "Codigo para cambiar tu contrasena de TravelGrin",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
          <div style="font-size:28px;font-weight:700;color:#0f172a;margin-bottom:20px">TravelGrin</div>
          <h1 style="font-size:24px;margin:0 0 12px">Cambio de contrasena</h1>
          <p style="font-size:16px;line-height:1.5;margin:0 0 12px">
            Recibimos una solicitud para cambiar la contrasena del panel admin.
          </p>
          <p style="font-size:16px;line-height:1.5;margin:0 0 16px">
            Tu codigo de verificacion es:
          </p>
          <div style="font-size:32px;font-weight:700;letter-spacing:8px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:16px;padding:18px;text-align:center;margin-bottom:18px">
            ${params.code}
          </div>
          <p style="font-size:14px;line-height:1.5;color:#475569">
            El codigo vence en 15 minutos. Si no solicitaste este cambio, ignora este mensaje.
          </p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(body || "Password reset email failed");
  }
}
