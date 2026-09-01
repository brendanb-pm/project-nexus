import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

export const DEV_AUTH_COOKIE = "nexus_dev_session";
export const developmentPersonas = {
  "guard-a": {
    authUserId: "nexus-dev-auth-guard-a",
    callbackPath: "/schedule",
  },
  "guard-b": {
    authUserId: "nexus-dev-auth-guard-b",
    callbackPath: "/eosr",
  },
  "operations-manager-b": {
    authUserId: "nexus-dev-auth-operations-manager-b",
    callbackPath: "/reporting",
  },
} as const;
type Persona = keyof typeof developmentPersonas;
type Session = { authUserId: string; expiresAt: number; persona: Persona };

function enabled() {
  try {
    const hostname = new URL(process.env.NEXT_PUBLIC_APP_URL ?? "").hostname;
    return (
      process.env.NODE_ENV === "development" &&
      process.env.NEXUS_DEV_AUTH === "true" &&
      ["localhost", "127.0.0.1"].includes(hostname)
    );
  } catch {
    return false;
  }
}

export const isLocalDevelopmentAuthEnabled = enabled;

function secret() {
  const value = process.env.BETTER_AUTH_SECRET;
  return value && value.length >= 32 ? value : null;
}

function sign(value: string, key: string) {
  return createHmac("sha256", key).update(value).digest("base64url");
}

export function issueDevelopmentSession(persona: Persona) {
  const key = secret();
  if (!enabled() || !key) return null;

  const encoded = Buffer.from(
    JSON.stringify({
      authUserId: developmentPersonas[persona].authUserId,
      expiresAt: Date.now() + 43_200_000,
      persona,
    } satisfies Session),
  ).toString("base64url");

  return `${encoded}.${sign(encoded, key)}`;
}

export function verifyDevelopmentSession(value: string | undefined) {
  const key = secret();
  if (!enabled() || !key || !value) return null;

  const [encoded, supplied, extra] = value.split(".");
  if (!encoded || !supplied || extra) return null;

  const expected = sign(encoded, key);
  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
  ) {
    return null;
  }

  try {
    const session = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as Session;
    const persona = developmentPersonas[session.persona];
    return persona &&
      session.authUserId === persona.authUserId &&
      session.expiresAt > Date.now()
      ? session
      : null;
  } catch {
    return null;
  }
}
