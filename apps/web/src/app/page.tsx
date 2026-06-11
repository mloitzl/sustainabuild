'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useQueryLoader } from 'react-relay';
import { DashboardRouteEntry, dashboardRouteQuery } from '@/features/dashboard/DashboardRouteEntry';
import { RouteErrorBoundary } from '@/features/dashboard/RouteErrorBoundary';
import type { DashboardRouteEntryQuery } from '@/features/dashboard/__generated__/DashboardRouteEntryQuery.graphql';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

type User = {
  id: string;
  username: string;
};

type UiMessage = {
  kind: 'success' | 'error' | 'info';
  text: string;
};

type SessionResponse = {
  authenticated: boolean;
  user?: User;
};

function DashboardSuspenseFallback() {
  return (
    <section className="rounded-xl border border-gray-800 bg-gray-900/70 p-6">
      <p className="text-sm text-gray-300">Loading dashboard query…</p>
    </section>
  );
}

export default function DashboardPage() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [ticketPreview, setTicketPreview] = useState('');
  const [message, setMessage] = useState<UiMessage | null>(null);
  const [loginPending, setLoginPending] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const [ticketPending, setTicketPending] = useState(false);
  const [dashboardQueryRef, loadDashboardQuery, disposeDashboardQuery] =
    useQueryLoader<DashboardRouteEntryQuery>(dashboardRouteQuery);

  const loadAuthenticatedDashboard = useCallback(
    (fetchPolicy: 'store-or-network' | 'network-only' = 'store-or-network') => {
      loadDashboardQuery({ first: 20 }, { fetchPolicy });
    },
    [loadDashboardQuery],
  );

  useEffect(() => {
    async function loadSession() {
      try {
        const res = await fetch('/api/auth/session', { cache: 'no-store' });
        const data = (await res.json()) as SessionResponse;
        if (data.authenticated && data.user) {
          setUser(data.user);
          setAuthStatus('authenticated');
          return;
        }
        setAuthStatus('unauthenticated');
      } catch {
        setAuthStatus('unauthenticated');
      }
    }

    loadSession().catch(() => {
      setAuthStatus('unauthenticated');
    });
  }, []);

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
        body: JSON.stringify({ username, password }),
      });
      const data = (await res.json()) as { ok?: boolean; username?: string; error?: string };

      if (data.ok) {
        const authenticatedUser = { id: `user-${data.username ?? username}`, username: data.username ?? username };
        setUser(authenticatedUser);
        setAuthStatus('authenticated');
        setTicketPreview('');
        setMessage({ kind: 'success', text: `Signed in as ${authenticatedUser.username}` });
        return;
      }

      setMessage({ kind: 'error', text: data.error ?? 'Sign-in failed' });
    } catch {
      setMessage({ kind: 'error', text: 'Sign-in request failed. Please try again.' });
    } finally {
      setLoginPending(false);
    }
  }

  async function handleLogout() {
    setLogoutPending(true);
    setMessage(null);

    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setAuthStatus('unauthenticated');
      setUser(null);
      setTicketPreview('');
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

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="rounded-xl border border-gray-800 bg-gray-900/70 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-green-400">SustainaBuild</h1>
            <p className="mt-1 text-sm text-gray-400">GreenOps CI/CD Infrastructure Manager</p>
          </div>
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
        </div>
      </header>

      {authStatus === 'loading' ? (
        <section className="rounded-xl border border-gray-800 bg-gray-900/70 p-6">
          <p className="text-sm text-gray-300">Loading your session…</p>
        </section>
      ) : authStatus === 'unauthenticated' ? (
        <section className="rounded-xl border border-gray-800 bg-gray-900/70 p-6">
          <h2 className="text-lg font-semibold text-gray-100">Sign in to continue</h2>
          <p className="mt-1 text-sm text-gray-400">Use your credentials to access cluster management actions.</p>
          <form onSubmit={handleLogin} className="mt-6 flex max-w-md flex-col gap-4">
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
        </section>
      ) : (
        <section className="grid gap-4 md:grid-cols-2">
          <RouteErrorBoundary onRetry={() => loadAuthenticatedDashboard('network-only')}>
            <Suspense fallback={<DashboardSuspenseFallback />}>
              {dashboardQueryRef ? (
                <DashboardRouteEntry queryRef={dashboardQueryRef} username={user?.username ?? 'unknown'} />
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
      )}

      {message ? (
        <p role="alert" className={`rounded border px-4 py-3 text-sm ${messageClasses}`}>
          {message.text}
        </p>
      ) : null}
      <p className="text-xs text-gray-500">This interface is optimized for flow validation in the current phase.</p>
    </main>
  );
}
