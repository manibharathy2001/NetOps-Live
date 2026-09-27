import { Link } from 'react-router-dom';
import { AlertOctagon, AlertTriangle, BellRing, CheckCircle2, Info } from 'lucide-react';
import { SEVERITY_STYLE, timeAgo } from '../lib/format.js';
import { useNow } from '../hooks/useNow.js';

const SEVERITY_ICON = { critical: AlertOctagon, major: AlertTriangle, minor: Info, warning: Info };

export default function AlarmFeed({ alarms, cleared }) {
  const now = useNow(5000);

  return (
    <section aria-labelledby="alarms-heading" className="rounded-lg border border-line bg-panel">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 id="alarms-heading" className="flex items-center gap-2 font-semibold">
          <BellRing size={16} className={alarms.length ? 'text-down' : 'text-muted'} aria-hidden="true" />
          Active alarms
        </h2>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${alarms.length ? 'bg-down/10 text-down' : 'text-muted'}`}>
          {alarms.length}
        </span>
      </div>

      {alarms.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
          <CheckCircle2 size={22} className="text-up" aria-hidden="true" />
          <p className="text-sm text-muted">
            Network is clear. Take a device down in the simulator to raise an alarm.
          </p>
        </div>
      ) : (
        <ul className="max-h-[420px] divide-y divide-line overflow-y-auto" aria-live="polite">
          {alarms.map((alarm) => {
            const sev = SEVERITY_STYLE[alarm.severity] || SEVERITY_STYLE.minor;
            const Icon = SEVERITY_ICON[alarm.severity] || Info;
            return (
              <li key={alarm._id} className="flex gap-3 px-4 py-3">
                <Icon size={16} className={`mt-0.5 shrink-0 ${sev.text}`} aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-sm leading-snug">{alarm.message}</p>
                  <p className="mt-1 text-xs text-muted">
                    <span className={`font-medium ${sev.text}`}>{sev.label}</span>
                    <span className="mx-1.5">on</span>
                    <span className="font-mono">{alarm.hostname}</span>
                    <span className="ml-1.5">{timeAgo(alarm.raisedAt, now)}</span>
                  </p>
                  {alarm.incident && (
                    <Link to={`/incidents/${alarm.incident}`} className="mt-1 inline-block text-xs font-medium text-action hover:underline">
                      View incident
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {cleared.length > 0 && (
        <div className="border-t border-line px-4 py-3">
          <h3 className="mb-1.5 text-xs font-medium tracking-wide text-muted">Recently cleared</h3>
          <ul className="space-y-1">
            {cleared.map((alarm) => (
              <li key={alarm._id} className="flex items-start gap-1.5 truncate text-xs text-muted">
                <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-up" aria-hidden="true" />
                <span className="truncate">{alarm.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
