import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, createAdminToken, validAdminPassword } from "@/app/lib/auth";

export async function POST(request: NextRequest) {
  const { password } = await request.json().catch(() => ({}));
  if (!validAdminPassword(String(password || ""))) {
    return NextResponse.json({ error: "invalid credentials" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  // The current server is also reachable over plain HTTP. A Secure cookie is
  // rejected by browsers on HTTP, which would immediately lose the session.
  const secure = request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
  response.cookies.set(ADMIN_COOKIE, createAdminToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return response;
}
