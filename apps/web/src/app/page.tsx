'use client';

import { useState } from 'react';

export default function DashboardPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json() as { ok?: boolean; username?: string; error?: string };
    if (data.ok) {
      setLoggedIn(true);
      setMessage(`Logged in as ${data.username ?? username}`);
    } else {
      setMessage(data.error ?? 'Login failed');
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setLoggedIn(false);
    setMessage('Logged out');
  }

  async function handleGetTicket() {
    const res = await fetch('/api/auth/ticket');
    const data = await res.json() as { ticket?: string; error?: string };
    if (data.ticket) {
      setMessage(`Auth ticket: ${data.ticket.slice(0, 40)}…`);
    } else {
      setMessage(data.error ?? 'Failed to get ticket');
    }
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen gap-8 p-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-green-400">SustainaBuild</h1>
        <p className="text-gray-400 mt-2">GreenOps CI/CD Infrastructure Manager</p>
      </div>

      {!loggedIn ? (
        <form onSubmit={handleLogin} className="flex flex-col gap-4 w-full max-w-sm">
          <input
            className="bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white"
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            className="bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="submit"
            className="bg-green-600 hover:bg-green-500 text-white font-semibold rounded px-4 py-2 transition"
          >
            Login
          </button>
        </form>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <div className="bg-gray-800 border border-gray-700 rounded p-6 text-center">
            <p className="text-green-400 font-semibold">✓ Authenticated</p>
            <p className="text-gray-400 text-sm mt-1">Cluster dashboard coming in next phase</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleGetTicket}
              className="bg-blue-700 hover:bg-blue-600 text-white rounded px-4 py-2 text-sm transition"
            >
              Get WS Auth Ticket
            </button>
            <button
              onClick={handleLogout}
              className="bg-gray-700 hover:bg-gray-600 text-white rounded px-4 py-2 text-sm transition"
            >
              Logout
            </button>
          </div>
        </div>
      )}

      {message && (
        <p className="text-sm text-yellow-300 font-mono bg-gray-900 px-4 py-2 rounded border border-gray-700 max-w-lg break-all">
          {message}
        </p>
      )}
    </main>
  );
}
