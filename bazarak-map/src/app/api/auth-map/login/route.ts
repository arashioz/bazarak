import { NextRequest, NextResponse } from "next/server";
import { createMapToken, MAP_ADMIN_COOKIE, MAP_DRIVER_COOKIE } from "../../../../lib/map-auth";

const credentials = () => ({
  admin: {
    username: process.env.MAP_ADMIN_USERNAME || "admin",
    password: process.env.MAP_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || "Admin1405!",
  },
  driver: {
    username: process.env.MAP_DRIVER_USERNAME || "driver",
    password: process.env.MAP_DRIVER_PASSWORD || "Driver1405!",
  },
});

export async function POST(request: NextRequest) {
  const { username, password } = await request.json() as { username?: string; password?: string };
  const accounts = credentials();
  const role = Object.entries(accounts).find(([, account]) => account.username === username && account.password === password)?.[0] as "admin" | "driver" | undefined;
  if (!role) return NextResponse.json({ message: "نام کاربری یا رمز عبور نادرست است." }, { status: 401 });

  const response = NextResponse.json({ user: { username, role } });
  response.cookies.set(role === "admin" ? MAP_ADMIN_COOKIE : MAP_DRIVER_COOKIE, createMapToken(role), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return response;
}
