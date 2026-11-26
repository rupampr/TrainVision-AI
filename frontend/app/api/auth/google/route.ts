import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  OAUTH_STATE_COOKIE,
  getGoogleClientId,
  getGoogleClientSecret,
} from "@/lib/auth";

export async function GET(req: NextRequest) {
  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();
  const origin = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;

  if (!clientId || !clientSecret) {
    const errCode = !clientId ? "google_client_id_missing" : "google_client_secret_missing";
    return NextResponse.redirect(new URL(`/?error=${errCode}`, origin));
  }

  const state = crypto.randomBytes(24).toString("hex");
  const redirectUri = `${origin}/api/auth/google/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });

  const response = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );

  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 10,
  });

  return response;
}
