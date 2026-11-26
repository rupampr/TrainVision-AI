import { NextResponse } from "next/server";
import { getGoogleClientId, getGoogleClientSecret } from "@/lib/auth";

export async function GET() {
  const googleClientId = getGoogleClientId();
  const hasGoogleSecret = Boolean(getGoogleClientSecret());
  const resendConfigured = Boolean(process.env.RESEND_API_KEY);

  return NextResponse.json({
    googleClientId,
    hasGoogleSecret,
    resendConfigured,
  });
}
