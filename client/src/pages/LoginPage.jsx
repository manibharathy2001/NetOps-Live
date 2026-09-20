import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const DEMO_ACCOUNTS = [
  { name: 'Mani', email: 'mani@netops.local', password: 'mani1234', role: 'engineer' },
  { name: 'Priya', email: 'priya@netops.local', password: 'priya1234', role: 'engineer' },
  { name: 'Admin', email: 'admin@netops.local', password: 'admin123', role: 'admin' },
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

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight">NetOps Live</h1>
        <p className="mt-1 text-muted">Sign in to watch the network in real time.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-lg border border-line bg-panel p-5">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              className="w-full rounded-md border border-line px-3 py-2"
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
              className="w-full rounded-md border border-line px-3 py-2"
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
          <p className="text-sm text-muted">Demo accounts (fills the form):</p>
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
        </div>
      </div>
    </main>
  );
}
