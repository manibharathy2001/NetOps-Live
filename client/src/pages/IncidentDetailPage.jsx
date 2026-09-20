import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useIncident } from '../hooks/useIncident.js';
import { useNow } from '../hooks/useNow.js';
import { api } from '../lib/api.js';
import { SEVERITIES, STATUS_TRANSITIONS, describeTimelineEntry } from '../lib/incidents.js';
import { SEVERITY_STYLE, clockTime, timeAgo } from '../lib/format.js';
import { IncidentStatusBadge, SeverityBadge } from '../components/IncidentBadges.jsx';
import Attachments from '../components/Attachments.jsx';

const selectClass = 'w-full rounded-md border border-line bg-panel px-2.5 py-1.5 text-sm disabled:opacity-60';

function Panel({ title, children, aside }) {
  return (
    <section className="rounded-lg border border-line bg-panel">
      <div className="flex items-baseline justify-between border-b border-line px-4 py-3">
        <h2 className="font-semibold">{title}</h2>
        {aside}
      </div>
      <div className="px-4 py-4">{children}</div>
    </section>
  );
}

function Presence({ viewers, me }) {
  if (!viewers.length) return null;
  const others = viewers.filter((v) => v.id !== me.id);
  return (
    <p className="flex items-center gap-2 text-sm text-muted" aria-live="polite">
      <span className="h-2 w-2 rounded-full bg-up" aria-hidden="true" />
      {others.length === 0
        ? 'Only you are viewing this incident'
        : `${others.map((v) => v.name).join(', ')} ${others.length === 1 ? 'is' : 'are'} also viewing`}
    </p>
  );
}

function Controls({ incident, canEdit, onUpdate, users, me }) {
  const [saving, setSaving] = useState(false);

  async function change(changes) {
    setSaving(true);
    await onUpdate(changes);
    setSaving(false);
  }

  if (!canEdit) {
    return (
      <dl className="space-y-3 text-sm">
        <div><dt className="text-muted">Status</dt><dd><IncidentStatusBadge status={incident.status} /></dd></div>
        <div><dt className="text-muted">Severity</dt><dd><SeverityBadge severity={incident.severity} /></dd></div>
        <div><dt className="text-muted">Assignee</dt><dd>{incident.assigneeName || 'Unassigned'}</dd></div>
      </dl>
    );
  }

  const nextStatuses = STATUS_TRANSITIONS[incident.status] || [];
  const assignedToMe = String(incident.assignee) === me.id;

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Status</span>
        <select
          value={incident.status}
          disabled={saving}
          onChange={(e) => change({ status: e.target.value })}
          className={selectClass}
        >
          <option value={incident.status}>{incident.status}</option>
          {nextStatuses.map((s) => (
            <option key={s} value={s}>{incident.status === 'Closed' && s === 'Investigating' ? 'Reopen (Investigating)' : s}</option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">Severity</span>
        <select
          value={incident.severity}
          disabled={saving}
          onChange={(e) => change({ severity: e.target.value })}
          className={selectClass}
        >
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>{SEVERITY_STYLE[s].label}</option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">Assignee</span>
        <select
          value={incident.assignee ? String(incident.assignee) : ''}
          disabled={saving}
          onChange={(e) => change({ assigneeId: e.target.value || null })}
          className={selectClass}
        >
          <option value="">Unassigned</option>
          {users.map((u) => (
            <option key={u._id} value={u._id}>{u.name}</option>
          ))}
        </select>
      </label>
      {!assignedToMe && (
        <button
          type="button"
          disabled={saving}
          onClick={() => change({ assigneeId: me.id })}
          className="text-sm font-medium text-action hover:underline disabled:opacity-60"
        >
          Assign to me
        </button>
      )}
    </div>
  );
}

function LinkedAlarms({ incident }) {
  const [alarms, setAlarms] = useState([]);

  // Refetch whenever the timeline grows: that's when alarms get linked or cleared.
  useEffect(() => {
    if (!incident.alarms.length) return;
    api(`/api/alarms?device=${incident.device}`)
      .then((all) => {
        const ids = new Set(incident.alarms.map(String));
        setAlarms(all.filter((a) => ids.has(a._id)));
      })
      .catch(() => {});
  }, [incident._id, incident.device, incident.alarms.length, incident.timeline.length]);

  if (!incident.alarms.length) return <p className="text-sm text-muted">No alarms are attached to this incident.</p>;

  return (
    <ul className="space-y-2">
      {alarms.map((a) => (
        <li key={a._id} className="flex gap-3 text-sm">
          <span className={`w-1 shrink-0 rounded-full ${a.active ? SEVERITY_STYLE[a.severity].bar : 'bg-line'}`} aria-hidden="true" />
          <div>
            <p className={a.active ? '' : 'text-muted'}>{a.message}</p>
            <p className="text-xs text-muted">
              {a.active ? (
                <span className={SEVERITY_STYLE[a.severity].text}>Active since {clockTime(a.raisedAt)}</span>
              ) : (
                <span className="text-up">Cleared at {clockTime(a.clearedAt)}</span>
              )}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Comments({ incident, canEdit, onAdd, now }) {
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setPosting(true);
    if (await onAdd(text)) setText('');
    setPosting(false);
  }

  return (
    <div>
      {incident.comments.length === 0 ? (
        <p className="text-sm text-muted">No comments yet. Share what you've checked so the next engineer doesn't repeat it.</p>
      ) : (
        <ol className="space-y-4">
          {incident.comments.map((c) => (
            <li key={c._id}>
              <p className="text-sm">
                <span className="font-semibold">{c.authorName}</span>
                <span className="ml-2 text-muted" title={new Date(c.createdAt).toLocaleString()}>{timeAgo(c.createdAt, now)}</span>
              </p>
              <p className="mt-0.5 text-sm whitespace-pre-wrap">{c.text}</p>
            </li>
          ))}
        </ol>
      )}

      {canEdit && (
        <form onSubmit={handleSubmit} className="mt-5 border-t border-line pt-4">
          <label htmlFor="comment" className="mb-1 block text-sm font-medium">Add a comment</label>
          <textarea
            id="comment"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit(e);
            }}
            rows={3}
            placeholder="e.g. show interfaces Hu0/0/1/0: Rx power -40 dBm, suspect fiber."
            className="w-full rounded-md border border-line px-3 py-2 text-sm"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-muted">Ctrl + Enter to post</span>
            <button
              type="submit"
              disabled={posting || !text.trim()}
              className="rounded-md bg-action px-3 py-1.5 text-sm font-medium text-white hover:bg-action/90 disabled:opacity-50"
            >
              {posting ? 'Posting…' : 'Post comment'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// Attachment entries are described here so lib/incidents.js doesn't need changing.
function describe(e) {
  if (e.action === 'attachment_added') return `${e.actor} attached ${e.note}`;
  if (e.action === 'attachment_removed') return `${e.actor} removed ${e.note}`;
  return describeTimelineEntry(e);
}

function Timeline({ entries }) {
  const newestFirst = [...entries].reverse();
  return (
    <ol className="relative space-y-3 border-l border-line pl-4">
      {newestFirst.map((e, i) => (
        <li key={`${e.at}-${i}`} className="relative">
          <span className="absolute top-1.5 -left-[21px] h-2 w-2 rounded-full border border-line bg-panel" aria-hidden="true" />
          <p className="text-sm">{describe(e)}</p>
          <p className="text-xs text-muted">{clockTime(e.at)}</p>
        </li>
      ))}
    </ol>
  );
}

export default function IncidentDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { incident, loading, error, notice, viewers, update, addComment } = useIncident(id);
  const [users, setUsers] = useState([]);
  const now = useNow(10000);
  const canEdit = user.role !== 'viewer';

  useEffect(() => {
    api('/api/users').then(setUsers).catch(() => {});
  }, []);

  if (loading && !incident) return <main className="mx-auto max-w-[1400px] px-4 py-6 text-muted sm:px-6">Loading incident…</main>;
  if (error && !incident) {
    return (
      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
        <p className="text-down" role="alert">{error}</p>
        <Link to="/incidents" className="mt-2 inline-block text-sm font-medium text-action hover:underline">Back to incidents</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6">
      <Link to="/incidents" className="text-sm font-medium text-action hover:underline">All incidents</Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="font-mono text-lg font-medium">{incident.number}</span>
            <IncidentStatusBadge status={incident.status} />
            <SeverityBadge severity={incident.severity} />
          </div>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">{incident.title}</h1>
          <p className="mt-1 text-sm text-muted">
            On <span className="font-mono text-ink">{incident.hostname}</span>, opened {timeAgo(incident.createdAt, now)}
            {incident.source === 'auto' ? ' automatically from a critical alarm' : ''}
          </p>
        </div>
        <Presence viewers={viewers} me={user} />
      </div>

      {notice && (
        <p className="mt-4 rounded-md border border-warn/40 bg-warn/10 px-4 py-3 text-sm" role="alert">{notice}</p>
      )}

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          {incident.description && (
            <Panel title="Details">
              <p className="text-sm whitespace-pre-wrap">{incident.description}</p>
            </Panel>
          )}
          <Panel title="Alarms" aside={<span className="text-sm text-muted tabular-nums">{incident.alarms.length}</span>}>
            <LinkedAlarms incident={incident} />
          </Panel>
          <Panel title="Attachments" aside={<span className="text-sm text-muted tabular-nums">{incident.attachments.length}</span>}>
            <Attachments incident={incident} canEdit={canEdit} />
          </Panel>
          <Panel title="Comments" aside={<span className="text-sm text-muted tabular-nums">{incident.comments.length}</span>}>
            <Comments incident={incident} canEdit={canEdit} onAdd={addComment} now={now} />
          </Panel>
        </div>

        <aside className="space-y-5">
          <Panel title="Manage">
            <Controls incident={incident} canEdit={canEdit} onUpdate={update} users={users} me={user} />
          </Panel>
          <Panel title="Timeline">
            <Timeline entries={incident.timeline} />
          </Panel>
        </aside>
      </div>
    </main>
  );
}
