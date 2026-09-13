import { NextResponse } from "next/server";
import {
  DEV_AUTH_COOKIE,
  developmentPersonas,
  isLocalDevelopmentAuthEnabled,
  issueDevelopmentSession,
} from "@/auth/development";
import { isLoopbackRequest } from "@/auth/configuration";

export async function POST(
  request: Request,
  context: { params: Promise<{ persona: string }> },
) {
  if (!isLocalDevelopmentAuthEnabled() || !isLoopbackRequest(request))
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
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export function DELETE(request: Request) {
  if (!isLocalDevelopmentAuthEnabled() || !isLoopbackRequest(request))
    return new NextResponse(null, { status: 404 });

  const response = NextResponse.json({ redirectTo: "/sign-in" });
  response.cookies.set(DEV_AUTH_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: false,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
