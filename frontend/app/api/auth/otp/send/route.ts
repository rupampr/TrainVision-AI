import { NextRequest, NextResponse } from "next/server";
import {
  OTP_COOKIE_NAME,
  createOtpChallengeToken,
  generateOtpCode,
} from "@/lib/auth";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  let body: { email?: string };
  try {
    body = (await req.json()) as { email?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = (body.email || "").trim().toLowerCase();
  if (!EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  const resendApiKey = (process.env.RESEND_API_KEY || "").trim();
  if (!resendApiKey) {
    return NextResponse.json(
      { error: "RESEND_API_KEY is not configured in frontend/.env." },
      { status: 503 }
    );
  }

  const otp = generateOtpCode();
  const fromEmail =
    (process.env.RESEND_FROM_EMAIL || "").trim() ||
    "TrainVision AI <onboarding@resend.dev>";

  try {
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject: `${otp} is your TrainVision AI verification code`,
        text: `Your TrainVision AI sign-in code is: ${otp}\n\nThis code expires in 10 minutes. If you did not request this, you can safely ignore this email.`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#0b0f17; color:#f8fafc; padding:32px; border-radius:12px; max-width:480px; margin:0 auto;">
            <p style="font-size:12px; letter-spacing:0.15em; text-transform:uppercase; color:#22d3ee; margin:0 0 8px;">TrainVision AI</p>
            <h2 style="margin:0 0 12px; font-size:20px; color:#f8fafc;">Your verification code</h2>
            <p style="margin:0 0 24px; font-size:14px; color:#94a3b8; line-height:1.5;">
              Enter the 6-digit code below to sign in to the Railway Operations Control Center. This code expires in 10 minutes.
            </p>
            <div style="background:#111827; border:1px solid #1e293b; border-radius:10px; padding:18px; text-align:center; font-family:monospace; font-size:32px; font-weight:700; letter-spacing:8px; color:#22d3ee;">
              ${otp}
            </div>
            <p style="margin:24px 0 0; font-size:12px; color:#64748b;">
              If you did not request this login code, please ignore this email.
            </p>
          </div>
        `,
      }),
    });

    if (!resendRes.ok) {
      const errJson = (await resendRes.json().catch(() => null)) as { message?: string } | null;
      return NextResponse.json(
        {
          error:
            errJson?.message ||
            `Resend API rejected the request (${resendRes.status}). Check RESEND_API_KEY and RESEND_FROM_EMAIL.`,
        },
        { status: 502 }
      );
    }

    const challengeToken = createOtpChallengeToken(email, otp);
    const response = NextResponse.json({
      ok: true,
      message: `A 6-digit verification code was sent to ${email}.`,
    });

    response.cookies.set(OTP_COOKIE_NAME, challengeToken, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 10,
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: "Network error while sending verification email via Resend." },
      { status: 502 }
    );
  }
}
