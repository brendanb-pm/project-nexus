import { NextResponse } from "next/server";
import {
  DEV_AUTH_COOKIE,
  developmentPersonas,
  isLocalDevelopmentAuthEnabled,
  issueDevelopmentSession,
} from "@/auth/development";

export async function POST(
  _request: Request,
  context: { params: Promise<{ persona: string }> },
) {
  if (!isLocalDevelopmentAuthEnabled())
    return new NextResponse(null, { status: 404 });

  const { persona } = await context.params;
  if (!(persona in developmentPersonas))
    return new NextResponse(null, { status: 404 });

  const selected = persona as keyof typeof developmentPersonas;
  const token = issueDevelopmentSession(selected);
  if (!token) return new NextResponse(null, { status: 404 });

  const response = NextResponse.json({
    redirectTo: developmentPersonas[selected].callbackPath,
  });
  response.cookies.set(DEV_AUTH_COOKIE, token, {
    httpOnly: true,
    maxAge: 43_200,
    path: "/",
    sameSite: "lax",
    secure: false,
  });
  return response;
}

export function DELETE() {
  if (!isLocalDevelopmentAuthEnabled())
    return new NextResponse(null, { status: 404 });

  const response = NextResponse.json({ redirectTo: "/sign-in" });
  response.cookies.set(DEV_AUTH_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: false,
  });
  return response;
}
