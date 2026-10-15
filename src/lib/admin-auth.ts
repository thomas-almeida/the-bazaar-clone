import "server-only";

import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export const ADMIN_COOKIE = "bazaar_admin_session";
const SESSION_LIFETIME_SECONDS = 8 * 60 * 60;

function sessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("ADMIN_SESSION_SECRET must contain at least 32 characters.");
  }
  return secret;
}

function signature(payload: string): string {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

export function verifyAdminPassword(candidate: unknown): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (typeof candidate !== "string" || candidate.length > 256 || !expected) return false;
  const candidateHash = createHash("sha256").update(candidate).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(candidateHash, expectedHash);
}

export function createAdminSession(): string {
  const expiry = Math.floor(Date.now() / 1000) + SESSION_LIFETIME_SECONDS;
  const payload = String(expiry);
  return `${payload}.${signature(payload)}`;
}

export function isAdminRequest(request: NextRequest): boolean {
  const token = request.cookies.get(ADMIN_COOKIE)?.value;
  if (!token) return false;
  const [payload, suppliedSignature, extra] = token.split(".");
  if (!payload || !suppliedSignature || extra !== undefined) return false;
  const expiry = Number(payload);
  if (!Number.isSafeInteger(expiry) || expiry <= Math.floor(Date.now() / 1000)) return false;

  const expectedSignature = signature(payload);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Admin authentication required." }, { status: 401 });
}

export { SESSION_LIFETIME_SECONDS };
