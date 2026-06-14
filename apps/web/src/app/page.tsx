'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useQueryLoader } from 'react-relay';
import { DashboardRouteEntry, dashboardRouteQuery } from '@/features/dashboard/DashboardRouteEntry';
import { RouteErrorBoundary } from '@/features/dashboard/RouteErrorBoundary';
import { ViewerGate, type ViewerData } from '@/features/auth/ViewerGate';
import { viewerQuery } from '@/features/auth/ViewerQuery';
import type { DashboardRouteEntryQuery } from '@/features/dashboard/__generated__/DashboardRouteEntryQuery.graphql';
import type { ViewerQuery as ViewerQueryType } from '@/features/auth/__generated__/ViewerQuery.graphql';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

type AuthProvider = {
  id: string;
  name: string;
  kind: 'local' | 'oauth';
  passwordLogin: boolean;
  loginPath: string | null;
};

type UiMessage = {
  kind: 'success' | 'error' | 'info';
  text: string;
};

type ProvidersResponse = {
  environment?: string;
  defaultProviderId: string | null;
  providers: AuthProvider[];
  error?: string;
};

function SessionLoadingBody() {
  return (
    <section className="rounded-xl border border-gray-800 bg-gray-900/70 p-6">
      <p className="text-sm text-gray-300">Loading your session…</p>
    </section>
  );
}

function DashboardSuspenseFallback() {
  return (
    <section className="rounded-xl border border-gray-800 bg-gray-900/70 p-6">
      <p className="text-sm text-gray-300">Loading dashboard query…</p>
    </section>
  );
}

export default function DashboardPage() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');
  const [environment, setEnvironment] = useState('unknown');
  const [providers, setProviders] = useState<AuthProvider[]>([]);
  const [defaultProviderId, setDefaultProviderId] = useState<string | null>(null);
  const [providerConfigError, setProviderConfigError] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [ticketPreview, setTicketPreview] = useState('');
  const [message, setMessage] = useState<UiMessage | null>(null);
  const [loginPending, setLoginPending] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const [ticketPending, setTicketPending] = useState(false);
  const [viewerQueryRef, loadViewerQuery] = useQueryLoader<ViewerQueryType>(viewerQuery);
  const [dashboardQueryRef, loadDashboardQuery, disposeDashboardQuery] =
    useQueryLoader<DashboardRouteEntryQuery>(dashboardRouteQuery);

  const loadAuthenticatedDashboard = useCallback(
    (fetchPolicy: 'store-or-network' | 'network-only' = 'store-or-network') => {
      loadDashboardQuery({ first: 20 }, { fetchPolicy });
    },
    [loadDashboardQuery],
  );

  // Provider discovery must work pre-auth, so it stays REST. It feeds the
  // sign-in card and the environment badge.
  const loadProviders = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/providers', { cache: 'no-store' });
      const data = (await res.json()) as ProvidersResponse;
      setEnvironment(data.environment ?? 'unknown');
      setProviders(data.providers ?? []);
      setDefaultProviderId(data.defaultProviderId ?? null);
      setProviderConfigError(data.error ?? null);
    } catch {
      setEnvironment('unknown');
      setProviders([]);
      setDefaultProviderId(null);
      setProviderConfigError('Failed to load auth providers');
    }
  }, []);

  // Identity comes from the BFF `viewer` query: a null viewer means logged out.
  const reloadViewer = useCallback(
    (fetchPolicy: 'store-or-network' | 'network-only' = 'store-or-network') => {
      setAuthStatus('loading');
      loadViewerQuery({}, { fetchPolicy });
    },
    [loadViewerQuery],
  );

  const handleViewerResolved = useCallback((resolved: ViewerData) => {
    setAuthStatus(resolved ? 'authenticated' : 'unauthenticated');
    if (!resolved) {
      setTicketPreview('');
    }
  }, []);

  useEffect(() => {
    loadProviders();
    reloadViewer('store-or-network');
  }, [loadProviders, reloadViewer]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const url = new URL(window.location.href);
    const authError = url.searchParams.get('auth_error');
    const authStatusParam = url.searchParams.get('auth');
    const authProvider = url.searchParams.get('provider');

    if (authError) {
      setMessage({ kind: 'error', text: authError });
    } else if (authStatusParam === 'success') {
      const providerLabel =
        providers.find((provider) => provider.id === authProvider)?.name ?? authProvider ?? 'provider';
      setMessage({ kind: 'success', text: `Signed in via ${providerLabel}` });
    }

    if (authError || authStatusParam) {
      url.searchParams.delete('auth_error');
      url.searchParams.delete('auth');
      url.searchParams.delete('provider');
      window.history.replaceState({}, '', `${url.pathname}${url.search}`);
    }
  }, [providers]);

  useEffect(() => {
    if (authStatus === 'authenticated') {
      loadAuthenticatedDashboard('store-or-network');
      return;
    }

    disposeDashboardQuery();
  }, [authStatus, loadAuthenticatedDashboard, disposeDashboardQuery]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginPending(true);
    setMessage(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'local', username, password }),
      });
      const data = (await res.json()) as { ok?: boolean; username?: string; error?: string };

      if (data.ok) {
        reloadViewer('network-only');
        setMessage({ kind: 'success', text: `Signed in as ${data.username ?? username}` });
        return;
      }

      setMessage({ kind: 'error', text: data.error ?? 'Sign-in failed' });
    } catch {
      setMessage({ kind: 'error', text: 'Sign-in request failed. Please try again.' });
    } finally {
      setLoginPending(false);
    }
  }

  function handleProviderRedirectLogin(providerId: string) {
    setMessage({ kind: 'info', text: `Redirecting to ${providerId} login…` });
    window.location.assign(`/api/auth/login?provider=${providerId}`);
  }

  async function handleLogout() {
    setLogoutPending(true);
    setMessage(null);

    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      reloadViewer('network-only');
      setMessage({ kind: 'info', text: 'Signed out' });
    } catch {
      setMessage({ kind: 'error', text: 'Sign-out request failed. Please try again.' });
    } finally {
      setLogoutPending(false);
    }
  }

  async function handleGetTicket() {
    setTicketPending(true);
    setMessage(null);

    try {
      const res = await fetch('/api/auth/ticket');
      const data = (await res.json()) as { ticket?: string; error?: string };
      if (data.ticket) {
        setTicketPreview(`${data.ticket.slice(0, 48)}…`);
        setMessage({ kind: 'success', text: 'Live update ticket issued' });
        return;
      }
      setMessage({ kind: 'error', text: data.error ?? 'Failed to issue ticket' });
    } catch {
      setMessage({ kind: 'error', text: 'Ticket request failed. Please try again.' });
    } finally {
      setTicketPending(false);
    }
  }

  const messageClasses =
    message?.kind === 'success'
      ? 'border-green-700 bg-green-950/40 text-green-200'
      : message?.kind === 'error'
        ? 'border-red-700 bg-red-950/40 text-red-200'
        : 'border-blue-700 bg-blue-950/40 text-blue-200';
  const passwordProvider = providers.find((provider) => provider.passwordLogin);
  const redirectProviders = providers.filter((provider) => provider.loginPath !== null);

  function renderSignedOut() {
    return (
      <section className="rounded-xl border border-gray-800 bg-gray-900/70 p-6">
        <h2 className="text-lg font-semibold text-gray-100">Sign in to continue</h2>
        <p className="mt-1 text-sm text-gray-400">
          {providers.length > 1
            ? 'Choose an identity provider, or use local credentials for development access.'
            : 'Use the configured identity provider to access cluster management actions.'}
        </p>
        {defaultProviderId ? <p className="mt-2 text-xs text-gray-500">Default provider: {defaultProviderId}</p> : null}

        {providerConfigError ? (
          <p className="mt-4 rounded border border-red-700 bg-red-950/40 px-4 py-3 text-sm text-red-200">{providerConfigError}</p>
        ) : null}

        {redirectProviders.length > 0 ? (
          <div className="mt-5 flex max-w-md flex-col gap-3">
            {redirectProviders.map((provider) => (
              <button
                key={provider.id}
                type="button"
                onClick={() => handleProviderRedirectLogin(provider.id)}
                className="rounded border border-blue-700 bg-blue-950/40 px-4 py-2 text-sm font-semibold text-blue-100 transition hover:bg-blue-900/50"
              >
                Sign in with {provider.name}
              </button>
            ))}
          </div>
        ) : null}

        {passwordProvider ? (
          <form onSubmit={handleLogin} className="mt-6 flex max-w-md flex-col gap-4 border-t border-gray-800 pt-6">
            <h3 className="text-sm font-semibold text-gray-200">Local credentials</h3>
            <label className="flex flex-col gap-1 text-sm text-gray-300">
              Username
              <input
                className="rounded border border-gray-700 bg-gray-800 px-3 py-2 text-white outline-none ring-green-500 focus:ring-2"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-300">
              Password
              <input
                className="rounded border border-gray-700 bg-gray-800 px-3 py-2 text-white outline-none ring-green-500 focus:ring-2"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button
              type="submit"
              disabled={loginPending}
              className="rounded bg-green-600 px-4 py-2 font-semibold text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loginPending ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        ) : null}

        {providers.length === 0 && !providerConfigError ? (
          <p className="mt-4 rounded border border-red-700 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            No authentication providers are enabled. Set AUTH_PROVIDER or AUTH_PROVIDERS in the environment.
          </p>
        ) : null}
      </section>
    );
  }

  function renderAuthenticated(resolved: NonNullable<ViewerData>) {
    return (
      <section className="grid gap-4 md:grid-cols-2">
        <RouteErrorBoundary onRetry={() => loadAuthenticatedDashboard('network-only')}>
          <Suspense fallback={<DashboardSuspenseFallback />}>
            {dashboardQueryRef ? (
              <DashboardRouteEntry queryRef={dashboardQueryRef} username={resolved.username} />
            ) : (
              <DashboardSuspenseFallback />
            )}
          </Suspense>
        </RouteErrorBoundary>
        <div className="rounded-xl border border-gray-800 bg-gray-900/70 p-6">
          <h2 className="text-lg font-semibold text-gray-100">Live Updates</h2>
          <p className="mt-1 text-sm text-gray-400">Issue a short-lived ticket for direct WebSocket subscriptions.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={handleGetTicket}
              disabled={ticketPending}
              className="rounded bg-blue-700 px-4 py-2 text-sm text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {ticketPending ? 'Issuing ticket…' : 'Connect live updates'}
            </button>
            <button
              onClick={handleLogout}
              disabled={logoutPending}
              className="rounded bg-gray-700 px-4 py-2 text-sm text-white transition hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {logoutPending ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
          {ticketPreview && (
            <div className="mt-4 rounded border border-gray-700 bg-gray-950 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Latest ticket</p>
              <p className="mt-1 break-all font-mono text-xs text-gray-200">{ticketPreview}</p>
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="rounded-xl border border-gray-800 bg-gray-900/70 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-green-400">SustainaBuild</h1>
            <p className="mt-1 text-sm text-gray-400">GreenOps CI/CD Infrastructure Manager</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
                authStatus === 'authenticated'
                  ? 'border-green-700 bg-green-950/40 text-green-300'
                  : authStatus === 'loading'
                    ? 'border-yellow-700 bg-yellow-950/30 text-yellow-200'
                    : 'border-gray-700 bg-gray-900 text-gray-300'
              }`}
            >
              {authStatus === 'authenticated' ? 'Authenticated' : authStatus === 'loading' ? 'Checking session…' : 'Signed out'}
            </span>
            <span className="inline-flex items-center rounded-full border border-blue-700 bg-blue-950/30 px-3 py-1 text-xs font-semibold text-blue-200">
              Environment: {environment.toUpperCase()}
            </span>
          </div>
        </div>
      </header>

      <section className="rounded-xl border border-gray-800 bg-gray-900/70 p-4">
        <nav className="flex flex-wrap gap-2 text-xs text-gray-300">
          <span className="rounded border border-green-700 bg-green-950/40 px-2 py-1 text-green-300">Dashboard</span>
          <span className="rounded border border-gray-700 bg-gray-900 px-2 py-1">Clusters</span>
          <span className="rounded border border-gray-700 bg-gray-900 px-2 py-1">Runs</span>
          <span className="rounded border border-gray-700 bg-gray-900 px-2 py-1">Nodes</span>
        </nav>
      </section>

      <section aria-live="polite" aria-atomic="true" className="min-h-14">
        {message ? (
          <p role="alert" className={`rounded border px-4 py-3 text-sm ${messageClasses}`}>
            {message.text}
          </p>
        ) : (
          <div className="rounded border border-gray-800 bg-gray-900/40 px-4 py-3 text-sm text-gray-500">No active alerts.</div>
        )}
      </section>

      <RouteErrorBoundary onRetry={() => reloadViewer('network-only')}>
        <Suspense fallback={<SessionLoadingBody />}>
          {viewerQueryRef ? (
            <ViewerGate
              queryRef={viewerQueryRef}
              onResolved={handleViewerResolved}
              render={(resolved) => (resolved ? renderAuthenticated(resolved) : renderSignedOut())}
            />
          ) : (
            <SessionLoadingBody />
          )}
        </Suspense>
      </RouteErrorBoundary>

      <p className="text-xs text-gray-500">This interface is optimized for flow validation in the current phase.</p>
    </main>
  );
}
