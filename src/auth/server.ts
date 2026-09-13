import "server-only";

import { and, eq } from "drizzle-orm";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { genericOAuth } from "better-auth/plugins";
import { getDatabase } from "@/server/db/client";
import {
  authAccounts,
  authSessions,
  authUsers,
  authVerifications,
  externalIdentities,
} from "@/server/db/schema";
import { readOidcEnvironment, type OidcEnvironment } from "./configuration";
import { NEXUS_OIDC_PROVIDER_ID } from "./provider";

export function createAuthOptions(
  environment: OidcEnvironment,
): BetterAuthOptions {
  const database = getDatabase();

  return {
    appName: "Project Nexus",
    baseURL: environment.appUrl,
    trustedOrigins: [new URL(environment.appUrl).origin],
    secret: environment.authSecret,
    database: drizzleAdapter(database, {
      provider: "pg",
      schema: {
        user: authUsers,
        session: authSessions,
        account: authAccounts,
        verification: authVerifications,
      },
    }),
    emailAndPassword: { enabled: false },
    account: {
      accountLinking: { enabled: false },
      encryptOAuthTokens: true,
    },
    session: {
      cookieCache: { enabled: false },
      disableSessionRefresh: true,
      expiresIn: 60 * 60 * 12,
      freshAge: 60 * 15,
      preserveSessionInDatabase: true,
    },
    rateLimit: { enabled: true, max: 100, window: 60 },
    advanced: {
      cookiePrefix: "nexus",
      crossSubDomainCookies: { enabled: false },
      defaultCookieAttributes: {
        httpOnly: true,
        path: "/",
        sameSite: "lax",
        secure: environment.secureCookies,
      },
      disableCSRFCheck: false,
      disableOriginCheck: false,
      database: { generateId: () => crypto.randomUUID() },
      useSecureCookies: environment.secureCookies,
    },
    user: {
      validateUserInfo: async ({ source }) => {
        if (source.oauth?.providerId !== NEXUS_OIDC_PROVIDER_ID) {
          return {
            error: "identity_not_allowed",
            errorDescription: "This identity cannot access Project Nexus.",
          };
        }

        const subject = source.oauth.profile?.sub;
        if (typeof subject !== "string" || !subject) {
          return {
            error: "identity_not_allowed",
            errorDescription: "This identity cannot access Project Nexus.",
          };
        }

        const [binding] = await database
          .select({ id: externalIdentities.id })
          .from(externalIdentities)
          .where(
            and(
              eq(externalIdentities.issuer, environment.issuer),
              eq(externalIdentities.subject, subject),
            ),
          )
          .limit(1);

        if (!binding) {
          return {
            error: "identity_not_allowed",
            errorDescription: "This identity cannot access Project Nexus.",
          };
        }
      },
    },
    plugins: [
      genericOAuth({
        config: [
          {
            providerId: NEXUS_OIDC_PROVIDER_ID,
            discoveryUrl: environment.discoveryUrl,
            accountIssuer: environment.issuer,
            clientId: environment.clientId,
            clientSecret: environment.clientSecret,
            requireIdTokenVerification: true,
            scopes: ["openid", "profile", "email"],
            postLogoutRedirectURI: `${environment.appUrl}/sign-in`,
          },
        ],
      }),
    ],
  };
}

let authInstance: ReturnType<typeof betterAuth> | undefined;

export function getAuth(): ReturnType<typeof betterAuth> {
  authInstance ??= betterAuth(createAuthOptions(readOidcEnvironment()));
  return authInstance;
}
