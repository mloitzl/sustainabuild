import { createGitHubAuthProvider } from '@/lib/auth/providers/github-provider';
import { localAuthProvider } from '@/lib/auth/providers/local-provider';
import { createOidcAuthProvider } from '@/lib/auth/providers/oidc-provider';
import type { AuthProvider, PublicAuthProvider } from '@/lib/auth/types';

const SUPPORTED_PROVIDER_IDS = new Set(['local', 'github', 'oidc']);

function parseProviderIds(raw: string): string[] {
  const values = raw
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length > 0);

  if (values.length === 0) {
    return ['local'];
  }

  const deduped = Array.from(new Set(values));
  const invalid = deduped.filter((id) => !SUPPORTED_PROVIDER_IDS.has(id));
  if (invalid.length > 0) {
    throw new Error(`Unsupported auth provider ids: ${invalid.join(', ')}`);
  }
  return deduped;
}

function getConfiguredProviderIds(): string[] {
  const fromList = process.env.AUTH_PROVIDERS;
  if (fromList && fromList.trim().length > 0) {
    return parseProviderIds(fromList);
  }

  const fromSingle = process.env.AUTH_PROVIDER;
  if (fromSingle && fromSingle.trim().length > 0) {
    return parseProviderIds(fromSingle);
  }

  return ['local'];
}

function createProvider(providerId: string): AuthProvider {
  switch (providerId) {
    case 'local':
      return localAuthProvider;
    case 'github':
      return createGitHubAuthProvider();
    case 'oidc':
      return createOidcAuthProvider();
    default:
      throw new Error(`Unsupported auth provider: ${providerId}`);
  }
}

export type AuthProviderRegistry = {
  providers: AuthProvider[];
  defaultProviderId: string;
};

export function getAuthProviderRegistry(): AuthProviderRegistry {
  const providerIds = getConfiguredProviderIds();
  const providers = providerIds.map(createProvider);
  return {
    providers,
    defaultProviderId: providerIds[0],
  };
}

export function resolveAuthProvider(registry: AuthProviderRegistry, providerId?: string | null): AuthProvider {
  const selectedId = providerId?.trim() || registry.defaultProviderId;
  const provider = registry.providers.find((entry) => entry.id === selectedId);
  if (!provider) {
    throw new Error(`Auth provider "${selectedId}" is not enabled`);
  }
  return provider;
}

export function toPublicAuthProvider(provider: AuthProvider): PublicAuthProvider {
  return {
    id: provider.id,
    name: provider.name,
    kind: provider.kind,
    passwordLogin: provider.passwordLogin,
    loginPath: provider.beginLogin ? `/api/auth/login?provider=${provider.id}` : null,
  };
}

