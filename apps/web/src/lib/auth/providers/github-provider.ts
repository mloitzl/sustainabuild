import { createPkcePair, parseJsonResponse, randomUrlSafeString } from '@/lib/auth/oauth';
import type { AuthProvider } from '@/lib/auth/types';

type GitHubTokenResponse = {
  access_token?: string;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

type GitHubUserResponse = {
  id?: number;
  login?: string;
  avatar_url?: string;
  email?: string | null;
};

export function createGitHubAuthProvider(): AuthProvider {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('GitHub provider is enabled but GITHUB_CLIENT_ID/GITHUB_CLIENT_SECRET are not set');
  }

  const scope = process.env.GITHUB_OAUTH_SCOPES ?? 'read:user user:email';

  return {
    id: 'github',
    name: 'GitHub',
    kind: 'oauth',
    passwordLogin: false,
    beginLogin: async ({ origin, callbackPath }) => {
      const callbackUrl = new URL(callbackPath, origin);
      callbackUrl.searchParams.set('provider', 'github');

      const { verifier, challenge } = createPkcePair();
      const state = randomUrlSafeString(32);
      const nonce = randomUrlSafeString(32);

      const authUrl = new URL('https://github.com/login/oauth/authorize');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', callbackUrl.toString());
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', scope);
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('code_challenge', challenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');

      return {
        authorizationUrl: authUrl.toString(),
        state,
        nonce,
        codeVerifier: verifier,
      };
    },
    completeLogin: async ({ code, redirectUri, codeVerifier }) => {
      const tokenBody = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      });

      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: tokenBody.toString(),
      });
      const tokenPayload = await parseJsonResponse<GitHubTokenResponse>(tokenResponse, 'GitHub token exchange');
      if (!tokenResponse.ok) {
        throw new Error(
          `GitHub token exchange failed (${tokenResponse.status}): ${tokenPayload.error_description ?? tokenPayload.error ?? 'unknown'}`,
        );
      }
      if (!tokenPayload.access_token) {
        throw new Error(`GitHub token exchange did not return access token: ${tokenPayload.error ?? 'unknown'}`);
      }

      const userResponse = await fetch('https://api.github.com/user', {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${tokenPayload.access_token}`,
          'User-Agent': 'sustainabuild-auth',
        },
      });
      const userPayload = await parseJsonResponse<GitHubUserResponse>(userResponse, 'GitHub user info');
      if (!userResponse.ok) {
        throw new Error(`GitHub user info failed (${userResponse.status})`);
      }
      if (!userPayload.login || typeof userPayload.id !== 'number') {
        throw new Error('GitHub user info response is missing login or id');
      }

      return {
        id: `github-${userPayload.id}`,
        username: userPayload.login,
        providerId: 'github',
        avatarUrl: userPayload.avatar_url,
        email: userPayload.email ?? undefined,
      };
    },
  };
}

