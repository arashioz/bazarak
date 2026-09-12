import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const ADMIN_SECRET = process.env.MAP_ADMIN_SECRET || 'super-secret-admin-key';
const DRIVER_SECRET = process.env.MAP_DRIVER_SECRET || 'super-secret-driver-key';

export async function signToken(payload: any, role: 'admin' | 'driver') {
  const secret = role === 'admin' ? ADMIN_SECRET : DRIVER_SECRET;
  return jwt.sign(payload, secret, { expiresIn: '8h' });
}

export async function verifyToken(req: NextRequest, role: 'admin' | 'driver') {
  const cookieName = role === 'admin' ? 'bazarek_map_admin_token' : 'bazarek_map_driver_token';
  const token = req.cookies.get(cookieName)?.value;

  if (!token) return null;

  const secret = role === 'admin' ? ADMIN_SECRET : DRIVER_SECRET;
  try {
    return jwt.verify(token, secret);
  } catch (e) {
    return null;
  }
}

// Mock Database functions (In real app, use MongoDB/Prisma)
// We use a global variable for simulation in this environment, 
// though in production this would be a real DB call.

const mockCustomers = [
  { id: '1', name: 'علی رضایی', phone: '09123456789', type: 'mobile-service', lat: 35.6892, lng: 51.3890, address: 'تهران، خیابان ولیعصر' },
  { id: '2', name: 'مغازه اسباب محمدی', phone: '09351234567', type: 'furniture', lat: 35.7000, lng: 51.4000, address: 'تهران، سعادت‌آباد' },
];

const mockSettings = {
  defaultCity: 'تهران',
  defaultLat: 35.6892,
  defaultLng: 51.3890
};

export async function getCustomers(type?: 'mobile-service' | 'furniture') {
  if (type) {
    return mockCustomers.filter(c => c.type === type);
  }
  return mockCustomers;
}

export async function addCustomer(customerData: any) {
  const newCustomer = { id: Date.now().toString(), ...customerData };
  // In real app: await db.collection('map_crm_customers').insertOne(newCustomer);
  return newCustomer;
}

export async function getSettings() {
  return mockSettings;
}

export async function updateSettings(newSettings: any) {
  // In real app: await db.collection('map_crm_settings').updateOne({}, { $set: newSettings });
  return newSettings;
}
 import { createHmac, timingSafeEqual } from "crypto";
 
 export const MAP_ADMIN_COOKIE = "bazarek_map_admin_token";
 export const MAP_DRIVER_COOKIE = "bazarek_map_driver_token";
 
 const secret = () => process.env.ADMIN_SESSION_SECRET || "bazarek-admin-session-change-this-secret";
 
 const signature = (value: string) => createHmac("sha256", secret()).update(value).digest("base64url");
 
 type TokenPayload = { sub: "admin" | "driver"; iat: number; exp: number };
 
 export const createMapToken = (role: "admin" | "driver") => {
   const now = Math.floor(Date.now() / 1000);
   const payload = Buffer.from(JSON.stringify({ sub: role, iat: now, exp: now + 60 * 60 * 12 } satisfies TokenPayload)).toString("base64url");
   return `${payload}.${signature(payload)}`;
 };
 
 export const isValidMapToken = (token?: string) => {
   if (!token) return false;
   const [payload, receivedSignature] = token.split(".");
   if (!payload || !receivedSignature) return false;
   let decoded: TokenPayload;
   try { decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as TokenPayload; } catch { return false; }
   if (!decoded.sub || !Number.isFinite(decoded.exp) || decoded.exp <= Math.floor(Date.now() / 1000)) return false;
   const expectedSignature = signature(payload);
   const received = Buffer.from(receivedSignature);
   const expected = Buffer.from(expectedSignature);
   return received.length === expected.length && timingSafeEqual(received, expected);
 };
 
 export const getMapRole = (token?: string) => {
   if (!token) return null;
   const [payload] = token.split(".");
   try {
     const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as TokenPayload;
     return decoded.sub;
   } catch {
     return null;
   }
 };