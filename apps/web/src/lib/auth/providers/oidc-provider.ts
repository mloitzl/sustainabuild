import { createPkcePair, parseJsonResponse, parseJwtPayload, randomUrlSafeString } from '@/lib/auth/oauth';
import type { AuthProvider } from '@/lib/auth/types';

type OidcDiscoveryDocument = {
  authorization_endpoint?: string;
  token_endpoint?: string;
  userinfo_endpoint?: string;
};

type OidcTokenResponse = {
  access_token?: string;
  id_token?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

const discoveryCache = new Map<string, Promise<OidcDiscoveryDocument>>();

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function buildDiscoveryUrls(issuerBaseUrl: string, discoveryUrlOverride?: string): string[] {
  const candidates: string[] = [];
  if (discoveryUrlOverride) {
    candidates.push(discoveryUrlOverride);
  }

  const issuerUrl = new URL(issuerBaseUrl);
  const issuerWithSlash = issuerUrl.toString().endsWith('/') ? issuerUrl.toString() : `${issuerUrl.toString()}/`;
  candidates.push(new URL('.well-known/openid-configuration', issuerWithSlash).toString());
  candidates.push(new URL('/.well-known/openid-configuration', issuerUrl.origin).toString());

  if (issuerUrl.pathname.includes('/application/o/') && issuerUrl.pathname !== '/application/o/') {
    candidates.push(new URL('/application/o/.well-known/openid-configuration', issuerUrl.origin).toString());
  }

  return unique(candidates);
}

function getCachedDiscovery(discoveryUrls: string[]): Promise<OidcDiscoveryDocument> {
  const cacheKey = discoveryUrls.join('|');
  if (!discoveryCache.has(cacheKey)) {
    const promise = (async () => {
      let lastError: Error | null = null;
      for (const discoveryUrl of discoveryUrls) {
        try {
          const res = await fetch(discoveryUrl);
          const doc = await parseJsonResponse<OidcDiscoveryDocument>(res, 'OIDC discovery');
          if (!res.ok) {
            throw new Error(`OIDC discovery failed (${res.status}) at ${discoveryUrl}`);
          }
          if (!doc.authorization_endpoint || !doc.token_endpoint) {
            throw new Error(`OIDC discovery document is missing authorization_endpoint or token_endpoint at ${discoveryUrl}`);
          }
          return doc;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Unknown OIDC discovery error');
        }
      }

      throw lastError ?? new Error('OIDC discovery failed for all configured endpoints');
    })();
    discoveryCache.set(cacheKey, promise);
  }

  return discoveryCache.get(cacheKey)!;
}

function readStringClaim(claims: Record<string, unknown>, claimName: string): string | undefined {
  const value = claims[claimName];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function createOidcAuthProvider(): AuthProvider {
  const issuerBaseUrl = process.env.OIDC_ISSUER_URL;
  const clientId = process.env.OIDC_CLIENT_ID;
  const clientSecret = process.env.OIDC_CLIENT_SECRET;
  if (!issuerBaseUrl || !clientId) {
    throw new Error('OIDC provider is enabled but OIDC_ISSUER_URL/OIDC_CLIENT_ID are not set');
  }

  const normalizedIssuer = issuerBaseUrl.trim();
  const discoveryUrlOverride = process.env.OIDC_DISCOVERY_URL?.trim();
  const authorizationEndpointOverride = process.env.OIDC_AUTHORIZATION_ENDPOINT?.trim();
  const discoveryUrls = buildDiscoveryUrls(normalizedIssuer, discoveryUrlOverride);
  const scopes = process.env.OIDC_SCOPES ?? 'openid profile email';
  const usernameClaim = process.env.OIDC_USERNAME_CLAIM ?? 'preferred_username';
  const providerName = process.env.OIDC_PROVIDER_NAME ?? 'OIDC';

  return {
    id: 'oidc',
    name: providerName,
    kind: 'oauth',
    passwordLogin: false,
    beginLogin: async ({ origin, callbackPath }) => {
      const discovery = await getCachedDiscovery(discoveryUrls);
      const callbackUrl = new URL(callbackPath, origin);
      callbackUrl.searchParams.set('provider', 'oidc');

      const { verifier, challenge } = createPkcePair();
      const state = randomUrlSafeString(32);
      const nonce = randomUrlSafeString(32);

      const authUrl = new URL(authorizationEndpointOverride || discovery.authorization_endpoint!);
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', callbackUrl.toString());
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', scopes);
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('nonce', nonce);
      authUrl.searchParams.set('code_challenge', challenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');

      return {
        authorizationUrl: authUrl.toString(),
        state,
        nonce,
        codeVerifier: verifier,
      };
    },
    completeLogin: async ({ code, redirectUri, codeVerifier, nonce }) => {
      const discovery = await getCachedDiscovery(discoveryUrls);

      const tokenBody = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      });
      if (clientSecret) {
        tokenBody.set('client_secret', clientSecret);
      }

      const tokenResponse = await fetch(discovery.token_endpoint!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: tokenBody.toString(),
      });
      const tokenPayload = await parseJsonResponse<OidcTokenResponse>(tokenResponse, 'OIDC token exchange');
      if (!tokenResponse.ok) {
        throw new Error(
          `OIDC token exchange failed (${tokenResponse.status}): ${tokenPayload.error_description ?? tokenPayload.error ?? 'unknown'}`,
        );
      }
      if (!tokenPayload.access_token && !tokenPayload.id_token) {
        throw new Error('OIDC token exchange returned neither access_token nor id_token');
      }

      const tokenClaims = tokenPayload.id_token ? parseJwtPayload(tokenPayload.id_token) : {};
      const tokenNonce = readStringClaim(tokenClaims, 'nonce');
      if (tokenNonce && tokenNonce !== nonce) {
        throw new Error('OIDC callback nonce mismatch');
      }

      let userClaims: Record<string, unknown> = {};
      if (discovery.userinfo_endpoint && tokenPayload.access_token) {
        const userInfoResponse = await fetch(discovery.userinfo_endpoint, {
          headers: {
            Authorization: `Bearer ${tokenPayload.access_token}`,
          },
        });
        userClaims = await parseJsonResponse<Record<string, unknown>>(userInfoResponse, 'OIDC user info');
        if (!userInfoResponse.ok) {
          throw new Error(`OIDC user info failed (${userInfoResponse.status})`);
        }
      } else {
        userClaims = tokenClaims;
      }

      const sub = readStringClaim(userClaims, 'sub') ?? readStringClaim(tokenClaims, 'sub');
      if (!sub) {
        throw new Error('OIDC user claims did not include sub');
      }

      const preferredUsername =
        readStringClaim(userClaims, usernameClaim) ??
        readStringClaim(userClaims, 'preferred_username') ??
        readStringClaim(userClaims, 'email') ??
        readStringClaim(userClaims, 'name') ??
        readStringClaim(tokenClaims, usernameClaim) ??
        sub;

      return {
        id: `oidc-${sub}`,
        username: preferredUsername,
        providerId: 'oidc',
      };
    },
  };
}
