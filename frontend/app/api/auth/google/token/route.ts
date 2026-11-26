import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  createSessionToken,
  getGoogleClientId,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  const clientId = getGoogleClientId();
  if (!clientId) {
    return NextResponse.json(
      { error: "GOOGLE_CLIENT_ID is not configured on the server." },
      { status: 503 }
    );
  }

  let body: { credential?: string };
  try {
    body = (await req.json()) as { credential?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const credential = body.credential?.trim();
  if (!credential) {
    return NextResponse.json({ error: "Missing Google credential token" }, { status: 400 });
  }

  try {
    const verifyRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
    );
    if (!verifyRes.ok) {
      return NextResponse.json({ error: "Google token verification failed" }, { status: 401 });
    }

    const info = (await verifyRes.json()) as {
      aud?: string;
      iss?: string;
      exp?: string;
      email?: string;
      email_verified?: string | boolean;
      name?: string;
      picture?: string;
    };

    const validIssuer =
      info.iss === "https://accounts.google.com" || info.iss === "accounts.google.com";
    const validAudience = info.aud === clientId;
    const validExpiry = Number(info.exp || 0) > Math.floor(Date.now() / 1000);
    const emailVerified = info.email_verified === true || info.email_verified === "true";

    if (!validIssuer || !validAudience || !validExpiry || !info.email || !emailVerified) {
      return NextResponse.json({ error: "Invalid or expired Google ID token" }, { status: 401 });
    }

    const sessionToken = createSessionToken({
      email: info.email.toLowerCase(),
      name: info.name || info.email.split("@")[0],
      picture: info.picture,
      provider: "google",
    });

    const response = NextResponse.json({ ok: true, redirectTo: "/home" });
    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, SESSION_COOKIE_OPTIONS);
    return response;
  } catch {
    return NextResponse.json({ error: "Failed to verify Google credential" }, { status: 500 });
  }
}
