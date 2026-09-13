import "server-only";

const loopbackHosts = new Set(["localhost", "127.0.0.1", "::1"]);
const placeholderValues = new Set([
  "replace-with-at-least-32-random-characters",
  "replace-with-provider-client-secret",
]);

export type OidcEnvironment = {
  appUrl: string;
  authSecret: string;
  clientId: string;
  clientSecret: string;
  discoveryUrl: string;
  issuer: string;
  secureCookies: boolean;
};

type EnvironmentSource = Record<string, string | undefined>;

function requiredEnvironment(
  environment: EnvironmentSource,
  name: string,
): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} is required for authentication.`);
  return value;
}

function parseUrl(name: string, value: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute URL.`);
  }
  if (parsed.username || parsed.password || parsed.hash) {
    throw new Error(`${name} contains unsupported URL components.`);
  }
  return parsed;
}

function requireSecureUrl(name: string, value: string, production: boolean) {
  const parsed = parseUrl(name, value);
  if (parsed.protocol === "https:") return parsed;
  if (
    !production &&
    parsed.protocol === "http:" &&
    loopbackHosts.has(parsed.hostname)
  ) {
    return parsed;
  }
  throw new Error(`${name} must use HTTPS outside local development.`);
}

export function readOidcEnvironment(
  environment: EnvironmentSource = process.env,
  nodeEnvironment: string | undefined = process.env.NODE_ENV,
): OidcEnvironment {
  const production = nodeEnvironment === "production";
  const appUrl = requireSecureUrl(
    "NEXT_PUBLIC_APP_URL",
    requiredEnvironment(environment, "NEXT_PUBLIC_APP_URL"),
    production,
  );
  if (appUrl.pathname !== "/" || appUrl.search) {
    throw new Error("NEXT_PUBLIC_APP_URL must not include a path or query.");
  }

  const issuer = requireSecureUrl(
    "OIDC_ISSUER",
    requiredEnvironment(environment, "OIDC_ISSUER"),
    production,
  );
  if (issuer.search) throw new Error("OIDC_ISSUER must not include a query.");
  const discoveryUrl = requireSecureUrl(
    "OIDC_DISCOVERY_URL",
    requiredEnvironment(environment, "OIDC_DISCOVERY_URL"),
    production,
  );
  const authSecret = requiredEnvironment(environment, "BETTER_AUTH_SECRET");
  const clientSecret = requiredEnvironment(environment, "OIDC_CLIENT_SECRET");
  if (authSecret.length < 32 || placeholderValues.has(authSecret)) {
    throw new Error(
      "BETTER_AUTH_SECRET must contain at least 32 non-placeholder characters.",
    );
  }
  if (placeholderValues.has(clientSecret)) {
    throw new Error("OIDC_CLIENT_SECRET must not use the example placeholder.");
  }
  if (
    production &&
    (issuer.hostname.endsWith(".invalid") ||
      discoveryUrl.hostname.endsWith(".invalid"))
  ) {
    throw new Error("Production OIDC endpoints must be deployable HTTPS URLs.");
  }

  return {
    appUrl: appUrl.origin,
    authSecret,
    clientId: requiredEnvironment(environment, "OIDC_CLIENT_ID"),
    clientSecret,
    discoveryUrl: discoveryUrl.toString(),
    issuer: issuer.toString().replace(/\/$/, ""),
    secureCookies: appUrl.protocol === "https:",
  };
}

export function isLoopbackRequest(request: Request): boolean {
  try {
    const requestUrl = new URL(request.url);
    const configuredUrl = new URL(process.env.NEXT_PUBLIC_APP_URL ?? "");
    if (
      !loopbackHosts.has(requestUrl.hostname) ||
      requestUrl.origin !== configuredUrl.origin
    )
      return false;

    const origin = request.headers.get("origin");
    if (!origin || new URL(origin).origin !== requestUrl.origin) return false;

    const host = request.headers.get("host");
    if (host && host !== requestUrl.host) return false;
    if (request.headers.has("forwarded")) return false;

    const forwardedHost = request.headers.get("x-forwarded-host");
    if (forwardedHost && forwardedHost !== requestUrl.host) return false;
    const forwardedProtocol = request.headers.get("x-forwarded-proto");
    if (
      forwardedProtocol &&
      forwardedProtocol !== requestUrl.protocol.replace(":", "")
    )
      return false;

    const fetchSite = request.headers.get("sec-fetch-site");
    return !fetchSite || fetchSite === "same-origin";
  } catch {
    return false;
  }
}
