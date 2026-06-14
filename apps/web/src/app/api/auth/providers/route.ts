import { NextRequest, NextResponse } from 'next/server';
import { getAuthProviderRegistry, toPublicAuthProvider } from '@/lib/auth/registry';

function getEnvironmentLabel(): string {
  return process.env.APP_ENV ?? process.env.NODE_ENV ?? 'development';
}

export async function GET(_req: NextRequest) {
  const environment = getEnvironmentLabel();
  try {
    const registry = getAuthProviderRegistry();
    return NextResponse.json({
      environment,
      defaultProviderId: registry.defaultProviderId,
      providers: registry.providers.map(toPublicAuthProvider),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to resolve auth providers';
    return NextResponse.json(
      { environment, error: message, providers: [], defaultProviderId: null },
      { status: 500 },
    );
  }
}

