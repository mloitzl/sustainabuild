import { NextRequest, NextResponse } from 'next/server';
import { getAuthProviderRegistry, toPublicAuthProvider } from '@/lib/auth/registry';

export async function GET(_req: NextRequest) {
  try {
    const registry = getAuthProviderRegistry();
    return NextResponse.json({
      defaultProviderId: registry.defaultProviderId,
      providers: registry.providers.map(toPublicAuthProvider),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to resolve auth providers';
    return NextResponse.json({ error: message, providers: [], defaultProviderId: null }, { status: 500 });
  }
}

