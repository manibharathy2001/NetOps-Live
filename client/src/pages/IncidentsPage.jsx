import { useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useIncidents } from '../hooks/useIncidents.js';
import { useNow } from '../hooks/useNow.js';
import { FILTERS } from '../lib/incidents.js';
import { timeAgo } from '../lib/format.js';
import { IncidentStatusBadge, SeverityBadge } from '../components/IncidentBadges.jsx';

const EMPTY_TEXT = {
  open: 'No open incidents. When a critical alarm fires, an incident opens here automatically.',
  resolved: 'No resolved incidents waiting to be closed.',
  closed: 'No closed incidents yet.',
  all: 'No incidents yet. Use the simulator on the dashboard, or open one yourself.',
};

function IncidentRow({ incident, changedAt, now, onOpen }) {
  const rowRef = useRef(null);

  // Same live-change flash as the device table.
  useEffect(() => {
    if (!changedAt || !rowRef.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    rowRef.current.animate(
      [{ backgroundColor: 'rgba(31, 78, 156, 0.14)' }, { backgroundColor: 'transparent' }],
      { duration: 2200, easing: 'ease-out' }
    );
  }, [changedAt]);

  return (
    <tr ref={rowRef} onClick={onOpen} className="cursor-pointer border-t border-line hover:bg-canvas/50">
      <td className="py-3 pr-4 pl-5">
        <Link
          to={`/incidents/${incident._id}`}
          onClick={(e) => e.stopPropagation()}
          className="font-mono font-medium hover:underline"
        >
          {incident.number}
        </Link>
        <span className="block max-w-[48ch] truncate text-sm">{incident.title}</span>
      </td>
      <td className="hidden py-3 pr-4 font-mono text-sm md:table-cell">{incident.hostname}</td>
      <td className="py-3 pr-4"><SeverityBadge severity={incident.severity} /></td>
      <td className="py-3 pr-4"><IncidentStatusBadge status={incident.status} /></td>
      <td className={`hidden py-3 pr-4 text-sm sm:table-cell ${incident.assigneeName ? '' : 'text-muted'}`}>
        {incident.assigneeName || 'Unassigned'}
      </td>
      <td className="hidden py-3 pr-4 text-sm whitespace-nowrap text-muted lg:table-cell">
        {timeAgo(incident.updatedAt, now)}
      </td>
    </tr>
  );
}

export default function IncidentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const filter = FILTERS[params.get('filter')] ? params.get('filter') : 'open';
  const { incidents, loading, error, changedAt } = useIncidents(filter);
  const now = useNow(10000);

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Incidents</h1>
          <div className="mt-3 flex gap-1" role="group" aria-label="Filter incidents">
            {Object.entries(FILTERS).map(([key, f]) => (
              <button
                key={key}
                type="button"
                aria-pressed={filter === key}
                onClick={() => setParams(key === 'open' ? {} : { filter: key })}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  filter === key ? 'bg-ink text-white' : 'text-muted hover:bg-panel hover:text-ink'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        {user.role !== 'viewer' && (
          <Link to="/incidents/new" className="rounded-md bg-action px-3 py-2 text-sm font-medium text-white hover:bg-action/90">
            Open an incident
          </Link>
        )}
      </div>

      <section className="mt-5 rounded-lg border border-line bg-panel">
        {loading && <p className="px-5 py-6 text-sm text-muted">Loading incidents…</p>}
        {error && <p className="px-5 py-6 text-sm text-down" role="alert">{error}</p>}
        {!loading && !error && incidents.length === 0 && (
          <p className="px-5 py-6 text-sm text-muted">{EMPTY_TEXT[filter]}</p>
        )}
        {incidents.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left">
              <thead>
                <tr className="text-sm text-muted">
                  <th className="py-2 pr-4 pl-5 font-medium">Incident</th>
                  <th className="hidden py-2 pr-4 font-medium md:table-cell">Device</th>
                  <th className="py-2 pr-4 font-medium">Severity</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="hidden py-2 pr-4 font-medium sm:table-cell">Assignee</th>
                  <th className="hidden py-2 pr-4 font-medium lg:table-cell">Updated</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map((incident) => (
                  <IncidentRow
                    key={incident._id}
                    incident={incident}
                    changedAt={changedAt[incident._id]}
                    now={now}
                    onOpen={() => navigate(`/incidents/${incident._id}`)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
