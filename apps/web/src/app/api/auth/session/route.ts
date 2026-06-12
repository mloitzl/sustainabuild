import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/session';
import { getAuthProviderRegistry, toPublicAuthProvider } from '@/lib/auth/registry';

function getEnvironmentLabel(): string {
  return process.env.APP_ENV ?? process.env.NODE_ENV ?? 'development';
}

export async function GET() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  const environment = getEnvironmentLabel();
  let providerPayload: {
    defaultProviderId: string | null;
    providers: ReturnType<typeof toPublicAuthProvider>[];
    providerConfigError?: string;
  } = {
    defaultProviderId: null,
    providers: [],
  };

  try {
    const registry = getAuthProviderRegistry();
    providerPayload = {
      defaultProviderId: registry.defaultProviderId,
      providers: registry.providers.map(toPublicAuthProvider),
    };
  } catch (error) {
    providerPayload = {
      defaultProviderId: null,
      providers: [],
      providerConfigError: error instanceof Error ? error.message : 'Failed to resolve auth providers',
    };
  }

  if (!session.user) {
    return NextResponse.json({
      authenticated: false,
      environment,
      auth: providerPayload,
    });
  }

  return NextResponse.json({
    authenticated: true,
    environment,
    auth: providerPayload,
    user: {
      id: session.user.id,
      username: session.user.username,
      providerId: session.user.providerId ?? session.authProviderId ?? providerPayload.defaultProviderId ?? 'local',
    },
  });
}
