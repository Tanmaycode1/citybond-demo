import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { cookies } from "next/headers";
import { readObject, writeObject, ConflictError } from "./storage";
export const SESSION_COOKIE = "citybond_editor";
export const PORTAL_PATH = "/studio-7c9e";
const equal = (a: string, b: string) => {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
};
export function passwordHash(
  password: string,
  salt = randomBytes(16).toString("hex"),
) {
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function passwordMatches(password: string, hash: string) {
  const [salt, key] = hash.split(":");
  if (!salt || !key || password.length > 256) return false;
  return equal(passwordHash(password, salt), `${salt}:${key}`);
}
export function signSession(secret: string, now = Date.now()) {
  const payload = Buffer.from(
    JSON.stringify({
      exp: now + 8 * 60 * 60 * 1000,
      nonce: randomBytes(18).toString("hex"),
    }),
  ).toString("base64url");
  return (
    payload +
    "." +
    createHmac("sha256", secret).update(payload).digest("base64url")
  );
}
export function validSession(
  value: string | undefined,
  secret: string | undefined,
  now = Date.now(),
) {
  if (!value || !secret || secret.length < 32) return false;
  const [payload, signature, ...rest] = value.split(".");
  if (!payload || !signature || rest.length) return false;
  const expected = createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
  if (!equal(signature, expected)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return (
      typeof data.exp === "number" &&
      data.exp > now &&
      data.exp <= now + 8 * 60 * 60 * 1000
    );
  } catch {
    return false;
  }
}
export async function isEditor() {
  return validSession(
    (await cookies()).get(SESSION_COOKIE)?.value,
    process.env.CMS_SESSION_SECRET,
  );
}
export function assertOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin)
    throw new Error("Invalid request origin");
}
export async function allowAttempt(
  scope: string,
  ip: string,
  limit: number,
  windowMs: number,
) {
  const now = Date.now();
  const bucket = Math.floor(now / windowMs);
  const identifier = createHmac(
    "sha256",
    process.env.CMS_SESSION_SECRET || "local-dev-rate-limit",
  )
    .update(ip)
    .digest("hex")
    .slice(0, 24);
  const key = `limits/${scope}-${identifier}-${bucket}.json`;
  for (let i = 0; i < 3; i++) {
    const prior = await readObject<{ count: number }>(key);
    if ((prior?.data.count || 0) >= limit) return false;
    try {
      await writeObject(
        key,
        { count: (prior?.data.count || 0) + 1 },
        prior?.etag ?? null,
      );
      return true;
    } catch (e) {
      if (!(e instanceof ConflictError)) throw e;
    }
  }
  return false;
}
export function clientIp(request: Request) {
  return (request.headers.get("x-forwarded-for") || "local")
    .split(",")[0]
    .trim()
    .slice(0, 100);
}
