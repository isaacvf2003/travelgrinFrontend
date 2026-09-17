import { NextResponse } from "next/server";
import { getAdminFromCookie } from "./auth";

export function requireAdmin() {
  const admin = getAdminFromCookie();
  if (!admin) {
    return { admin: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { admin, error: null };
}
