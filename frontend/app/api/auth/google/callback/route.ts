import { NextRequest, NextResponse } from "next/server";
import {
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  createSessionToken,
  getGoogleClientId,
  getGoogleClientSecret,
} from "@/lib/auth";

export async function GET(req: NextRequest) {
  const origin = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const oauthError = req.nextUrl.searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(oauthError)}`, origin)
    );
  }

  const savedState = req.cookies.get(OAUTH_STATE_COOKIE)?.value;
  if (!code || !state || !savedState || state !== savedState) {
    return NextResponse.redirect(new URL("/?error=invalid_oauth_state", origin));
  }

  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/?error=google_not_configured", origin));
  }

  const redirectUri = `${origin}/api/auth/google/callback`;

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      return NextResponse.redirect(new URL("/?error=google_token_exchange_failed", origin));
    }

    const tokenData = (await tokenRes.json()) as { access_token?: string };
    if (!tokenData.access_token) {
      return NextResponse.redirect(new URL("/?error=missing_access_token", origin));
    }

    const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userRes.ok) {
      return NextResponse.redirect(new URL("/?error=google_userinfo_failed", origin));
    }

    const profile = (await userRes.json()) as {
      email?: string;
      email_verified?: boolean;
      name?: string;
      picture?: string;
    };

    if (!profile.email || profile.email_verified === false) {
      return NextResponse.redirect(new URL("/?error=google_email_unverified", origin));
    }

    const sessionToken = createSessionToken({
      email: profile.email.toLowerCase(),
      name: profile.name || profile.email.split("@")[0],
      picture: profile.picture,
      provider: "google",
    });

    const response = NextResponse.redirect(new URL("/home", origin));
    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, SESSION_COOKIE_OPTIONS);
    response.cookies.delete(OAUTH_STATE_COOKIE);
    return response;
  } catch {
    return NextResponse.redirect(new URL("/?error=google_auth_exception", origin));
  }
}
