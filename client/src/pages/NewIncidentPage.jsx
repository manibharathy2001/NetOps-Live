import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';
import { SEVERITIES } from '../lib/incidents.js';
import { SEVERITY_STYLE } from '../lib/format.js';

const inputClass = 'w-full rounded-md border border-line bg-panel px-3 py-2';

export default function NewIncidentPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [devices, setDevices] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({
    device: params.get('device') || '',
    title: '',
    severity: 'major',
    assigneeId: '',
    description: '',
  });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([api('/api/devices'), api('/api/users')])
      .then(([d, u]) => {
        setDevices(d);
        setUsers(u);
        setForm((f) => ({ ...f, device: f.device || d[0]?.hostname || '' }));
      })
      .catch((err) => setError(err.message));
  }, []);

  if (user.role === 'viewer') {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-muted">Viewers can follow incidents but can't open them. Ask an engineer to open one.</p>
      </main>
    );
  }

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await api('/api/incidents', {
        method: 'POST',
        body: { ...form, assigneeId: form.assigneeId || null },
      });
      navigate(`/incidents/${created._id}`);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <Link to="/incidents" className="text-sm font-medium text-action hover:underline">All incidents</Link>
      <h1 className="mt-2 text-xl font-semibold tracking-tight">Open an incident</h1>
      <p className="mt-1 text-sm text-muted">
        Everyone watching NetOps Live sees it the moment you open it. Active alarms on the device are attached automatically.
      </p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4 rounded-lg border border-line bg-panel p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Device</span>
            <select value={form.device} onChange={set('device')} required className={`${inputClass} font-mono text-sm`}>
              {devices.map((d) => (
                <option key={d.hostname} value={d.hostname}>{d.hostname}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Severity</span>
            <select value={form.severity} onChange={set('severity')} className={inputClass}>
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>{SEVERITY_STYLE[s].label}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">What's wrong?</span>
          <input
            value={form.title}
            onChange={set('title')}
            required
            maxLength={200}
            placeholder="BGP neighbor 10.255.0.1 down"
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Assign to</span>
          <select value={form.assigneeId} onChange={set('assigneeId')} className={inputClass}>
            <option value="">Unassigned</option>
            {users.map((u) => (
              <option key={u._id} value={u._id}>{u.name}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">
            Details <span className="font-normal text-muted">(optional)</span>
          </span>
          <textarea
            value={form.description}
            onChange={set('description')}
            rows={4}
            placeholder="What you've seen so far, customer impact, anything already tried."
            className={inputClass}
          />
        </label>

        {error && <p className="text-sm text-down" role="alert">{error}</p>}

        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="rounded-md bg-action px-4 py-2 font-medium text-white hover:bg-action/90 disabled:opacity-60">
            {saving ? 'Opening…' : 'Open incident'}
          </button>
          <Link to="/incidents" className="rounded-md px-4 py-2 font-medium text-muted hover:text-ink">Cancel</Link>
        </div>
      </form>
    </main>
  );
}
