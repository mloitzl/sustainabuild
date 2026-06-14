import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/session';
import { getAuthProviderRegistry, resolveAuthProvider } from '@/lib/auth/registry';

const CALLBACK_PATH = '/api/auth/callback';

function asErrorResponse(error: unknown, status = 400) {
  const message = error instanceof Error ? error.message : 'Authentication failed';
  return NextResponse.json({ error: message }, { status });
}

function toUserSafeAuthError(error: unknown): string {
  const raw = error instanceof Error ? error.message : 'Authentication failed';
  if (raw.includes('OIDC discovery returned non-JSON response')) {
    return 'OIDC discovery failed. Check OIDC_ISSUER_URL and your Authentik provider slug.';
  }
  if (raw.length > 180) {
    return `${raw.slice(0, 177)}...`;
  }
  return raw;
}

export async function GET(req: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

  try {
    const registry = getAuthProviderRegistry();
    const providerId = req.nextUrl.searchParams.get('provider');
    const provider = resolveAuthProvider(registry, providerId);
    if (!provider.beginLogin) {
      throw new Error(`Provider "${provider.id}" does not support browser redirect login`);
    }

    const loginStart = await provider.beginLogin({
      origin: req.nextUrl.origin,
      callbackPath: CALLBACK_PATH,
    });

    session.authFlow = {
      providerId: provider.id,
      state: loginStart.state,
      nonce: loginStart.nonce,
      codeVerifier: loginStart.codeVerifier,
      createdAt: Date.now(),
    };
    await session.save();

    return NextResponse.redirect(loginStart.authorizationUrl);
  } catch (error) {
    const redirectTarget = new URL('/', req.nextUrl.origin);
    redirectTarget.searchParams.set('auth_error', toUserSafeAuthError(error));
    return NextResponse.redirect(redirectTarget);
  }
}

export async function POST(req: Request) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

  try {
    const body = (await req.json()) as { provider?: string; username?: string; password?: string };
    const registry = getAuthProviderRegistry();
    const provider = resolveAuthProvider(registry, body.provider ?? 'local');
    if (!provider.authenticateWithPassword) {
      throw new Error(`Provider "${provider.id}" does not support password login`);
    }

    const user = await provider.authenticateWithPassword({
      username: body.username ?? '',
      password: body.password ?? '',
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

    return NextResponse.json({ ok: true, username: session.user.username, provider: user.providerId });
  } catch (error) {
    return asErrorResponse(error);
  }
}
