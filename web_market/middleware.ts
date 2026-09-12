import { NextRequest, NextResponse } from "next/server";

const publicPaths = ["/catalog", "/modir/login", "/api/catalog", "/api/auth/login"];

const secret = () => process.env.ADMIN_SESSION_SECRET || "bazarek-admin-session-change-this-secret";
const decode = (value: string) => {
  try { const base64 = value.replace(/-/g, "+").replace(/_/g, "/"); return JSON.parse(atob(base64.padEnd(base64.length + ((4 - base64.length % 4) % 4), "="))) as { sub?: string; exp?: number }; } catch { return null; }
};
const validToken = async (token?: string) => {
  if (!token) return false;
  const [payload, signature] = token.split(".");
  const data = payload && signature ? decode(payload) : null;
  if (!payload || !signature || data?.sub !== "admin" || !data.exp || data.exp <= Math.floor(Date.now() / 1000)) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
  const expectedSignature = btoa(String.fromCharCode(...expected)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return expectedSignature === signature;
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (publicPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`))) return NextResponse.next();
  if (await validToken(request.cookies.get("bazarek_admin_token")?.value)) return NextResponse.next();

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/modir/login";
  loginUrl.search = "";
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
