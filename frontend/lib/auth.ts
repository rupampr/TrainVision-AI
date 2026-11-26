import crypto from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE_NAME = "tv_session";
export const OTP_COOKIE_NAME = "tv_otp";
export const OAUTH_STATE_COOKIE = "tv_oauth_state";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const OTP_TTL_SECONDS = 60 * 10; // 10 minutes

export interface AuthUser {
  email: string;
  name: string;
  picture?: string;
  provider: "google" | "email";
  exp: number;
}

function getAuthSecret(): string {
  const configured = process.env.AUTH_SECRET;
  if (configured && configured.length >= 16) {
    return configured;
  }
  // Deterministic dev fallback derived from existing project env or static dev string
  const fallbackSeed =
    process.env.GOOGLE_CLIENT_SECRET ||
    process.env.RESEND_API_KEY ||
    "trainvision-local-dev-auth-secret-change-in-prod";
  return crypto.createHash("sha256").update(fallbackSeed).digest("hex");
}

function sign(payloadB64: string): string {
  return crypto
    .createHmac("sha256", getAuthSecret())
    .update(payloadB64)
    .digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function getGoogleClientId(): string {
  return (
    process.env.GOOGLE_CLIENT_ID ||
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
    ""
  ).trim();
}

export function getGoogleClientSecret(): string {
  return (process.env.GOOGLE_CLIENT_SECRET || "").trim();
}

export function createSessionToken(
  user: Omit<AuthUser, "exp">,
  ttlSeconds: number = SESSION_TTL_SECONDS
): string {
  const payload: AuthUser = {
    ...user,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = sign(encoded);
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string | undefined | null): AuthUser | null {
  if (!token) return null;
  const dotIndex = token.indexOf(".");
  if (dotIndex <= 0) return null;

  const encoded = token.slice(0, dotIndex);
  const providedSig = token.slice(dotIndex + 1);
  const expectedSig = sign(encoded);

  if (!safeEqual(providedSig, expectedSig)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as AuthUser;
    if (!parsed.email || !parsed.exp) return null;
    if (parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

export function generateOtpCode(): string {
  return String(crypto.randomInt(100000, 1000000));
}

function hashOtp(email: string, otp: string, exp: number): string {
  return crypto
    .createHmac("sha256", getAuthSecret())
    .update(`${email.toLowerCase()}|${otp}|${exp}`)
    .digest("hex");
}

export function createOtpChallengeToken(email: string, otp: string): string {
  const normalizedEmail = email.trim().toLowerCase();
  const exp = Math.floor(Date.now() / 1000) + OTP_TTL_SECONDS;
  const digest = hashOtp(normalizedEmail, otp, exp);
  const encoded = Buffer.from(
    JSON.stringify({ email: normalizedEmail, exp, digest }),
    "utf8"
  ).toString("base64url");
  const sig = sign(encoded);
  return `${encoded}.${sig}`;
}

export function verifyOtpChallengeToken(
  token: string | undefined | null,
  email: string,
  otp: string
): { valid: boolean; reason?: string } {
  if (!token) {
    return { valid: false, reason: "No active verification challenge. Request a new code." };
  }
  const dotIndex = token.indexOf(".");
  if (dotIndex <= 0) {
    return { valid: false, reason: "Invalid verification token." };
  }

  const encoded = token.slice(0, dotIndex);
  const providedSig = token.slice(dotIndex + 1);
  if (!safeEqual(providedSig, sign(encoded))) {
    return { valid: false, reason: "Invalid verification signature." };
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as { email: string; exp: number; digest: string };

    const normalizedEmail = email.trim().toLowerCase();
    if (parsed.email !== normalizedEmail) {
      return { valid: false, reason: "Email does not match the verification request." };
    }
    if (parsed.exp < Math.floor(Date.now() / 1000)) {
      return { valid: false, reason: "Verification code expired. Please request a new one." };
    }

    const expectedDigest = hashOtp(normalizedEmail, otp.trim(), parsed.exp);
    if (!safeEqual(parsed.digest, expectedDigest)) {
      return { valid: false, reason: "Incorrect 6-digit verification code." };
    }

    return { valid: true };
  } catch {
    return { valid: false, reason: "Malformed verification challenge." };
  }
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: SESSION_TTL_SECONDS,
};
