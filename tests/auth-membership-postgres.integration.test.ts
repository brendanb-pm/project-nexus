import { existsSync } from "node:fs";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, type PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { betterAuth } from "better-auth";
import { serializeSignedCookie } from "better-call";
import { PostgresMembershipResolver } from "@/auth/membership";
import { readOidcEnvironment } from "@/auth/configuration";
import { createAuthOptions } from "@/auth/server";
import { closeDatabase } from "@/server/db/client";
import * as schema from "@/server/db/schema";

describe("PostgreSQL authentication membership boundary", () => {
  let pool: Pool;
  let client: PoolClient;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL && existsSync(".env.local"))
      process.loadEnvFile(".env.local");
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    client = await pool.connect();
  });

  afterAll(async () => {
    await closeDatabase();
    client?.release();
    await pool?.end();
  });

  it("binds membership resolution to the configured OIDC provider", async () => {
    await client.query("BEGIN");
    try {
      const database = drizzle(client, { schema });
      const resolver = new PostgresMembershipResolver(database);
      await expect(
        resolver.resolve("nexus-dev-auth-guard-a"),
      ).resolves.toMatchObject({
        organizationId: "00000000-0000-4000-8000-000000000001",
        roles: ["GUARD"],
      });

      await client.query(
        "UPDATE auth_accounts SET provider_id = 'untrusted-provider' WHERE id = 'nexus-dev-account-guard-a'",
      );

      await expect(
        resolver.resolve("nexus-dev-auth-guard-a"),
      ).resolves.toBeNull();
    } finally {
      await client.query("ROLLBACK");
    }
  });

  it("deletes a database session on production-style sign-out", async () => {
    const userId = `nx7-auth-user-${crypto.randomUUID()}`;
    const sessionId = `nx7-session-${crypto.randomUUID()}`;
    const token = `nx7-token-${crypto.randomUUID()}`;
    const secret = "integration-session-secret-with-at-least-32-characters";
    const environment = readOidcEnvironment(
      {
        BETTER_AUTH_SECRET: secret,
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
        OIDC_CLIENT_ID: "nexus-test",
        OIDC_CLIENT_SECRET: "integration-provider-secret",
        OIDC_DISCOVERY_URL:
          "https://identity.example.invalid/.well-known/openid-configuration",
        OIDC_ISSUER: "https://identity.example.invalid",
      },
      "development",
    );

    await pool.query(
      "INSERT INTO auth_users (id, name, email, email_verified) VALUES ($1, 'NX7 Session Test', $2, true)",
      [userId, `${userId}@example.invalid`],
    );
    await pool.query(
      "INSERT INTO auth_sessions (id, user_id, token, expires_at) VALUES ($1, $2, $3, NOW() + INTERVAL '1 hour')",
      [sessionId, userId, token],
    );

    const providerFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          authorization_endpoint: "https://identity.example.invalid/authorize",
          issuer: "https://identity.example.invalid",
          jwks_uri: "https://identity.example.invalid/jwks",
          token_endpoint: "https://identity.example.invalid/token",
        }),
        { headers: { "content-type": "application/json" } },
      ),
    );
    try {
      const auth = betterAuth(createAuthOptions(environment));
      const serialized = await serializeSignedCookie(
        "nexus.session_token",
        token,
        secret,
      );
      const headers = new Headers({
        cookie: serialized.split(";", 1)[0],
        origin: environment.appUrl,
      });
      const signedCookie = headers.get("cookie")!;
      const lastCharacter = signedCookie.at(-1);
      const tamperedHeaders = new Headers({
        cookie: `${signedCookie.slice(0, -1)}${lastCharacter === "a" ? "b" : "a"}`,
        origin: environment.appUrl,
      });

      await expect(
        auth.api.getSession({ headers: tamperedHeaders }),
      ).resolves.toBeNull();

      await expect(auth.api.getSession({ headers })).resolves.toMatchObject({
        session: { id: sessionId },
        user: { id: userId },
      });
      await expect(
        auth.api.signOut({
          body: { callbackURL: "/sign-in", disableRedirect: true },
          headers,
        }),
      ).resolves.toMatchObject({ success: true });

      await expect(auth.api.getSession({ headers })).resolves.toBeNull();
      const remaining = await pool.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM auth_sessions WHERE id = $1",
        [sessionId],
      );
      expect(remaining.rows[0]?.count).toBe("0");
    } finally {
      providerFetch.mockRestore();
      await pool.query("DELETE FROM auth_users WHERE id = $1", [userId]);
    }
  });
});
