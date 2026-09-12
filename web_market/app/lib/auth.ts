import { createHmac, timingSafeEqual } from "crypto";

export const ADMIN_COOKIE = "bazarek_admin_token";

const secret = () => process.env.ADMIN_SESSION_SECRET || "bazarek-admin-session-change-this-secret";
const password = () => process.env.ADMIN_PASSWORD || "Admin1405!";

const signature = (value: string) => createHmac("sha256", secret()).update(value).digest("base64url");
type TokenPayload = { sub: "admin"; iat: number; exp: number };

export const validAdminPassword = (value: string) => {
  const expected = Buffer.from(password());
  const received = Buffer.from(value);
  return expected.length === received.length && timingSafeEqual(expected, received);
};

export const createAdminToken = () => {
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ sub: "admin", iat: now, exp: now + 60 * 60 * 12 } satisfies TokenPayload)).toString("base64url");
  return `${payload}.${signature(payload)}`;
};

export const isValidAdminToken = (token?: string) => {
  if (!token) return false;
  const [payload, receivedSignature] = token.split(".");
  if (!payload || !receivedSignature) return false;
  let decoded: TokenPayload;
  try { decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as TokenPayload; } catch { return false; }
  if (decoded.sub !== "admin" || !Number.isFinite(decoded.exp) || decoded.exp <= Math.floor(Date.now() / 1000)) return false;
  const expectedSignature = signature(payload);
  const received = Buffer.from(receivedSignature);
  const expected = Buffer.from(expectedSignature);
  return received.length === expected.length && timingSafeEqual(received, expected);
};
