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
import { NEXUS_OIDC_PROVIDER_ID } from "./provider";

type OidcEnvironment = {
  appUrl: string;
  authSecret: string;
  clientId: string;
  clientSecret: string;
  discoveryUrl: string;
  issuer: string;
};

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for authentication.`);
  return value;
}

function readOidcEnvironment(): OidcEnvironment {
  return {
    appUrl: requiredEnvironment("NEXT_PUBLIC_APP_URL"),
    authSecret: requiredEnvironment("BETTER_AUTH_SECRET"),
    clientId: requiredEnvironment("OIDC_CLIENT_ID"),
    clientSecret: requiredEnvironment("OIDC_CLIENT_SECRET"),
    discoveryUrl: requiredEnvironment("OIDC_DISCOVERY_URL"),
    issuer: requiredEnvironment("OIDC_ISSUER"),
  };
}

export function createAuthOptions(
  environment: OidcEnvironment,
): BetterAuthOptions {
  const database = getDatabase();

  return {
    appName: "Project Nexus",
    baseURL: environment.appUrl,
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
    account: { encryptOAuthTokens: true },
    session: {
      expiresIn: 60 * 60 * 12,
      updateAge: 60 * 60,
      freshAge: 60 * 15,
      preserveSessionInDatabase: true,
    },
    advanced: {
      database: { generateId: () => crypto.randomUUID() },
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
