import "server-only";

import { cookies } from "next/headers";
import { createHmac, createHash, timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_COOKIE = "roam_and_nest_admin";
const SESSION_LIFETIME_SECONDS = 60 * 60 * 12;

function constantTimeEqual(left: string, right: string): boolean {
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

function paddedBuffer(value: string, targetLength: number): Buffer {
  const buffer = Buffer.alloc(targetLength, 0);
  const source = Buffer.from(value, "utf8");
  const length = Math.min(source.length, targetLength);
  source.copy(buffer, 0, 0, length);
  return buffer;
}

function secureEqual(left: string, right: string): boolean {
  const targetLength = Math.max(left.length, right.length);
  return timingSafeEqual(paddedBuffer(left, targetLength), paddedBuffer(right, targetLength));
}

function sessionSignature(expiresAt: string, password: string): string {
  return createHmac("sha256", password)
    .update(`roam-and-nest-admin:${expiresAt}`)
    .digest("hex");
}

export function isAdminPasswordValid(candidate: string): boolean {
  const configuredPassword = process.env.ADMIN_PASSWORD?.trim();
  if (!configuredPassword) return false;
  if (process.env.NODE_ENV === "production" && configuredPassword === "changeme123") {
    return false;
  }
  return secureEqual(candidate, configuredPassword);
}

export async function isAdminRequestAuthorized(request?: Request): Promise<boolean> {
  const headerPassword = request?.headers.get("x-admin-password");
  if (headerPassword) return isAdminPasswordValid(headerPassword);

  const cookieStore = await cookies();
  return isAdminSessionValid(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
}

export function createAdminSession(): string | null {
  const password = process.env.ADMIN_PASSWORD;
  if (!password || (process.env.NODE_ENV === "production" && password === "changeme123")) {
    return null;
  }
  const expiresAt = String(Math.floor(Date.now() / 1000) + SESSION_LIFETIME_SECONDS);
  return `${expiresAt}.${sessionSignature(expiresAt, password)}`;
}

export function isAdminSessionValid(value?: string): boolean {
  const password = process.env.ADMIN_PASSWORD;
  if (!value || !password) return false;
  if (process.env.NODE_ENV === "production" && password === "changeme123") return false;

  const [expiresAt, signature, extra] = value.split(".");
  if (!expiresAt || !signature || extra || !/^\d+$/.test(expiresAt)) return false;
  if (Number(expiresAt) <= Math.floor(Date.now() / 1000)) return false;
  return constantTimeEqual(signature, sessionSignature(expiresAt, password));
}

export const ADMIN_SESSION_MAX_AGE = SESSION_LIFETIME_SECONDS;
