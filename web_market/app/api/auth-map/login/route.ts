import { NextRequest, NextResponse } from 'next/server';
import { signToken } from '../../../lib/auth-map-utils';

export async function POST(req: NextRequest) {
  try {
    const { username, password, role } = await req.json();

    const isValid = 
      (role === 'admin' && username === 'admin' && password === 'admin123') ||
      (role === 'driver' && username === 'driver' && password === 'driver123');

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = await signToken({ username, role }, role);
    const response = NextResponse.json({ success: true, role });

    const cookieName = role === 'admin' ? 'bazarek_map_admin_token' : 'bazarek_map_driver_token';
    response.cookies.set(cookieName, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });

    return response;
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { signToken } from '../../../lib/auth-map-utils';

export async function POST(req: NextRequest) {
  try {
    const { username, password, role } = await req.json();

    // Hardcoded for testing as per request
    const isValid = 
      (role === 'admin' && username === 'admin' && password === 'admin123') ||
      (role === 'driver' && username === 'driver' && password === 'driver123');

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = await signToken({ username, role }, role);
    const response = NextResponse.json({ success: true, role });

    const cookieName = role === 'admin' ? 'bazarek_map_admin_token' : 'bazarek_map_driver_token';
    response.cookies.set(cookieName, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });

    return response;
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
 import { NextRequest, NextResponse } from "next/server";
 import { createMapToken } from "@/app/lib/auth-map-utils";
 import { MAP_ADMIN_COOKIE, MAP_DRIVER_COOKIE } from "@/app/lib/auth-map-utils";
 
 // Note: For now, we use the same admin password for simplicity, 
 // but in a real scenario, we'd have a separate table/collection for auth-map users.
 // We will implement the driver logic as well.
 
 export async function POST(request: NextRequest) {
   try {
     const { username, password, role } = await request.json().catch(() => ({}));
 
     // In a real implementation, we would check this against a 'map_users' collection in MongoDB.
     // For this initial setup, we'll simulate with a simple check.
     if (password !== "Admin1405!" && password !== "Driver1405!") {
       return NextResponse.json({ error: "invalid credentials" }, { status: 401 });
     }
 
     if (role !== "admin" && role !== "driver") {
       return NextResponse.json({ error: "invalid role" }, { status: 400 });
     }
 
     const token = createMapToken(role);
     const response = NextResponse.json({ ok: true, role });
 
     const cookieName = role === "admin" ? MAP_ADMIN_COOKIE : MAP_DRIVER_COOKIE;
 
     response.cookies.set(cookieName, token, {
       httpOnly: true,
       sameSite: "lax",
       secure: process.env.NODE_ENV === "production",
       path: "/",
       maxAge: 60 * 60 * 12,
     });
 
     return response;
   } catch (error) {
     return NextResponse.json({ error: "internal server error" }, { status: 500 });
   }
 }
