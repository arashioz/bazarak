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