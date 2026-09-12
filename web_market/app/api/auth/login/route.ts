import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, createAdminToken, validAdminPassword } from "@/app/lib/auth";

export async function POST(request: NextRequest) {
  const { password } = await request.json().catch(() => ({}));
  if (!validAdminPassword(String(password || ""))) {
    return NextResponse.json({ error: "invalid credentials" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, createAdminToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return response;
}
