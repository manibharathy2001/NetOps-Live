import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Activity, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';

const DEMO_ACCOUNTS = [
  { name: 'Mani', email: 'mani@netops.local', password: 'mani1234', role: 'engineer' },
  { name: 'Priya', email: 'priya@netops.local', password: 'priya1234', role: 'engineer' },
  { name: 'Admin', email: 'admin@netops.local', password: 'admin123', role: 'admin' },
  { name: 'Guest', email: 'guest@netops.local', password: 'guest1234', role: 'read-only' },
];

export default function LoginPage() {
  const { session, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (session) return <Navigate to="/" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  // One click: fill the form and sign in, for visitors who just want to look around.
  async function signInAs(account) {
    setEmail(account.email);
    setPassword(account.password);
    setError(null);
    setSubmitting(true);
    try {
      await login(account.email, account.password);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-action text-white">
          <Activity size={20} aria-hidden="true" />
        </span>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">NetOps Live</h1>
        <p className="mt-1 text-muted">
          Real-time network operations dashboard. Device health, alarms and incidents, pushed as they happen.
        </p>

        <button
          type="button"
          onClick={() => signInAs(DEMO_ACCOUNTS[0])}
          disabled={submitting}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-md bg-action px-3 py-2.5 font-medium text-white hover:bg-action/90 disabled:opacity-60"
        >
          Try the live demo as an engineer
          <ArrowRight size={16} aria-hidden="true" />
        </button>
        <p className="mt-2 text-center text-xs text-muted">No sign-up needed. Or use any account below.</p>

        <div className="my-5 flex items-center gap-3 text-xs text-muted">
          <span className="h-px flex-1 bg-line" aria-hidden="true" />
          or sign in
          <span className="h-px flex-1 bg-line" aria-hidden="true" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-line bg-panel p-5 shadow-sm">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              className="w-full rounded-md border border-line bg-panel px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="w-full rounded-md border border-line bg-panel px-3 py-2"
            />
          </label>
          {error && <p className="text-sm text-down" role="alert">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-action px-3 py-2 font-medium text-white hover:bg-action/90 disabled:opacity-60"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="mt-5">
          <p className="text-sm text-muted">Demo accounts (click to fill the form):</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.email}
                type="button"
                onClick={() => {
                  setEmail(a.email);
                  setPassword(a.password);
                }}
                className="rounded-md border border-line bg-panel px-3 py-1.5 text-sm hover:bg-canvas"
              >
                {a.name} <span className="text-muted">({a.role})</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">
            Guest is read-only: it can watch everything but can't change incidents or trigger events.
          </p>
        </div>
      </div>
    </main>
  );
}
