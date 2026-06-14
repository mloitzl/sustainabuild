import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { getAuthProviderRegistry, resolveAuthProvider } from '@/lib/auth/registry';
import { sessionOptions, SessionData } from '@/lib/session';

const AUTH_FLOW_TTL_MS = 10 * 60 * 1000;

function redirectWithStatus(req: NextRequest, params: Record<string, string>): NextResponse {
  const target = new URL('/', req.nextUrl.origin);
  for (const [key, value] of Object.entries(params)) {
    target.searchParams.set(key, value);
  }
  return NextResponse.redirect(target);
}

function trimError(message: string): string {
  return message.length > 120 ? `${message.slice(0, 117)}...` : message;
}

export async function GET(req: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  const providerId = req.nextUrl.searchParams.get('provider') ?? session.authFlow?.providerId;
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const oauthError = req.nextUrl.searchParams.get('error');

  if (oauthError) {
    session.authFlow = undefined;
    await session.save();
    return redirectWithStatus(req, { auth_error: trimError(`Provider rejected login: ${oauthError}`) });
  }

  try {
    const registry = getAuthProviderRegistry();
    const provider = resolveAuthProvider(registry, providerId);
    if (!provider.completeLogin) {
      throw new Error(`Provider "${provider.id}" does not support callback completion`);
    }

    const flow = session.authFlow;
    if (!flow) {
      throw new Error('Missing auth flow state');
    }
    if (flow.providerId !== provider.id) {
      throw new Error('Auth flow provider mismatch');
    }
    if (!state || flow.state !== state) {
      throw new Error('Invalid auth callback state');
    }
    if (!code) {
      throw new Error('Missing authorization code');
    }
    if (Date.now() - flow.createdAt > AUTH_FLOW_TTL_MS) {
      throw new Error('Auth flow expired');
    }

    const redirectUri = new URL('/api/auth/callback', req.nextUrl.origin);
    redirectUri.searchParams.set('provider', provider.id);

    const user = await provider.completeLogin({
      code,
      redirectUri: redirectUri.toString(),
      codeVerifier: flow.codeVerifier,
      nonce: flow.nonce,
    });

    session.user = {
      id: user.id,
      username: user.username,
      providerId: user.providerId,
      avatarUrl: user.avatarUrl,
      email: user.email,
    };
    session.authProviderId = user.providerId;
    session.authFlow = undefined;
    await session.save();

    return redirectWithStatus(req, { auth: 'success', provider: provider.id });
  } catch (error) {
    session.authFlow = undefined;
    await session.save();
    const message = error instanceof Error ? error.message : 'Authentication callback failed';
    return redirectWithStatus(req, { auth_error: trimError(message) });
  }
}

