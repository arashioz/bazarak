import { NextRequest, NextResponse } from "next/server";
import { createMapToken, MAP_ADMIN_COOKIE, MAP_DRIVER_COOKIE } from "@/app/lib/auth-map-utils";

type Role = "admin" | "driver";

export async function POST(request: NextRequest) {
  try {
    const { username, password, role: requestedRole } = await request.json() as { username?: string; password?: string; role?: Role };
    const role: Role | null = requestedRole === "admin" || requestedRole === "driver"
      ? requestedRole
      : username === "driver" ? "driver" : username === "admin" ? "admin" : null;
    if (!role) return NextResponse.json({ error: "invalid role" }, { status: 400 });

    const expectedUsername = role === "admin" ? process.env.MAP_ADMIN_USERNAME || "admin" : process.env.MAP_DRIVER_USERNAME || "driver";
    const expectedPassword = role === "admin" ? process.env.MAP_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || "Admin1405!" : process.env.MAP_DRIVER_PASSWORD || "Driver1405!";
    if (username !== expectedUsername || password !== expectedPassword) {
      return NextResponse.json({ error: "invalid credentials" }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true, user: { username, role } });
    response.cookies.set(role === "admin" ? MAP_ADMIN_COOKIE : MAP_DRIVER_COOKIE, createMapToken(role), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    return response;
  } catch {
    return NextResponse.json({ error: "invalid login request" }, { status: 400 });
  }
}
