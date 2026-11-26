import { NextRequest, NextResponse } from "next/server";
import {
  OTP_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  createSessionToken,
  verifyOtpChallengeToken,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  let body: { email?: string; otp?: string };
  try {
    body = (await req.json()) as { email?: string; otp?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = (body.email || "").trim().toLowerCase();
  const otp = (body.otp || "").trim();

  if (!email || !/^\d{6}$/.test(otp)) {
    return NextResponse.json(
      { error: "Please enter both your email and the 6-digit code." },
      { status: 400 }
    );
  }

  const challengeToken = req.cookies.get(OTP_COOKIE_NAME)?.value;
  const check = verifyOtpChallengeToken(challengeToken, email, otp);

  if (!check.valid) {
    return NextResponse.json(
      { error: check.reason || "Verification failed." },
      { status: 401 }
    );
  }

  const sessionToken = createSessionToken({
    email,
    name: email.split("@")[0],
    provider: "email",
  });

  const response = NextResponse.json({ ok: true, redirectTo: "/home" });
  response.cookies.set(SESSION_COOKIE_NAME, sessionToken, SESSION_COOKIE_OPTIONS);
  response.cookies.delete(OTP_COOKIE_NAME);
  return response;
}
