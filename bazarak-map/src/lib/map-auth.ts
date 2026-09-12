import { createHmac, timingSafeEqual } from "crypto";

export const MAP_ADMIN_COOKIE = "bazarek_map_admin_token";
export const MAP_DRIVER_COOKIE = "bazarek_map_driver_token";

const secret = () => process.env.MAP_SESSION_SECRET || "change-this-map-session-secret";
const signature = (value: string) => createHmac("sha256", secret()).update(value).digest("base64url");

type TokenPayload = { sub: "admin" | "driver"; iat: number; exp: number };

export const createMapToken = (role: TokenPayload["sub"]) => {
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ sub: role, iat: now, exp: now + 60 * 60 * 12 } satisfies TokenPayload)).toString("base64url");
  return `${payload}.${signature(payload)}`;
};

const payloadFor = (token?: string): TokenPayload | null => {
  if (!token) return null;
  const [payload, receivedSignature] = token.split(".");
  if (!payload || !receivedSignature) return null;
  const expected = Buffer.from(signature(payload));
  const received = Buffer.from(receivedSignature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as TokenPayload;
    return decoded.exp > Math.floor(Date.now() / 1000) ? decoded : null;
  } catch { return null; }
};

export const isValidMapToken = (token?: string) => Boolean(payloadFor(token));
export const getMapRole = (token?: string) => payloadFor(token)?.sub || null;
