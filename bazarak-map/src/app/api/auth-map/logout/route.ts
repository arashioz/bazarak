import { NextResponse } from "next/server";
import { MAP_ADMIN_COOKIE, MAP_DRIVER_COOKIE } from "../../../../lib/map-auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(MAP_ADMIN_COOKIE, "", { path: "/", maxAge: 0 });
  response.cookies.set(MAP_DRIVER_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
