import { afterEach, describe, expect, it, vi } from "vitest";
import { isLoopbackRequest, readOidcEnvironment } from "@/auth/configuration";
import {
  issueDevelopmentSession,
  verifyDevelopmentSession,
} from "@/auth/development";
import { BetterAuthSessionVerifier } from "@/auth/principal-resolver";
import { createAuthOptions } from "@/auth/server";
import { closeDatabase } from "@/server/db/client";
import { selectAuthenticatedLandingPath } from "@/auth/landing";
import type { Capability } from "@/domain/model";
import {
  DELETE as deleteDevelopmentSession,
  POST as createDevelopmentSession,
} from "@/app/api/dev-auth/[persona]/route";

const validEnvironment = {
  BETTER_AUTH_SECRET: "a-production-secret-with-more-than-32-characters",
  NEXT_PUBLIC_APP_URL: "https://nexus.example.com",
  OIDC_CLIENT_ID: "nexus-production",
  OIDC_CLIENT_SECRET: "provider-client-secret",
  OIDC_DISCOVERY_URL:
    "https://identity.example.com/.well-known/openid-configuration",
  OIDC_ISSUER: "https://identity.example.com",
};

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
  await closeDatabase();
});

describe("production authentication configuration", () => {
  it("accepts deployable HTTPS configuration and enables secure cookies", () => {
    expect(readOidcEnvironment(validEnvironment, "production")).toMatchObject({
      appUrl: "https://nexus.example.com",
      issuer: "https://identity.example.com",
      secureCookies: true,
    });
  });

  it.each([
    [
      "an insecure production app URL",
      { NEXT_PUBLIC_APP_URL: "http://nexus.example.com" },
    ],
    [
      "a placeholder session secret",
      { BETTER_AUTH_SECRET: "replace-with-at-least-32-random-characters" },
    ],
    [
      "a placeholder provider secret",
      { OIDC_CLIENT_SECRET: "replace-with-provider-client-secret" },
    ],
    [
      "a credential-bearing issuer URL",
      { OIDC_ISSUER: "https://user:pass@identity.example.com" },
    ],
    [
      "a query-bearing application URL",
      { NEXT_PUBLIC_APP_URL: "https://nexus.example.com?tenant=one" },
    ],
    [
      "an example-only production issuer",
      { OIDC_ISSUER: "https://identity.example.invalid" },
    ],
  ])("rejects %s", (_label, override) => {
    expect(() =>
      readOidcEnvironment({ ...validEnvironment, ...override }, "production"),
    ).toThrow();
  });

  it("uses explicit fail-closed session and cookie settings", () => {
    vi.stubEnv("DATABASE_URL", "postgresql://nexus:test@localhost:5432/nexus");
    const options = createAuthOptions(
      readOidcEnvironment(validEnvironment, "production"),
    );

    expect(options.trustedOrigins).toEqual(["https://nexus.example.com"]);
    expect(options.session).toMatchObject({
      cookieCache: { enabled: false },
      disableSessionRefresh: true,
      expiresIn: 43_200,
      preserveSessionInDatabase: true,
    });
    expect(options.advanced).toMatchObject({
      crossSubDomainCookies: { enabled: false },
      disableCSRFCheck: false,
      disableOriginCheck: false,
      useSecureCookies: true,
      defaultCookieAttributes: {
        httpOnly: true,
        path: "/",
        sameSite: "lax",
        secure: true,
      },
    });
    expect(options.account).toMatchObject({
      accountLinking: { enabled: false },
      encryptOAuthTokens: true,
    });
  });
});

describe("post-authentication landing", () => {
  const capabilities = (...values: Capability[]) => new Set(values);

  it.each([
    ["Guard", capabilities("VIEW_OWN_ASSIGNMENTS"), "/home"],
    ["Leadership", capabilities("VIEW_ORGANIZATION_ANALYTICS"), "/leadership"],
    ["Admin", capabilities("VIEW_ORGANIZATION_ANALYTICS"), "/leadership"],
    ["Operations", capabilities("VIEW_SITE_OPERATIONS"), "/operations"],
    ["Supervisor", capabilities("VIEW_SITE_OPERATIONS"), "/operations"],
    ["Client", capabilities("VIEW_CLIENT_REPORTS"), "/portal"],
    ["no application capability", capabilities(), null],
  ])(
    "routes %s without trusting client role input",
    (_label, granted, expected) => {
      expect(selectAuthenticatedLandingPath(granted)).toBe(expected);
    },
  );
});

describe("authoritative production session verification", () => {
  it("accepts a valid session and forces a database-backed, non-refreshing read", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-13T12:00:00.000Z"));
    const reader = vi.fn().mockResolvedValue({
      session: {
        id: "session-1",
        createdAt: new Date("2026-09-13T11:00:00.000Z"),
        expiresAt: new Date("2026-09-13T23:00:00.000Z"),
      },
      user: { id: "auth-user-1" },
    });
    const headers = new Headers({ cookie: "nexus.session_token=signed" });

    await expect(
      new BetterAuthSessionVerifier(headers, reader).verify(),
    ).resolves.toMatchObject({
      authUserId: "auth-user-1",
      sessionId: "session-1",
    });
    expect(reader).toHaveBeenCalledWith({
      headers,
      query: { disableCookieCache: true, disableRefresh: true },
    });
  });

  it.each([
    ["missing/revoked", null],
    [
      "expired",
      {
        session: {
          id: "session-1",
          createdAt: new Date("2026-09-12T00:00:00.000Z"),
          expiresAt: new Date("2026-09-13T00:00:00.000Z"),
        },
        user: { id: "auth-user-1" },
      },
    ],
    [
      "malformed",
      {
        session: {
          id: "",
          createdAt: new Date(Number.NaN),
          expiresAt: new Date(Number.NaN),
        },
        user: { id: "" },
      },
    ],
    [
      "over-age even when its stored expiry is later",
      {
        session: {
          id: "session-1",
          createdAt: new Date("2026-09-12T23:59:59.000Z"),
          expiresAt: new Date("2026-09-14T00:00:00.000Z"),
        },
        user: { id: "auth-user-1" },
      },
    ],
    [
      "future-dated",
      {
        session: {
          id: "session-1",
          createdAt: new Date("2026-09-13T12:00:01.000Z"),
          expiresAt: new Date("2026-09-13T23:00:00.000Z"),
        },
        user: { id: "auth-user-1" },
      },
    ],
  ])("denies a %s session", async (_label, session) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-13T12:00:00.000Z"));
    await expect(
      new BetterAuthSessionVerifier(
        new Headers(),
        vi.fn().mockResolvedValue(session),
      ).verify(),
    ).resolves.toBeNull();
  });
});

describe("localhost-only development authentication", () => {
  function enableDevelopmentAuth() {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXUS_DEV_AUTH", "true");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
    vi.stubEnv(
      "BETTER_AUTH_SECRET",
      "development-secret-with-more-than-32-characters",
    );
  }

  it("issues an integrity-protected session only in local development", () => {
    enableDevelopmentAuth();
    const session = issueDevelopmentSession("guard-a");
    expect(session).toBeTruthy();
    expect(verifyDevelopmentSession(session!)).toMatchObject({
      authUserId: "nexus-dev-auth-guard-a",
      persona: "guard-a",
    });

    const [payload, signature] = session!.split(".");
    expect(verifyDevelopmentSession(`${payload}.${signature}x`)).toBeNull();
    vi.stubEnv("NODE_ENV", "production");
    expect(issueDevelopmentSession("guard-a")).toBeNull();
    expect(verifyDevelopmentSession(session!)).toBeNull();
  });

  it("requires an exact same-origin loopback request", () => {
    enableDevelopmentAuth();
    expect(
      isLoopbackRequest(
        new Request("http://localhost:3000/api/dev-auth/guard-a", {
          headers: {
            origin: "http://localhost:3000",
            "sec-fetch-site": "same-origin",
          },
          method: "POST",
        }),
      ),
    ).toBe(true);
    expect(
      isLoopbackRequest(
        new Request("http://localhost:3000/api/dev-auth/guard-a", {
          headers: { origin: "https://attacker.example" },
          method: "POST",
        }),
      ),
    ).toBe(false);
    expect(
      isLoopbackRequest(
        new Request("http://192.0.2.10:3000/api/dev-auth/guard-a", {
          headers: { origin: "http://192.0.2.10:3000" },
          method: "POST",
        }),
      ),
    ).toBe(false);
    expect(
      isLoopbackRequest(
        new Request("http://127.0.0.1:3000/api/dev-auth/guard-a", {
          headers: { origin: "http://127.0.0.1:3000" },
          method: "POST",
        }),
      ),
    ).toBe(false);
    expect(
      isLoopbackRequest(
        new Request("http://localhost:3000/api/dev-auth/guard-a", {
          headers: {
            origin: "http://localhost:3000",
            "x-forwarded-host": "public.example",
          },
          method: "POST",
        }),
      ),
    ).toBe(false);
    expect(
      isLoopbackRequest(
        new Request("http://localhost:3000/api/dev-auth/guard-a", {
          headers: {
            forwarded: "for=192.0.2.1;host=localhost:3000;proto=http",
            origin: "http://localhost:3000",
          },
          method: "POST",
        }),
      ),
    ).toBe(false);
  });

  it("issues and revokes only same-origin local cookies without caching", async () => {
    enableDevelopmentAuth();
    const request = new Request("http://localhost:3000/api/dev-auth/guard-a", {
      headers: {
        origin: "http://localhost:3000",
        "sec-fetch-site": "same-origin",
      },
      method: "POST",
    });
    const issued = await createDevelopmentSession(request, {
      params: Promise.resolve({ persona: "guard-a" }),
    });
    expect(issued.status).toBe(200);
    expect(issued.headers.get("cache-control")).toBe("no-store");
    expect(issued.headers.get("set-cookie")).toMatch(
      /nexus_dev_session=.*HttpOnly.*SameSite=lax/i,
    );

    const revoked = deleteDevelopmentSession(request);
    expect(revoked.status).toBe(200);
    expect(revoked.headers.get("set-cookie")).toMatch(
      /nexus_dev_session=;.*Max-Age=0/i,
    );

    const crossOrigin = await createDevelopmentSession(
      new Request("http://localhost:3000/api/dev-auth/guard-a", {
        headers: { origin: "https://attacker.example" },
        method: "POST",
      }),
      { params: Promise.resolve({ persona: "guard-a" }) },
    );
    expect(crossOrigin.status).toBe(404);

    vi.stubEnv("NODE_ENV", "production");
    const production = await createDevelopmentSession(request, {
      params: Promise.resolve({ persona: "guard-a" }),
    });
    expect(production.status).toBe(404);
    expect(production.headers.get("set-cookie")).toBeNull();
  });
});
