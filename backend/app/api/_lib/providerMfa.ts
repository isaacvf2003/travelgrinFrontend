import crypto from "crypto";
import jwt from "jsonwebtoken";
import { prisma } from "@/app/lib/prisma";

const MFA_SECRET_KEY = process.env.PROVIDER_PORTAL_JWT_SECRET?.trim() || process.env.ADMIN_JWT_SECRET || "travelgrin-provider-portal-2026";

const ENCRYPTION_KEY = crypto.createHash("sha256").update(
  process.env.DATABASE_ENCRYPTION_KEY || MFA_SECRET_KEY
).digest();

function encryptText(text: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

function decryptText(encryptedText: string): string {
  try {
    const parts = encryptedText.split(":");
    if (parts.length !== 3) {
      return encryptedText;
    }
    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    return encryptedText;
  }
}

function base32Decode(base32: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const cleaned = base32.replace(/=+$/, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < cleaned.length; i++) {
    const idx = alphabet.indexOf(cleaned[i]);
    if (idx === -1) throw new Error("Invalid base32 character");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateTOTP(secret: string, timeStep = Math.floor(Date.now() / 1000 / 30)): string {
  const key = base32Decode(secret);
  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64BE(BigInt(timeStep), 0);

  const hmac = crypto.createHmac("sha1", key).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const totp = code % 1_000_000;
  return String(totp).padStart(6, "0");
}

export function verifyTOTP(code: string, secret: string, window = 1): boolean {
  const currentStep = Math.floor(Date.now() / 1000 / 30);
  for (let i = -window; i <= window; i++) {
    if (generateTOTP(secret, currentStep + i) === code) {
      return true;
    }
  }
  return false;
}

export function generateBase32Secret(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bytes = crypto.randomBytes(10); // 80 bits entropy
  let secret = "";
  let value = 0;
  let bits = 0;
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      secret += alphabet[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  return secret;
}

export async function ensureProviderMfaTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS provider_mfa_settings (
      email TEXT PRIMARY KEY,
      mfa_secret TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

export async function getProviderMfaSecret(email: string): Promise<string | null> {
  try {
    await ensureProviderMfaTable();
    const normalized = email.trim().toLowerCase();
    const rows = await prisma.$queryRawUnsafe<Array<{ mfa_secret: string }>>(
      `SELECT mfa_secret FROM provider_mfa_settings WHERE email = $1 LIMIT 1`,
      normalized,
    );
    const rawSecret = rows[0]?.mfa_secret || null;
    if (!rawSecret) return null;
    return decryptText(rawSecret);
  } catch (err) {
    console.error("[getProviderMfaSecret] Database query failed:", err);
    return null;
  }
}

export async function saveProviderMfaSecret(email: string, secret: string): Promise<void> {
  await ensureProviderMfaTable();
  const normalized = email.trim().toLowerCase();
  const encryptedSecret = encryptText(secret);
  await prisma.$executeRawUnsafe(
    `
      INSERT INTO provider_mfa_settings (email, mfa_secret, created_at, updated_at)
      VALUES ($1, $2, NOW(), NOW())
      ON CONFLICT (email) DO UPDATE
      SET mfa_secret = EXCLUDED.mfa_secret,
          updated_at = NOW()
    `,
    normalized,
    encryptedSecret,
  );
}

// Temporary token generation
export function createMfaSetupToken(email: string, tempSecret: string, resumeToken?: string): string {
  return jwt.sign(
    { email: email.trim().toLowerCase(), tempSecret, resumeToken, purpose: "provider-mfa-setup" },
    MFA_SECRET_KEY,
    { expiresIn: "10m" },
  );
}

export function verifyMfaSetupToken(token: string) {
  try {
    const payload = jwt.verify(token, MFA_SECRET_KEY) as Record<string, unknown>;
    if (payload.purpose !== "provider-mfa-setup") return null;
    return {
      email: String(payload.email),
      tempSecret: String(payload.tempSecret),
      resumeToken: payload.resumeToken ? String(payload.resumeToken) : undefined,
    };
  } catch {
    return null;
  }
}

export function createMfaVerifyToken(email: string, resumeToken?: string): string {
  return jwt.sign(
    { email: email.trim().toLowerCase(), resumeToken, purpose: "provider-mfa-verify" },
    MFA_SECRET_KEY,
    { expiresIn: "10m" },
  );
}

export function verifyMfaVerifyToken(token: string) {
  try {
    const payload = jwt.verify(token, MFA_SECRET_KEY) as Record<string, unknown>;
    if (payload.purpose !== "provider-mfa-verify") return null;
    return {
      email: String(payload.email),
      resumeToken: payload.resumeToken ? String(payload.resumeToken) : undefined,
    };
  } catch {
    return null;
  }
}
